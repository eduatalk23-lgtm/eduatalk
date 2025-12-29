/**
 * Content-based PlanGroup Actions
 *
 * 콘텐츠별 플랜그룹 생성을 위한 서버 액션 모듈
 *
 * 4단계 간소화 플로우:
 * 1. 콘텐츠 선택
 * 2. 범위 설정
 * 3. 학습 유형 (전략/취약)
 * 4. 미리보기 및 생성
 *
 * 파일 구조:
 * - types.ts: 타입 및 상수 정의
 * - helpers.ts: 스케줄링 헬퍼 함수
 * - queries.ts: 조회 관련 서버 액션
 * - create.ts: 생성 관련 서버 액션
 * - quickCreate.ts: 빠른 생성 관련 서버 액션
 */

// Types
export {
  MAX_CONTENT_PLAN_GROUPS,
  type PlanGroupSummary,
  type QuickCreateInput,
  type CreateQuickPlanInput,
  type CreateQuickPlanResult,
  type AddContentToCalendarOnlyInput,
  type DefaultRecommendation,
  type ReviewDate,
} from "./types";

// Helpers (for internal use, export selectively)
export {
  getWeekKey,
  getWeekNumber,
  getAvailableStudyDates,
  selectStrategyDates,
  distributeDailyAmounts,
  getReviewDates,
  getDefaultRecommendation,
} from "./helpers";

// Query Actions
export {
  getContentPlanGroupCount,
  getTemplateSettings,
  getContentPlanGroups,
  getTemplatePlanGroups,
  getNearCompletionPlanGroups,
  getSmartScheduleRecommendation,
} from "./queries";

// Create Actions
export {
  previewContentPlanGroup,
  createContentPlanGroup,
  addContentToCalendarOnlyGroup,
} from "./create";

// Quick Create Actions
export { quickCreateFromContent, createQuickPlan } from "./quickCreate";
