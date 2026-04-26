// ============================================
// Synthesis Belief 누적 시딩 — Phase D (2026-04-26)
//
// Grade 파이프라인에서 생성된 누적 데이터를 Synthesis 진입 시 belief 에 한 번에 로드한다.
//
// D1. profileCard  — student_record_profile_cards 최신 학년 → renderStudentProfileCard()
// D2. gradeThemesByGrade — aggregateGradeThemes() 전 학년 집계
// D3. midPlan (option B) — 최신 grade pipeline task_results._midPlan 단일
//
// 설계 원칙:
//  - best-effort try/catch: 시딩 실패 시 해당 필드 undefined, 파이프라인 계속.
//  - loadPipelineContext 에서 dynamic import 로 호출 (무거운 의존 회피).
//  - 반환 타입은 believe 에 spread 되는 partial 객체.
// ============================================

import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { logActionWarn, logActionError } from "@/lib/logging/actionLogger";
import type { GradeThemesByGrade } from "./synthesis/helpers";
import type { MidPlan } from "./orient/mid-pipeline-planner";

const LOG_CTX = { domain: "record-analysis", action: "pipeline-synthesis-belief" };

export interface SynthesisCumulativeBelief {
  /** D1: 최신 학년 profileCard 렌더 문자열. 카드 없음 = undefined (graceful). */
  profileCard?: string;
  /** D2: 전 학년 gradeThemes dict. 데이터 없음 = undefined (graceful). */
  gradeThemesByGrade?: GradeThemesByGrade;
  /** D3: 최신 grade pipeline _midPlan (option B 단일). 없음 = null. */
  midPlan?: MidPlan | null;
}

/**
 * Synthesis 파이프라인 진입 시 Grade 파이프라인 산출물을 belief 로 로드.
 * loadPipelineContext 에서 pipelineType==="synthesis" 조건 하에 호출.
 *
 * 각 시딩은 독립적으로 try/catch 처리 — 하나 실패해도 나머지 시딩은 계속.
 */
export async function loadSynthesisCumulativeBelief(
  supabase: SupabaseAdminClient,
  studentId: string,
  tenantId: string,
  pipelineId: string,
): Promise<SynthesisCumulativeBelief> {
  const result: SynthesisCumulativeBelief = {};

  // ── D1: profileCard ──────────────────────────────────────────────────────
  // student_record_profile_cards 에서 target_grade DESC limit 1 (최신 학년 단일).
  // buildStudentProfileCard 가 priorSchoolYears 를 누적 빌드하므로 최신 학년이 가장 풍부.
  try {
    const { data: cardRows } = await supabase
      .from("student_record_profile_cards")
      .select("*")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("source", "ai")
      .order("target_grade", { ascending: false })
      .limit(1);

    const row = cardRows?.[0] ?? null;
    if (row) {
      const { rowToProfileCard } = await import(
        "@/lib/domains/student-record/repository/profile-card-repository"
      );
      const { renderStudentProfileCard } = await import(
        "@/lib/domains/record-analysis/pipeline/pipeline-task-runners-shared"
      );
      const card = rowToProfileCard(row as Parameters<typeof rowToProfileCard>[0]);
      result.profileCard = renderStudentProfileCard(card);
    }
    // row 없음: result.profileCard = undefined → belief 에 시딩 안 됨 (graceful)
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D1 profileCard 시딩 실패 — belief.profileCard undefined 로 진행",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  // ── D2: gradeThemesByGrade ────────────────────────────────────────────────
  // aggregateGradeThemes 는 학년별 grade pipeline task_results 를 cross-pipeline 조회.
  // 기존 S3 직접 호출과 동일 로직이지만 belief 시딩으로 일원화 (S3 중복 경로 정리는 D2 단계에서).
  try {
    const { aggregateGradeThemes } = await import("./synthesis/helpers");
    const byGrade = await aggregateGradeThemes({ supabase, studentId, tenantId });
    if (Object.keys(byGrade).length > 0) {
      result.gradeThemesByGrade = byGrade;
    }
    // 빈 dict: result.gradeThemesByGrade = undefined (graceful)
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D2 gradeThemesByGrade 시딩 실패 — belief.gradeThemesByGrade undefined 로 진행",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  // ── D3: midPlan (option B — 최신 학년 단일) ──────────────────────────────
  // 학년별 grade pipeline task_results._midPlan 에서 가장 최신 학년(grade DESC) 1개만 추출.
  // resolveMidPlan(ctx) 가 ctx.midPlan → ctx.results["_midPlan"] 순으로 해소하므로
  // ctx.midPlan 에 시딩하면 기존 phase 코드 무수정 호환.
  try {
    const { data: gradeRows } = await supabase
      .from("student_record_analysis_pipelines")
      .select("grade, task_results")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "grade")
      .eq("status", "completed")
      .order("grade", { ascending: false })
      .order("created_at", { ascending: false });

    // 학년 내림차순 조회 — grade 가 높은 것(최신 학년)부터 순회해 _midPlan 보유 첫 번째 선택.
    const seenGrades = new Set<number>();
    for (const row of (gradeRows ?? []) as Array<{
      grade: number | null;
      task_results: unknown;
    }>) {
      if (row.grade == null || seenGrades.has(row.grade)) continue;
      seenGrades.add(row.grade);
      const tr = row.task_results as Record<string, unknown> | null;
      const mp = tr?._midPlan as MidPlan | null | undefined;
      if (mp && typeof mp === "object" && "focusHypothesis" in mp) {
        result.midPlan = mp;
        break; // 최신 학년 1개만
      }
    }
    // _midPlan 없음: result.midPlan = undefined → ctx.midPlan 시딩 안 됨 (graceful)
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D3 midPlan 시딩 실패 — ctx.midPlan undefined 로 진행",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  return result;
}
