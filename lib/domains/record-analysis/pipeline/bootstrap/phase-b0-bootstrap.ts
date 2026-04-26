// ============================================
// Bootstrap Pipeline Phase B0 — 3 Runner 분해
// (Auto-Bootstrap Phase 2, 2026-04-18)
//
// pipelineType="bootstrap" 의 BT0/BT1/BT2 3 runner 구현.
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
import { withExtendedRetry } from "../../llm/withExtendedRetry";
import type { SupabaseAdminClient } from "@/lib/supabase/admin";
import { BootstrapError } from "./bootstrap-error";
import { buildRecordSummaryForSeed } from "./build-record-summary";

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

  // Phase 3. k≥1 학생(이전 학년 synthesis/analysis 완료) 이면 기존 탐구 요약을 LLM 에 주입.
  //   학생 개별화된 메인 탐구 초안을 얻기 위함. k=0 이면 null 반환 → summary 없이 기존 경로.
  const recordSummary = await buildRecordSummaryForSeed(studentId, tenantId, supabase);
  if (recordSummary) {
    logActionDebug(LOG_CTX, "k≥1 감지 — NEIS 요약 주입", {
      studentId,
      keywordCount: recordSummary.keywords.length,
      subjectCount: recordSummary.subjectAreas.length,
    });
  }

  // BT1 task 단위 route(300s Vercel 한도) 에서 실행되므로 대기 상한을 60s로 제한.
  //   [1s, 10s, 60s] 3회 재시도, 누적 ~71s + LLM 호출 시간. rate limit 미회복 시
  //   task=pending 으로 남아 클라이언트가 재호출 시 idempotent 재시도 가능.
  //   기존 단일 phase-1 route 맥락에서는 maxDelayMs 없이 전체 21분 정책 유지.
  const seed = await withExtendedRetry(
    () => generateMainExplorationSeed({
      targetMajor,
      targetMajor2,
      tier1Code: tier1,
      currentGrade: grade,
      ...(recordSummary ? { recordSummary } : {}),
    }),
    {
      pipelineId: ctx.pipelineId,
      supabase: ctx.supabase as SupabaseAdminClient,
      label: "bootstrap.main_exploration_seed",
      maxDelayMs: 60_000,
    },
  );

  if (!seed.success) {
    throw new BootstrapError(
      `LLM seed 생성 실패: ${seed.error}`,
      "main_exploration",
    );
  }

  const schoolYear = calculateSchoolYear();
  // KST 기준 월로 학기 판정 (UTC 사용 시 02/28 22:00 KST ≈ 02/28 13:00 UTC 경계 오판).
  const kstMonth = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      month: "numeric",
    }).format(new Date()),
  );
  const semester: 1 | 2 = kstMonth >= 3 && kstMonth <= 8 ? 1 : 2;

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
      // Phase 3. Bootstrap 경로임을 명시 — 추후 Phase 4 재부트스트랩이
      //   origin='auto_bootstrap*' AND edited_by_consultant_at IS NULL 인 row 만
      //   덮어쓰기 대상으로 판정. 컨설턴트 수정본 보호.
      origin: "auto_bootstrap",
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

  // tenant_id 명시: admin client 경로(RLS 우회)에서 cross-tenant row 카운트 방지.
  const { count: planCount } = await supabase
    .from("student_course_plans")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("tenant_id", tenantId);

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
