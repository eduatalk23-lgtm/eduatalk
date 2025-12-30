/**
 * Content-based PlanGroup Server Actions
 *
 * 콘텐츠별 플랜그룹 생성을 위한 4단계 간소화 플로우:
 * 1. 콘텐츠 선택
 * 2. 범위 설정
 * 3. 학습 유형 (전략/취약)
 * 4. 미리보기 및 생성
 *
 * 위저드 플랜그룹(템플릿)에서 설정을 상속받아 빠르게 생성합니다.
 *
 * NOTE: "use server" 지시어를 제거했습니다.
 * Next.js에서 "use server" 파일은 async 함수만 export할 수 있지만,
 * 이 파일은 타입과 helper 함수도 re-export합니다.
 * 실제 서버 액션은 각 하위 파일에서 "use server"로 정의됩니다.
 *
 * @deprecated 직접 import 대신 "@/lib/domains/plan/actions/contentPlanGroup" 폴더에서 import 권장
 * 이 파일은 하위 호환성을 위해 re-export만 제공합니다.
 */

// Types
export {
  MAX_CONTENT_PLAN_GROUPS,
  MAX_CONTENTS_PER_PLAN_GROUP,
  type PlanGroupSummary,
  type QuickCreateInput,
  type CreateQuickPlanInput,
  type CreateQuickPlanResult,
  type AddContentToCalendarOnlyInput,
  type DefaultRecommendation,
  type ReviewDate,
} from "./contentPlanGroup/types";

// Helpers
export {
  getWeekKey,
  getWeekNumber,
  getAvailableStudyDates,
  selectStrategyDates,
  distributeDailyAmounts,
  getReviewDates,
  getDefaultRecommendation,
} from "./contentPlanGroup/helpers";

// Query Actions
export {
  getContentPlanGroupCount,
  getTemplateSettings,
  getContentPlanGroups,
  getTemplatePlanGroups,
  getNearCompletionPlanGroups,
  getSmartScheduleRecommendation,
} from "./contentPlanGroup/queries";

// Create Actions
export {
  previewContentPlanGroup,
  createContentPlanGroup,
  addContentToCalendarOnlyGroup,
  addContentToExistingPlanGroup,
} from "./contentPlanGroup/create";

// Quick Create Actions
export { quickCreateFromContent, createQuickPlan } from "./contentPlanGroup/quickCreate";
