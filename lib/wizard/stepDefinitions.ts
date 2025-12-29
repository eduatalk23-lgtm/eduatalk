/**
 * 위저드 단계 정의
 *
 * 각 모드별 단계를 정의합니다.
 *
 * @module lib/wizard/stepDefinitions
 */

import type {
  WizardMode,
  WizardStepDefinition,
  BaseWizardData,
  FullWizardData,
  QuickWizardData,
  ContentAddWizardData,
  BatchPlanWizardData,
  RescheduleWizardData,
  CampTemplateWizardData,
  ValidationResult,
} from "./types";

// ============================================
// Full 모드 단계 정의 (7단계)
// ============================================

export const FULL_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "basic-info",
    number: 1,
    label: "기본 정보",
    description: "플랜 이름, 목적, 기간을 설정합니다",
    icon: "FileText",
    required: true,
    modes: ["full", "edit", "template"],
    canProceed: (data): ValidationResult => {
      const fullData = data as FullWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!fullData.basicInfo.name?.trim()) {
        errors.push({ field: "name", message: "플랜 이름을 입력해주세요", severity: "error" });
      }
      if (!fullData.basicInfo.planPurpose) {
        errors.push({ field: "planPurpose", message: "학습 목적을 선택해주세요", severity: "error" });
      }
      if (!fullData.basicInfo.periodStart) {
        errors.push({ field: "periodStart", message: "시작일을 선택해주세요", severity: "error" });
      }
      if (!fullData.basicInfo.periodEnd) {
        errors.push({ field: "periodEnd", message: "종료일을 선택해주세요", severity: "error" });
      }
      if (fullData.basicInfo.periodStart && fullData.basicInfo.periodEnd) {
        if (new Date(fullData.basicInfo.periodStart) > new Date(fullData.basicInfo.periodEnd)) {
          errors.push({ field: "periodEnd", message: "종료일이 시작일보다 빠릅니다", severity: "error" });
        }
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "schedule-settings",
    number: 2,
    label: "스케줄 설정",
    description: "학원 일정, 제외일, 시간대를 설정합니다",
    icon: "Calendar",
    required: true,
    modes: ["full", "edit", "template"],
  },
  {
    id: "schedule-preview",
    number: 3,
    label: "스케줄 확인",
    description: "생성될 일일 스케줄을 미리 확인합니다",
    icon: "Eye",
    required: true,
    modes: ["full", "edit", "template"],
  },
  {
    id: "content-selection",
    number: 4,
    label: "콘텐츠 선택",
    description: "학습할 콘텐츠를 선택합니다",
    icon: "BookOpen",
    required: true,
    modes: ["full", "edit"],
    canEnter: (data): boolean => {
      // 템플릿 모드에서는 스킵
      const fullData = data as FullWizardData;
      return fullData.templateConfig?.planType !== "camp";
    },
    canProceed: (data): ValidationResult => {
      const fullData = data as FullWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (fullData.contents.studentContents.length === 0) {
        errors.push({
          field: "studentContents",
          message: "최소 1개 이상의 콘텐츠를 선택해주세요",
          severity: "error",
        });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "recommended-content",
    number: 5,
    label: "추천 콘텐츠",
    description: "AI가 추천하는 콘텐츠를 확인합니다",
    icon: "Sparkles",
    required: false,
    modes: ["full"],
  },
  {
    id: "final-review",
    number: 6,
    label: "최종 확인",
    description: "모든 설정을 확인하고 조정합니다",
    icon: "CheckCircle",
    required: true,
    modes: ["full", "edit", "template"],
  },
  {
    id: "result",
    number: 7,
    label: "결과",
    description: "생성된 플랜을 확인합니다",
    icon: "Trophy",
    required: true,
    modes: ["full", "edit", "template"],
  },
];

// ============================================
// Quick 모드 단계 정의 (3단계)
// ============================================

export const QUICK_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "content-selection",
    number: 1,
    label: "콘텐츠 선택",
    description: "학습할 내용을 선택합니다",
    icon: "BookOpen",
    required: true,
    modes: ["quick"],
    canProceed: (data): ValidationResult => {
      const quickData = data as QuickWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!quickData.content) {
        errors.push({ field: "content", message: "콘텐츠를 선택해주세요", severity: "error" });
      } else if (!quickData.content.title?.trim()) {
        errors.push({ field: "title", message: "제목을 입력해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "schedule",
    number: 2,
    label: "일정 설정",
    description: "날짜와 시간을 설정합니다",
    icon: "Calendar",
    required: true,
    modes: ["quick"],
    canProceed: (data): ValidationResult => {
      const quickData = data as QuickWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!quickData.schedule.planDate) {
        errors.push({ field: "planDate", message: "날짜를 선택해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "confirmation",
    number: 3,
    label: "확인",
    description: "설정을 확인하고 생성합니다",
    icon: "Check",
    required: true,
    modes: ["quick"],
  },
];

// ============================================
// ContentAdd 모드 단계 정의 (4단계)
// ============================================

export const CONTENT_ADD_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "content-selection",
    number: 1,
    label: "콘텐츠 선택",
    description: "추가할 콘텐츠를 선택합니다",
    icon: "BookOpen",
    required: true,
    modes: ["content-add"],
    canProceed: (data): ValidationResult => {
      const contentAddData = data as ContentAddWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!contentAddData.content) {
        errors.push({ field: "content", message: "콘텐츠를 선택해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "range-setting",
    number: 2,
    label: "범위 설정",
    description: "학습 범위를 설정합니다",
    icon: "Sliders",
    required: true,
    modes: ["content-add"],
    canProceed: (data): ValidationResult => {
      const contentAddData = data as ContentAddWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!contentAddData.range) {
        errors.push({ field: "range", message: "범위를 설정해주세요", severity: "error" });
      } else if (contentAddData.range.start >= contentAddData.range.end) {
        errors.push({ field: "range", message: "종료 범위가 시작보다 커야 합니다", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "study-type",
    number: 3,
    label: "학습 유형",
    description: "학습 유형을 선택합니다",
    icon: "Zap",
    required: true,
    modes: ["content-add"],
    canProceed: (data): ValidationResult => {
      const contentAddData = data as ContentAddWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!contentAddData.studyType) {
        errors.push({ field: "studyType", message: "학습 유형을 선택해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "preview",
    number: 4,
    label: "미리보기",
    description: "생성될 플랜을 확인합니다",
    icon: "Eye",
    required: true,
    modes: ["content-add"],
  },
];

// ============================================
// 관리자: 배치 플랜 위저드 단계 정의 (4단계)
// ============================================

export const BATCH_PLAN_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "content-recommendation",
    number: 1,
    label: "콘텐츠 추천",
    description: "각 참가자별 콘텐츠 추천 설정",
    icon: "Sparkles",
    required: true,
    modes: ["admin-batch-plan"],
    canProceed: (data): ValidationResult => {
      const batchData = data as BatchPlanWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!batchData.contentRecommendation) {
        errors.push({
          field: "contentRecommendation",
          message: "콘텐츠 추천 설정을 완료해주세요",
          severity: "error",
        });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "range-adjustment",
    number: 2,
    label: "범위 조절",
    description: "추천된 콘텐츠의 학습 범위 조절",
    icon: "Sliders",
    required: true,
    modes: ["admin-batch-plan"],
  },
  {
    id: "plan-preview",
    number: 3,
    label: "플랜 미리보기",
    description: "생성될 플랜 확인 및 선택",
    icon: "Eye",
    required: true,
    modes: ["admin-batch-plan"],
    canProceed: (data): ValidationResult => {
      const batchData = data as BatchPlanWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];
      const warnings: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!batchData.planPreview?.selectedGroupIds || batchData.planPreview.selectedGroupIds.size === 0) {
        errors.push({
          field: "selectedGroupIds",
          message: "플랜을 생성할 참가자를 1명 이상 선택해주세요",
          severity: "error",
        });
      }

      // 미리보기 결과에 에러가 있는지 확인
      if (batchData.planPreview?.previewResults) {
        const errorCount = Object.values(batchData.planPreview.previewResults).filter(r => r.error).length;
        if (errorCount > 0) {
          warnings.push({
            field: "previewResults",
            message: `${errorCount}명의 참가자에게 미리보기 오류가 있습니다`,
            severity: "warning",
          });
        }
      }

      return { isValid: errors.length === 0, errors, warnings };
    },
  },
  {
    id: "results",
    number: 4,
    label: "결과",
    description: "배치 작업 결과 확인",
    icon: "CheckCircle",
    required: true,
    modes: ["admin-batch-plan"],
  },
];

// ============================================
// 관리자: 일정 재조정 위저드 단계 정의 (3단계)
// ============================================

export const RESCHEDULE_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "date-range",
    number: 1,
    label: "날짜 범위",
    description: "재조정할 기간 선택",
    icon: "Calendar",
    required: true,
    modes: ["admin-reschedule"],
    canProceed: (data): ValidationResult => {
      const rescheduleData = data as RescheduleWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!rescheduleData.dateRange) {
        errors.push({
          field: "dateRange",
          message: "재조정할 기간을 선택해주세요",
          severity: "error",
        });
      } else {
        if (!rescheduleData.dateRange.from) {
          errors.push({ field: "from", message: "시작일을 선택해주세요", severity: "error" });
        }
        if (!rescheduleData.dateRange.to) {
          errors.push({ field: "to", message: "종료일을 선택해주세요", severity: "error" });
        }
        if (rescheduleData.dateRange.from && rescheduleData.dateRange.to) {
          if (new Date(rescheduleData.dateRange.from) > new Date(rescheduleData.dateRange.to)) {
            errors.push({ field: "dateRange", message: "종료일이 시작일보다 빠릅니다", severity: "error" });
          }
        }
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "content-adjustment",
    number: 2,
    label: "콘텐츠 조정",
    description: "콘텐츠별 재조정 방식 설정",
    icon: "Settings",
    required: true,
    modes: ["admin-reschedule"],
  },
  {
    id: "preview-apply",
    number: 3,
    label: "미리보기 및 적용",
    description: "변경사항 확인 후 적용",
    icon: "PlayCircle",
    required: true,
    modes: ["admin-reschedule"],
  },
];

// ============================================
// 관리자: 캠프 템플릿 위저드 단계 정의 (5단계)
// ============================================

export const CAMP_TEMPLATE_MODE_STEPS: WizardStepDefinition[] = [
  {
    id: "basic-info",
    number: 1,
    label: "기본 정보",
    description: "템플릿 이름 및 유형 설정",
    icon: "FileText",
    required: true,
    modes: ["admin-camp-template"],
    canProceed: (data): ValidationResult => {
      const templateData = data as CampTemplateWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!templateData.basicInfo?.name?.trim()) {
        errors.push({ field: "name", message: "템플릿 이름을 입력해주세요", severity: "error" });
      }
      if (!templateData.basicInfo?.programType) {
        errors.push({ field: "programType", message: "프로그램 유형을 선택해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "period-settings",
    number: 2,
    label: "기간 설정",
    description: "캠프 기간 및 일정 설정",
    icon: "Calendar",
    required: true,
    modes: ["admin-camp-template"],
    canProceed: (data): ValidationResult => {
      const templateData = data as CampTemplateWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!templateData.periodSettings?.startDate) {
        errors.push({ field: "startDate", message: "시작일을 선택해주세요", severity: "error" });
      }
      if (!templateData.periodSettings?.endDate) {
        errors.push({ field: "endDate", message: "종료일을 선택해주세요", severity: "error" });
      }
      if (!templateData.periodSettings?.weekdays?.length) {
        errors.push({ field: "weekdays", message: "진행 요일을 1개 이상 선택해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "time-block-settings",
    number: 3,
    label: "시간 블록",
    description: "일일 시간표 및 세션 설정",
    icon: "Clock",
    required: true,
    modes: ["admin-camp-template"],
    canProceed: (data): ValidationResult => {
      const templateData = data as CampTemplateWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!templateData.timeBlockSettings?.dailyStartTime) {
        errors.push({ field: "dailyStartTime", message: "시작 시간을 설정해주세요", severity: "error" });
      }
      if (!templateData.timeBlockSettings?.dailyEndTime) {
        errors.push({ field: "dailyEndTime", message: "종료 시간을 설정해주세요", severity: "error" });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
  {
    id: "content-presets",
    number: 4,
    label: "콘텐츠 프리셋",
    description: "기본 콘텐츠 추천 설정",
    icon: "BookOpen",
    required: false,
    modes: ["admin-camp-template"],
  },
  {
    id: "review",
    number: 5,
    label: "검토 및 완료",
    description: "설정 확인 후 템플릿 생성",
    icon: "CheckCircle",
    required: true,
    modes: ["admin-camp-template"],
    canProceed: (data): ValidationResult => {
      const templateData = data as CampTemplateWizardData;
      const errors: { field: string; message: string; severity: "error" | "warning" }[] = [];

      if (!templateData.review?.isConfirmed) {
        errors.push({
          field: "isConfirmed",
          message: "설정을 확인하고 체크박스를 선택해주세요",
          severity: "error",
        });
      }

      return { isValid: errors.length === 0, errors, warnings: [] };
    },
  },
];

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 모드에 따른 단계 정의 반환
 */
export function getStepsForMode(mode: WizardMode): WizardStepDefinition[] {
  switch (mode) {
    case "full":
    case "edit":
    case "template":
      return FULL_MODE_STEPS.filter(
        (step) => !step.modes || step.modes.includes(mode)
      );
    case "quick":
      return QUICK_MODE_STEPS;
    case "content-add":
      return CONTENT_ADD_MODE_STEPS;
    // 관리자 모드
    case "admin-batch-plan":
      return BATCH_PLAN_MODE_STEPS;
    case "admin-reschedule":
      return RESCHEDULE_MODE_STEPS;
    case "admin-camp-template":
      return CAMP_TEMPLATE_MODE_STEPS;
    default:
      return FULL_MODE_STEPS;
  }
}

/**
 * 단계 ID로 단계 찾기
 */
export function findStepById(
  steps: WizardStepDefinition[],
  stepId: string
): WizardStepDefinition | null {
  return steps.find((s) => s.id === stepId) || null;
}

/**
 * 다음 단계 가져오기
 */
export function getNextStep(
  steps: WizardStepDefinition[],
  currentStepId: string
): WizardStepDefinition | null {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  if (currentIndex === -1 || currentIndex >= steps.length - 1) {
    return null;
  }
  return steps[currentIndex + 1];
}

/**
 * 이전 단계 가져오기
 */
export function getPrevStep(
  steps: WizardStepDefinition[],
  currentStepId: string
): WizardStepDefinition | null {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);
  if (currentIndex <= 0) {
    return null;
  }
  return steps[currentIndex - 1];
}

/**
 * 첫 번째 단계 ID 가져오기
 */
export function getFirstStepId(mode: WizardMode): string {
  const steps = getStepsForMode(mode);
  return steps[0]?.id || "basic-info";
}

/**
 * 단계 번호로 단계 ID 가져오기
 */
export function getStepIdByNumber(mode: WizardMode, number: number): string | null {
  const steps = getStepsForMode(mode);
  const step = steps.find((s) => s.number === number);
  return step?.id || null;
}
