/**
 * Unified Plan Generation Pipeline
 *
 * 관리자 영역에서 AI 콜드스타트를 활용한 학습 플랜 생성의 메인 오케스트레이션입니다.
 *
 * 파이프라인 흐름:
 * Stage 1: 입력 검증 → Stage 2: 콘텐츠 해결 → Stage 3: 스케줄러 컨텍스트 빌딩
 * → Stage 4: 스케줄 생성 → Stage 5: 검증/조정 → Stage 6: DB 저장 → Stage 7: 마크다운 출력
 */

import { validateInput } from "./stages/validateInput";
import { resolveContent } from "./stages/resolveContent";
import { buildSchedulerContext } from "./stages/buildSchedulerContext";
import { generateSchedule } from "./stages/generateSchedule";
import { validateAndAdjust } from "./stages/validateAndAdjust";
import { persist } from "./stages/persist";
import { exportMarkdown } from "./stages/exportMarkdown";
import type {
  UnifiedPlanGenerationInput,
  UnifiedPlanGenerationOutput,
  PipelineContext,
} from "./types";

/**
 * 파이프라인 옵션
 */
export interface PipelineOptions {
  /**
   * 드라이런 모드 (DB 저장 건너뜀)
   * 입력의 generationOptions.dryRun보다 우선순위가 높습니다.
   */
  forceDryRun?: boolean;
}

/**
 * Unified Plan Generation 파이프라인을 실행합니다.
 *
 * @param input - 플랜 생성 입력 데이터
 * @param options - 파이프라인 옵션
 * @returns 생성 결과 또는 에러
 *
 * @example
 * const result = await runUnifiedPlanGenerationPipeline({
 *   studentId: "...",
 *   tenantId: "...",
 *   planName: "1학기 수학 학습",
 *   planPurpose: "내신대비",
 *   periodStart: "2025-03-01",
 *   periodEnd: "2025-03-31",
 *   timeSettings: {
 *     studyHours: { start: "09:00", end: "22:00" },
 *     lunchTime: { start: "12:00", end: "13:00" },
 *   },
 *   contentSelection: {
 *     subjectCategory: "수학",
 *     subject: "미적분",
 *     difficulty: "개념",
 *   },
 *   timetableSettings: {
 *     studyDays: 6,
 *     reviewDays: 1,
 *     studentLevel: "medium",
 *     subjectType: "weakness",
 *   },
 * });
 *
 * if (result.success) {
 *   console.log("생성 완료:", result.planGroup);
 *   console.log("마크다운:", result.markdown);
 * } else {
 *   console.error("실패:", result.failedAt, result.error);
 * }
 */
export async function runUnifiedPlanGenerationPipeline(
  input: UnifiedPlanGenerationInput,
  options?: PipelineOptions
): Promise<UnifiedPlanGenerationOutput> {
  const context: Partial<PipelineContext> = {};

  // Force dryRun if option is set
  if (options?.forceDryRun) {
    input = {
      ...input,
      generationOptions: {
        ...input.generationOptions,
        dryRun: true,
        saveToDb: false,
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Stage 1: 입력 검증
  // ────────────────────────────────────────────────────────────────────
  const validationResult = validateInput(input);

  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error,
      failedAt: "validation",
      details: validationResult.details,
    };
  }

  context.input = validationResult.data;

  // ────────────────────────────────────────────────────────────────────
  // Stage 2: 콘텐츠 해결
  // ────────────────────────────────────────────────────────────────────
  const contentResult = await resolveContent(context.input);

  if (!contentResult.success) {
    return {
      success: false,
      error: contentResult.error,
      failedAt: "content_resolution",
      details: contentResult.details,
    };
  }

  context.contentResolution = contentResult.data;

  // ────────────────────────────────────────────────────────────────────
  // Stage 3: 스케줄러 컨텍스트 빌딩
  // ────────────────────────────────────────────────────────────────────
  const schedulerContextResult = buildSchedulerContext(
    context.input,
    context.contentResolution
  );

  if (!schedulerContextResult.success) {
    return {
      success: false,
      error: schedulerContextResult.error,
      failedAt: "scheduler_context",
      details: schedulerContextResult.details,
    };
  }

  context.schedulerContext = schedulerContextResult.data;

  // ────────────────────────────────────────────────────────────────────
  // Stage 4: 스케줄 생성
  // ────────────────────────────────────────────────────────────────────
  const scheduleResult = generateSchedule(context.input, context.schedulerContext);

  if (!scheduleResult.success) {
    return {
      success: false,
      error: scheduleResult.error,
      failedAt: "schedule_generation",
      details: scheduleResult.details,
    };
  }

  context.scheduleGeneration = scheduleResult.data;

  // ────────────────────────────────────────────────────────────────────
  // Stage 5: 검증 및 조정
  // ────────────────────────────────────────────────────────────────────
  const adjustmentResult = validateAndAdjust(
    context.input,
    context.scheduleGeneration
  );

  if (!adjustmentResult.success) {
    return {
      success: false,
      error: adjustmentResult.error,
      failedAt: "validation_adjustment",
      details: adjustmentResult.details,
    };
  }

  context.validation = adjustmentResult.data;

  // ────────────────────────────────────────────────────────────────────
  // Stage 6: DB 저장 (saveToDb이고 dryRun이 아닌 경우)
  // ────────────────────────────────────────────────────────────────────
  if (
    context.input.generationOptions.saveToDb &&
    !context.input.generationOptions.dryRun
  ) {
    const persistResult = await persist(
      context.input,
      context.validation,
      context.contentResolution
    );

    if (persistResult.success) {
      context.persistence = persistResult.data;
    }
    // 저장 실패해도 전체 파이프라인은 성공 처리 (경고만)
  }

  // ────────────────────────────────────────────────────────────────────
  // Stage 7: 마크다운 출력
  // ────────────────────────────────────────────────────────────────────
  let markdown: string | undefined;

  if (context.input.generationOptions.generateMarkdown) {
    const markdownResult = exportMarkdown(
      context.input,
      context.validation.plans,
      context.contentResolution
    );

    if (markdownResult.success) {
      markdown = markdownResult.data;
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // 최종 결과 반환
  // ────────────────────────────────────────────────────────────────────
  return {
    success: true,
    planGroup: context.persistence?.planGroup,
    plans: context.validation.plans,
    aiRecommendations: {
      strategy: context.contentResolution.strategy,
      items: context.contentResolution.items,
      newlySaved: context.contentResolution.newlySaved,
    },
    markdown,
    validation: {
      warnings: context.validation.warnings,
      autoAdjustedCount: context.validation.autoAdjustedCount,
      overlapValidation: context.validation.overlapValidation,
    },
  };
}

/**
 * 미리보기용 파이프라인 (DB 저장 없음)
 */
export async function previewUnifiedPlanGeneration(
  input: UnifiedPlanGenerationInput
): Promise<UnifiedPlanGenerationOutput> {
  return runUnifiedPlanGenerationPipeline(input, { forceDryRun: true });
}
