/**
 * Unified Plan Generation Pipeline - Public Exports
 *
 * 관리자 영역에서 AI 콜드스타트를 활용한 학습 플랜 생성 기능을 제공합니다.
 *
 * @example
 * import {
 *   runUnifiedPlanGenerationPipeline,
 *   previewUnifiedPlanGeneration,
 * } from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
 *
 * // 실제 생성 (DB 저장 포함)
 * const result = await runUnifiedPlanGenerationPipeline({
 *   studentId: "...",
 *   tenantId: "...",
 *   planName: "1학기 수학 학습",
 *   // ...
 * });
 *
 * // 미리보기 (DB 저장 없음)
 * const preview = await previewUnifiedPlanGeneration({
 *   studentId: "...",
 *   // ...
 * });
 */

// Pipeline functions
export {
  runUnifiedPlanGenerationPipeline,
  previewUnifiedPlanGeneration,
  type PipelineOptions,
} from "./pipeline";

// Schemas (for API validation)
export {
  unifiedPlanGenerationInputSchema,
  previewRequestSchema,
  markdownExportRequestSchema,
} from "./schemas";

// Types
export type {
  // Input types
  UnifiedPlanGenerationInput,
  ValidatedPlanInput,
  TimeRange,
  AcademyScheduleInput,
  ExclusionInput,
  ContentSelectionInput,
  TimetableSettings,
  GenerationOptions,
  // Content types
  ResolvedContentItem,
  ContentResolutionResult,
  // Schedule types
  SchedulerContextResult,
  ScheduleGenerationResult,
  // Validation types
  ValidationResult,
  ValidationWarning,
  // Persistence types
  PlanGroupInfo,
  PersistenceResult,
  // Output types
  UnifiedPlanGenerationOutput,
  UnifiedPlanGenerationSuccessOutput,
  UnifiedPlanGenerationFailureOutput,
  // Markdown types
  WeeklySchedule,
  MarkdownExportData,
  // Constants
  PlanPurpose,
  StudentLevel,
  SubjectType,
  DistributionStrategy,
  DifficultyLevel,
  ContentType,
} from "./types";

// Individual stages (for advanced use cases)
export { validateInput } from "./stages/validateInput";
export { resolveContent } from "./stages/resolveContent";
export { buildSchedulerContext } from "./stages/buildSchedulerContext";
export { generateSchedule } from "./stages/generateSchedule";
export { validateAndAdjust } from "./stages/validateAndAdjust";
export { persist } from "./stages/persist";
export { exportMarkdown } from "./stages/exportMarkdown";

// Utilities
export { generateContentId, toContentInfo } from "./utils/contentMapper";
export {
  groupPlansByWeek,
  calculateStatistics,
  buildMarkdownExportData,
  renderMarkdown,
} from "./utils/markdownHelpers";
