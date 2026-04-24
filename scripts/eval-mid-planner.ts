#!/usr/bin/env npx tsx
/**
 * β(A) MidPipeline Planner — 독립 eval 스크립트 (2026-04-24)
 *
 * P3.5 완료 상태의 belief 를 직접 구성하여 MidPlanner 만 독립 실행.
 * 프롬프트·rationale 품질을 파이프라인 전체 실행 없이 빠르게 반복 확인한다.
 *
 * 사용법:
 *   npx tsx scripts/eval-mid-planner.ts --studentId=<uuid> --grade=<1|2|3>
 *   npx tsx scripts/eval-mid-planner.ts --studentId=<uuid> --grade=<1|2|3> --dry
 *
 * 옵션:
 *   --studentId  (필수) 대상 학생 uuid
 *   --grade      (필수) 대상 학년 (1, 2, 3)
 *   --dry        LLM 호출 없이 belief 직렬화 프롬프트만 stdout 출력
 *
 * 출력 (--dry 없을 때):
 *   1. belief 직렬화 텍스트 (구분선 포함)
 *   2. MidPlan JSON (recordPriorityOverride / focusHypothesis / concernFlags / rationale / llmDurationMs)
 *
 * 환경변수:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필수
 *   GEMINI_API_KEY 또는 상당하는 LLM 키 필수 (--dry 아닐 때)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdminClient } from "../lib/supabase/admin";
import {
  serializeBeliefForPlanner,
  runMidPipelinePlanner,
} from "../lib/domains/record-analysis/pipeline/orient/mid-pipeline-planner";
import { findProfileCard } from "../lib/domains/student-record/repository/profile-card-repository";
import { loadPreviousRunOutputs } from "../lib/domains/record-analysis/pipeline/pipeline-previous-run";
import {
  resolveRecordDataForGrade,
} from "../lib/domains/record-analysis/pipeline/pipeline-data-resolver";
import type { BeliefState } from "../lib/domains/record-analysis/pipeline/belief-state";
import type {
  PipelineContext,
  CachedSetek,
  CachedChangche,
  CachedHaengteuk,
  AnalysisContextByGrade,
} from "../lib/domains/record-analysis/pipeline/pipeline-types";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 인자 파싱
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit?.split("=").slice(1).join("=");
}

const studentId = getArg("studentId");
const gradeStr = getArg("grade");
const isDry = args.includes("--dry");

if (!studentId || !gradeStr) {
  console.error(
    "[eval-mid-planner] 필수 인자 누락.\n" +
    "사용법: npx tsx scripts/eval-mid-planner.ts --studentId=<uuid> --grade=<1|2|3> [--dry]",
  );
  process.exit(1);
}

const targetGrade = parseInt(gradeStr, 10);
if (![1, 2, 3].includes(targetGrade)) {
  console.error(`[eval-mid-planner] --grade 는 1, 2, 3 중 하나여야 합니다. 입력값: ${gradeStr}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    console.error("[eval-mid-planner] SUPABASE_SERVICE_ROLE_KEY 미설정");
    process.exit(1);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  eval-mid-planner — β(A) MidPipeline Planner`);
  console.log(`  studentId : ${studentId}`);
  console.log(`  grade     : ${targetGrade}학년`);
  console.log(`  mode      : ${isDry ? "dry (프롬프트만)" : "full (LLM 호출)"}`);
  console.log(`${"=".repeat(60)}\n`);

  // ── 1. 학생 조회 → tenantId / studentGrade 확보 ──────────────────────────
  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, grade, tenant_id")
    .eq("id", studentId)
    .maybeSingle();

  if (studentErr) {
    console.error(`[eval-mid-planner] 학생 조회 실패: ${studentErr.message}`);
    process.exit(1);
  }
  if (!student) {
    console.error(`[eval-mid-planner] 학생을 찾을 수 없습니다: ${studentId}`);
    process.exit(1);
  }

  const tenantId = student.tenant_id as string;
  const studentGrade = (student.grade as number) ?? targetGrade;

  console.log(`[학생] grade=${studentGrade}, tenantId=${tenantId.slice(0, 8)}…\n`);

  // ── 2. belief 필드별 로드 ───────────────────────────────────────────────
  const belief: BeliefState = {};

  // 2-a. profileCard — DB 에서 로드
  try {
    const persisted = await findProfileCard(studentId, tenantId, targetGrade, "ai", supabase);
    if (persisted) {
      const card = persisted;
      const strengthsText = (card.persistent_strengths as Array<{ competencyItem: string; bestGrade: string }> | null)
        ?.slice(0, 3)
        .map((s) => `${s.competencyItem}(${s.bestGrade})`)
        .join(", ") ?? "없음";
      const weaknessesText = (card.persistent_weaknesses as Array<{ competencyItem: string; worstGrade: string }> | null)
        ?.slice(0, 3)
        .map((w) => `${w.competencyItem}(${w.worstGrade})`)
        .join(", ") ?? "없음";
      belief.profileCard =
        `[프로필 카드 ${targetGrade}학년 대상]\n` +
        `- 평균 등급: ${card.overall_average_grade}\n` +
        `- 지속 강점: ${strengthsText}\n` +
        `- 지속 약점: ${weaknessesText}`;
      console.log(`[belief] profileCard: 로드 완료 (target_grade=${targetGrade})`);
    } else {
      console.log(`[belief] profileCard: (skipped, DB에 해당 target_grade=${targetGrade} 카드 없음)`);
    }
  } catch (err) {
    console.log(`[belief] profileCard: (skipped, 로드 오류: ${String(err)})`);
  }

  // 2-b. resolvedRecords — 세특/창체/행특 DB 조회 후 해소
  try {
    const [sRes, cRes, hRes] = await Promise.all([
      supabase
        .from("student_record_seteks")
        .select("id, content, imported_content, ai_draft_content, grade, subject:subject_id(name)")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .returns<CachedSetek[]>(),
      supabase
        .from("student_record_changche")
        .select("id, content, imported_content, ai_draft_content, grade, activity_type")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
      supabase
        .from("student_record_haengteuk")
        .select("id, content, imported_content, ai_draft_content, grade")
        .eq("student_id", studentId)
        .eq("tenant_id", tenantId),
    ]);

    const allSeteks = sRes.data ?? [];
    const allChangche = (cRes.data ?? []) as CachedChangche[];
    const allHaengteuk = (hRes.data ?? []) as CachedHaengteuk[];

    const resolved = resolveRecordDataForGrade(allSeteks, allChangche, allHaengteuk, targetGrade);

    if (!resolved[targetGrade]) {
      resolved[targetGrade] = { seteks: [], changche: [], haengteuk: null, hasAnyNeis: false };
    }

    belief.resolvedRecords = resolved;

    const gradeData = resolved[targetGrade];
    console.log(
      `[belief] resolvedRecords: 로드 완료 (seteks=${gradeData?.seteks.length ?? 0}, ` +
      `changche=${gradeData?.changche.length ?? 0}, haengteuk=${gradeData?.haengteuk ? "yes" : "no"}, ` +
      `hasAnyNeis=${gradeData?.hasAnyNeis})`
    );
  } catch (err) {
    console.log(`[belief] resolvedRecords: (skipped, 로드 오류: ${String(err)})`);
  }

  // 2-c. analysisContext — 최근 completed 파이프라인의 task_results._analysisContext 에서 복원
  try {
    const { data: latestPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("task_results")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "grade")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPipeline?.task_results) {
      const taskResults = latestPipeline.task_results as Record<string, unknown>;
      const ac = taskResults._analysisContext as AnalysisContextByGrade | undefined;
      if (ac && Object.keys(ac).length > 0) {
        belief.analysisContext = ac;
        console.log(`[belief] analysisContext: 복원 완료 (학년: ${Object.keys(ac).join(", ")})`);
      } else {
        console.log(`[belief] analysisContext: (skipped, _analysisContext 없음 또는 비어있음)`);
      }
    } else {
      console.log(`[belief] analysisContext: (skipped, completed grade 파이프라인 없음)`);
    }
  } catch (err) {
    console.log(`[belief] analysisContext: (skipped, 로드 오류: ${String(err)})`);
  }

  // 2-d. previousRunOutputs — 직전 completed grade 파이프라인 task_results 로드
  try {
    const prev = await loadPreviousRunOutputs(
      supabase,
      studentId,
      tenantId,
      "grade",
      "00000000-0000-0000-0000-000000000000",
    );
    belief.previousRunOutputs = prev;
    if (prev.runId) {
      console.log(`[belief] previousRunOutputs: 로드 완료 (runId=${prev.runId.slice(0, 8)}…, completedAt=${prev.completedAt?.slice(0, 10)})`);
    } else {
      console.log(`[belief] previousRunOutputs: 최초 실행 (직전 run 없음)`);
    }
  } catch (err) {
    console.log(`[belief] previousRunOutputs: (skipped, 로드 오류: ${String(err)})`);
  }

  // 2-e. gradeThemes — β(A) 에서는 P3.5 task_result 에서 복원 시도
  // cross_subject_theme_extraction 결과는 grade pipeline task_results 에 저장됨.
  try {
    const { data: latestPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("task_results")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "grade")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestPipeline?.task_results) {
      const taskResults = latestPipeline.task_results as Record<string, unknown>;
      const themeResult = taskResults.cross_subject_theme_extraction as Record<string, unknown> | undefined;
      if (themeResult && Array.isArray(themeResult.dominantThemeIds)) {
        belief.gradeThemes = {
          dominantThemeIds: themeResult.dominantThemeIds as string[],
          themes: (themeResult.themes as import("../lib/domains/record-analysis/llm/types").GradeTheme[] | undefined) ?? [],
          grade: targetGrade,
          targetGrade,
          schoolYear: new Date().getFullYear(),
        };
        console.log(`[belief] gradeThemes: 복원 완료 (dominantThemeIds=${belief.gradeThemes.dominantThemeIds.length}건)`);
      } else {
        console.log(`[belief] gradeThemes: (skipped, cross_subject_theme_extraction 결과 없음)`);
      }
    } else {
      console.log(`[belief] gradeThemes: (skipped, completed grade 파이프라인 없음)`);
    }
  } catch (err) {
    console.log(`[belief] gradeThemes: (skipped, 로드 오류: ${String(err)})`);
  }

  // 2-f. qualityPatterns — Synthesis task_results.ai_diagnosis 에서 복원
  try {
    const { data: synthPipeline } = await supabase
      .from("student_record_analysis_pipelines")
      .select("task_results")
      .eq("student_id", studentId)
      .eq("tenant_id", tenantId)
      .eq("pipeline_type", "synthesis")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (synthPipeline?.task_results) {
      const taskResults = synthPipeline.task_results as Record<string, unknown>;
      const diagResult = taskResults.ai_diagnosis as Record<string, unknown> | undefined;
      const qp = diagResult?.qualityPatterns;
      if (Array.isArray(qp) && qp.length > 0) {
        belief.qualityPatterns = qp as Array<{ pattern: string; count: number; subjects: string[] }>;
        console.log(`[belief] qualityPatterns: 복원 완료 (${qp.length}건)`);
      } else {
        console.log(`[belief] qualityPatterns: (skipped, synthesis ai_diagnosis.qualityPatterns 없음)`);
      }
    } else {
      console.log(`[belief] qualityPatterns: (skipped, completed synthesis 파이프라인 없음)`);
    }
  } catch (err) {
    console.log(`[belief] qualityPatterns: (skipped, 로드 오류: ${String(err)})`);
  }

  // ── 3. 최소 ctx 구성 ──────────────────────────────────────────────────────

  const gradeMode: "analysis" | "design" = "analysis";

  const minCtx = {
    studentId,
    tenantId,
    studentGrade,
    targetGrade,
    gradeMode,
    belief,
    supabase,
    pipelineId: "eval-script",
    pipelineType: "grade" as const,
    tasks: {} as Record<string, string>,
    rawTasks: {} as Record<string, string>,
    previews: {} as Record<string, string>,
    results: {} as Record<string, unknown>,
    errors: {} as Record<string, string>,
    cachedSeteks: [] as CachedSetek[],
    cachedChangche: [] as CachedChangche[],
    cachedHaengteuk: [] as CachedHaengteuk[],
    coursePlanData: null,
    snapshot: null,
    neisGrades: [] as number[],
    consultingGrades: [] as number[],
    resolvedRecords: belief.resolvedRecords ?? {},
    qualityPatterns: belief.qualityPatterns,
    analysisContext: belief.analysisContext,
    previousRunOutputs: belief.previousRunOutputs,
  } as unknown as PipelineContext;

  // ── 4. belief 직렬화 → 프롬프트 출력 ─────────────────────────────────────

  console.log(`\n${"─".repeat(60)}`);
  console.log("  BELIEF 직렬화 결과 (serializeBeliefForPlanner 출력, P3.5 이후 상태)");
  console.log(`${"─".repeat(60)}\n`);

  const beliefSummary = serializeBeliefForPlanner(belief, {
    studentGrade,
    gradeMode,
    targetGrade,
  });

  console.log(beliefSummary);

  // ── 5. --dry 이면 여기서 종료 ────────────────────────────────────────────

  if (isDry) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("  [dry] LLM 호출 생략. --dry 플래그 제거 후 재실행하면 MidPlan 출력.");
    console.log(`${"─".repeat(60)}\n`);
    return;
  }

  // ── 6. MidPipeline Planner 실행 ───────────────────────────────────────────

  console.log(`\n${"─".repeat(60)}`);
  console.log("  MidPlan (runMidPipelinePlanner 출력)");
  console.log(`${"─".repeat(60)}\n`);

  // env flag 강제 활성화 (eval 전용)
  process.env.ENABLE_MID_PIPELINE_PLANNER = "true";

  const midPlan = await runMidPipelinePlanner(minCtx);

  if (!midPlan) {
    console.error(
      "[eval-mid-planner] runMidPipelinePlanner 가 null 반환.\n" +
      "  → LLM 응답 파싱 실패 또는 호출 오류. GEMINI_API_KEY 설정 확인.\n" +
      "  → 또는 --dry 플래그로 belief 직렬화 상태를 먼저 확인하세요.",
    );
    process.exit(1);
  }

  const output = {
    source: midPlan.source,
    recordPriorityOverride: midPlan.recordPriorityOverride ?? null,
    focusHypothesis: midPlan.focusHypothesis ?? null,
    concernFlags: midPlan.concernFlags ?? [],
    rationale: midPlan.rationale,
    llmDurationMs: midPlan.llmDurationMs,
  };

  console.log(JSON.stringify(output, null, 2));

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  완료. llmDurationMs=${midPlan.llmDurationMs}ms`);
  console.log(`${"─".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("[eval-mid-planner] 처리되지 않은 오류:", err);
  process.exit(1);
});
