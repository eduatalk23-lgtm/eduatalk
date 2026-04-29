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
import type { MainTheme } from "../capability/main-theme";
import type { CascadePlan } from "../capability/cascade-plan";
import type { BlueprintPhaseOutput } from "../blueprint/types";

const LOG_CTX = { domain: "record-analysis", action: "pipeline-synthesis-belief" };

export interface SynthesisCumulativeBelief {
  /** D1: 최신 학년 profileCard 렌더 문자열. 카드 없음 = undefined (graceful). */
  profileCard?: string;
  /** D2: 전 학년 gradeThemes dict. 데이터 없음 = undefined (graceful). */
  gradeThemesByGrade?: GradeThemesByGrade;
  /** D3: 최신 grade pipeline _midPlan (option B 단일). 없음 = null. */
  midPlan?: MidPlan | null;
  /** D3 확장 (격차 1): 학년별 _midPlan dict. 없음 = undefined (graceful). */
  midPlanByGrade?: Record<number, MidPlan>;
  /** D4 (M1-c, 2026-04-27): 메인 탐구주제. task_results._mainTheme 에서 회수. */
  mainTheme?: MainTheme;
  /** D4 (M1-c, 2026-04-27): 학년별 cascade plan. task_results._cascadePlan 에서 회수. */
  cascadePlan?: CascadePlan;
  /** D5 (G2 fix, 2026-04-29): 최신 blueprint pipeline 의 task_results._blueprintPhase. */
  blueprintPhase?: BlueprintPhaseOutput;
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

  // ── D3: midPlan (option B 단일 + 격차 1 다학년 dict) ────────────────────
  // 학년별 grade pipeline task_results._midPlan 에서 전체 학년을 수집한다.
  //
  // - result.midPlan     : 최신 학년 단일 (기존 option B 호환 유지 — resolveMidPlan() 소비).
  // - result.midPlanByGrade : 모든 학년 dict (격차 1 신규 — S3/S5/S6/S7 다학년 섹션 소비).
  //
  // 쿼리 패턴: aggregateGradeThemes 와 동일 (grade DESC, created_at DESC, dedupe by grade).
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

    // 학년별 최신 run 1건씩 dedupe (grade DESC + created_at DESC 이미 정렬됨).
    const seenGrades = new Set<number>();
    const byGrade: Record<number, MidPlan> = {};
    for (const row of (gradeRows ?? []) as Array<{
      grade: number | null;
      task_results: unknown;
    }>) {
      if (row.grade == null || seenGrades.has(row.grade)) continue;
      seenGrades.add(row.grade);
      const tr = row.task_results as Record<string, unknown> | null;
      const mp = tr?._midPlan as MidPlan | null | undefined;
      if (mp && typeof mp === "object" && "focusHypothesis" in mp) {
        byGrade[row.grade] = mp;
        // option B 단일: 첫 번째로 발견한 학년(가장 높은 학년 = 최신)
        if (!result.midPlan) {
          result.midPlan = mp;
        }
      }
    }

    // 격차 1: 학년별 dict 시딩 (1건 이상 있을 때만)
    if (Object.keys(byGrade).length > 0) {
      result.midPlanByGrade = byGrade;
    }
    // 빈 dict 또는 _midPlan 전무: result.midPlan / result.midPlanByGrade = undefined (graceful)
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D3 midPlan/midPlanByGrade 시딩 실패 — ctx.midPlan/midPlanByGrade undefined 로 진행",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  // ── D4: mainTheme + cascadePlan (M1-c, 2026-04-27) ────────────────────────
  // synthesis pipeline 의 task_results._mainTheme / _cascadePlan 에서 회수.
  // grade pipeline 에서 도출한 경우도 동일 키로 fallback 회수.
  try {
    const { data: pipelineRows } = await supabase
      .from("student_record_analysis_pipelines")
      .select("pipeline_type, task_results, completed_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(8);

    for (const row of (pipelineRows ?? []) as Array<{
      pipeline_type: string;
      task_results: unknown;
    }>) {
      const tr = row.task_results as Record<string, unknown> | null;
      if (!tr) continue;
      const theme = tr._mainTheme as MainTheme | undefined;
      const cascade = tr._cascadePlan as CascadePlan | undefined;
      if (!result.mainTheme && theme && typeof theme === "object" && "label" in theme) {
        result.mainTheme = theme;
      }
      if (
        !result.cascadePlan &&
        cascade &&
        typeof cascade === "object" &&
        "byGrade" in cascade
      ) {
        result.cascadePlan = cascade;
      }
      if (result.mainTheme && result.cascadePlan) break;
    }
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D4 mainTheme/cascadePlan 시딩 실패 — graceful 진행",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  // ── D5: blueprintPhase (G2 fix, 2026-04-29) ──────────────────────────────
  // 최신 completed blueprint pipeline 의 task_results._blueprintPhase 회수.
  // shadow-run 이 ctx.results["_blueprintPhase"] 와 ctx.belief.blueprintPhase 를 양방향 fallback.
  // synthesis context 에서 ctx.results 는 synthesis 자신의 task_results 라 _blueprintPhase
  // 부재 → belief 경로로 시딩되어야 milestone 보너스가 점화.
  try {
    const { data: bpRows } = await supabase
      .from("student_record_analysis_pipelines")
      .select("task_results, completed_at")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "blueprint")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1);

    const tr = (bpRows?.[0]?.task_results ?? null) as Record<string, unknown> | null;
    const bp = tr?._blueprintPhase as BlueprintPhaseOutput | undefined;
    if (bp && typeof bp === "object" && "milestones" in bp) {
      result.blueprintPhase = bp;
    }
  } catch (err) {
    logActionWarn(
      LOG_CTX,
      "D5 blueprintPhase 시딩 실패 — belief.blueprintPhase undefined 로 진행 (graceful)",
      { pipelineId, error: err instanceof Error ? err.message : String(err) },
    );
  }

  return result;
}
