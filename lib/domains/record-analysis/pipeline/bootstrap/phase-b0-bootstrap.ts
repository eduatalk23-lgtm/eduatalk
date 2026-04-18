// ============================================
// Bootstrap Pipeline Phase B0 — 3 Runner 분해
// (Auto-Bootstrap Phase 2, 2026-04-18)
//
// 기존 pipeline/bootstrap.ts 의 ensureBootstrap 내부 로직을 3 runner로 분해.
// 각 runner 는 TaskRunnerOutput 반환 — runTaskWithState 와 연동.
//
// BT0: target_major_validation — 표준 키 검증 (실패 시 cascade 차단)
// BT1: main_exploration_seed   — 활성 탐구 없으면 LLM seed 생성
// BT2: course_plan_recommend   — course_plan 0건이면 자동 생성
// ============================================

import { logActionDebug, logActionError } from "@/lib/logging/actionLogger";
import type { PipelineContext, TaskRunnerOutput } from "../pipeline-types";
import { assertBootstrapCtx } from "../pipeline-types";
import { validateTargetMajor, MAJOR_TO_TIER1 } from "@/lib/constants/career-classification";
import { createMainExploration } from "@/lib/domains/student-record/repository/main-exploration-repository";
import { generateAndSaveRecommendations } from "@/lib/domains/student-record/course-plan/service";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { generateMainExplorationSeed } from "../../llm/actions/generateMainExplorationSeed";
import { BootstrapError } from "./ensure-bootstrap";

const LOG_CTX = { domain: "record-analysis", action: "bootstrap.phase-b0" };

// ============================================
// BT0: target_major_validation
// ============================================

/**
 * 학생의 target_major 를 표준 Tier 2 키인지 검증한다.
 * 실패 시 BootstrapError throw → runTaskWithState 가 failed 처리 → cascade 차단.
 */
export async function runTargetMajorValidation(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertBootstrapCtx(ctx);
  const { studentId, supabase } = ctx;

  const { data: student, error: stuErr } = await supabase
    .from("students")
    .select("grade, target_major, target_major_2")
    .eq("id", studentId)
    .maybeSingle();

  if (stuErr || !student) {
    throw new BootstrapError(
      `학생 조회 실패: ${stuErr?.message ?? "not found"}`,
      "target_major",
    );
  }

  const v = validateTargetMajor(student.target_major);
  if (!v.ok) {
    throw new BootstrapError(v.reason, "target_major");
  }

  // 검증 통과한 값을 ctx에 캐시 (BT1/BT2에서 재사용)
  const bootstrapCtx = ctx as import("../pipeline-types").BootstrapPipelineContext;
  bootstrapCtx.targetMajor = student.target_major as string;
  bootstrapCtx.studentGradeValue = ((student.grade ?? 1) as 1 | 2 | 3);

  logActionDebug(LOG_CTX, "target_major 검증 통과", {
    studentId,
    targetMajor: student.target_major,
  });

  return {
    preview: `진로 계열 검증 완료: ${student.target_major}`,
    result: { targetMajor: student.target_major, grade: student.grade },
  };
}

// ============================================
// BT1: main_exploration_seed
// ============================================

/**
 * 활성 main_exploration 이 없으면 LLM seed 로 초안을 자동 생성한다.
 * 이미 존재하면 skip (idempotent).
 */
export async function runMainExplorationSeed(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertBootstrapCtx(ctx);
  const bootstrapCtx = ctx as import("../pipeline-types").BootstrapPipelineContext;
  const { studentId, tenantId, supabase } = ctx;

  // BT0 에서 캐시된 값 사용. 없으면 DB 재조회.
  let targetMajor = bootstrapCtx.targetMajor;
  let grade = bootstrapCtx.studentGradeValue;

  if (!targetMajor || !grade) {
    const { data: student } = await supabase
      .from("students")
      .select("grade, target_major, target_major_2")
      .eq("id", studentId)
      .maybeSingle();
    targetMajor = (student?.target_major as string | null) ?? undefined;
    grade = ((student?.grade ?? 1) as 1 | 2 | 3);
    if (!targetMajor) {
      throw new BootstrapError("target_major 미설정", "main_exploration");
    }
    bootstrapCtx.targetMajor = targetMajor;
    bootstrapCtx.studentGradeValue = grade;
  }

  // 활성 탐구 이미 존재하면 skip
  const { data: existing } = await supabase
    .from("student_main_explorations")
    .select("id, theme_label")
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(1);

  if (existing && existing.length > 0) {
    const existingLabel = (existing[0] as { theme_label?: string }).theme_label ?? "";
    logActionDebug(LOG_CTX, "main_exploration 이미 존재 — skip", { studentId, existingLabel });
    return {
      preview: `메인 탐구 이미 존재 (skip): ${existingLabel}`,
      result: { themeLabel: existingLabel, created: false },
    };
  }

  // target_major_2 조회
  const { data: studentFull } = await supabase
    .from("students")
    .select("target_major_2")
    .eq("id", studentId)
    .maybeSingle();
  const targetMajor2 = (studentFull?.target_major_2 as string | null) ?? null;

  const tier1 = MAJOR_TO_TIER1[targetMajor] ?? null;
  if (!tier1) {
    throw new BootstrapError(
      `Tier 1 매핑 실패: target_major='${targetMajor}'`,
      "main_exploration",
    );
  }

  const seed = await generateMainExplorationSeed({
    targetMajor,
    targetMajor2,
    tier1Code: tier1,
    currentGrade: grade,
  });

  if (!seed.success) {
    throw new BootstrapError(
      `LLM seed 생성 실패: ${seed.error}`,
      "main_exploration",
    );
  }

  const schoolYear = calculateSchoolYear();
  const currentMonth = new Date().getMonth() + 1;
  const semester: 1 | 2 = currentMonth >= 3 && currentMonth <= 8 ? 1 : 2;

  try {
    await createMainExploration({
      studentId,
      tenantId,
      schoolYear,
      grade,
      semester,
      scope: "overall",
      direction: "design",
      semanticRole: "hypothesis_root",
      source: "ai",
      themeLabel: seed.data.themeLabel,
      themeKeywords: seed.data.themeKeywords,
      careerField: tier1,
      tierPlan: seed.data.tierPlan,
      modelName: seed.modelName ?? null,
    });

    logActionDebug(LOG_CTX, "main_exploration 자동 생성 완료", {
      studentId,
      themeLabel: seed.data.themeLabel,
      elapsedMs: seed.elapsedMs,
    });

    return {
      preview: `메인 탐구 생성: ${seed.data.themeLabel}`,
      result: { themeLabel: seed.data.themeLabel, created: true },
    };
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId, step: "main_exploration_insert" });
    throw new BootstrapError(
      `main_exploration 저장 실패: ${err instanceof Error ? err.message : String(err)}`,
      "main_exploration",
    );
  }
}

// ============================================
// BT2: course_plan_recommend
// ============================================

/**
 * course_plan 이 0건이면 추천을 자동 생성한다.
 * 이미 1건 이상이면 skip (idempotent).
 */
export async function runCoursePlanRecommend(
  ctx: PipelineContext,
): Promise<TaskRunnerOutput> {
  assertBootstrapCtx(ctx);
  const { studentId, tenantId, supabase } = ctx;

  const { count: planCount } = await supabase
    .from("student_course_plans")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if ((planCount ?? 0) > 0) {
    logActionDebug(LOG_CTX, "course_plan 이미 존재 — skip", {
      studentId,
      count: planCount,
    });
    return {
      preview: `수강 계획 이미 존재 (skip): ${planCount}건`,
      result: { createdCount: 0, skipped: true, existingCount: planCount ?? 0 },
    };
  }

  try {
    const created = await generateAndSaveRecommendations(studentId, tenantId);
    logActionDebug(LOG_CTX, "course_plan 자동 생성 완료", {
      studentId,
      createdCount: created.length,
    });

    return {
      preview: `수강 계획 ${created.length}건 생성`,
      result: { createdCount: created.length, skipped: false },
    };
  } catch (err) {
    logActionError(LOG_CTX, err, { studentId, step: "course_plan" });
    throw new BootstrapError(
      `수강 계획 자동 생성 실패: ${err instanceof Error ? err.message : String(err)}`,
      "course_plan",
    );
  }
}
