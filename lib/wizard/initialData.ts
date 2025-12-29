/**
 * 위저드 초기 데이터 생성
 *
 * 각 모드별 초기 데이터를 생성하는 팩토리 함수
 *
 * @module lib/wizard/initialData
 */

import type {
  FullWizardData,
  QuickWizardData,
  ContentAddWizardData,
  InheritedTemplateSettings,
  BatchPlanWizardData,
  RescheduleWizardData,
  CampTemplateWizardData,
  AdminParticipant,
} from "./types";

// ============================================
// Full 모드 초기 데이터
// ============================================

export interface CreateFullWizardDataOptions {
  /** 편집 모드인 경우 기존 데이터 */
  existingData?: Partial<FullWizardData>;
  /** 템플릿 모드 설정 */
  templateConfig?: FullWizardData["templateConfig"];
  /** 기본 blockSetId */
  defaultBlockSetId?: string;
}

/**
 * Full 모드 위저드 초기 데이터 생성
 */
export function createFullWizardData(
  options: CreateFullWizardDataOptions = {}
): FullWizardData {
  const { existingData, templateConfig, defaultBlockSetId } = options;
  const now = new Date().toISOString();

  const mode = templateConfig?.planType === "camp" ? "template" : existingData ? "edit" : "full";

  return {
    mode,
    currentStepId: "basic-info",
    visitedSteps: ["basic-info"],
    meta: {
      createdAt: existingData?.meta?.createdAt || now,
      updatedAt: now,
      draftId: existingData?.meta?.draftId || null,
      isDirty: false,
    },
    basicInfo: {
      name: existingData?.basicInfo?.name || "",
      planPurpose: existingData?.basicInfo?.planPurpose || "",
      periodStart: existingData?.basicInfo?.periodStart || "",
      periodEnd: existingData?.basicInfo?.periodEnd || "",
      targetDate: existingData?.basicInfo?.targetDate,
      blockSetId: existingData?.basicInfo?.blockSetId || defaultBlockSetId || "",
      schedulerType: existingData?.basicInfo?.schedulerType || "",
    },
    schedule: {
      exclusions: existingData?.schedule?.exclusions || [],
      academySchedules: existingData?.schedule?.academySchedules || [],
      timeSettings: existingData?.schedule?.timeSettings,
    },
    contents: {
      studentContents: existingData?.contents?.studentContents || [],
      recommendedContents: existingData?.contents?.recommendedContents || [],
    },
    options: {
      studyReviewCycle: existingData?.options?.studyReviewCycle,
      studentLevel: existingData?.options?.studentLevel,
      subjectAllocations: existingData?.options?.subjectAllocations,
      contentAllocations: existingData?.options?.contentAllocations,
    },
    templateConfig: templateConfig || existingData?.templateConfig,
  };
}

// ============================================
// Quick 모드 초기 데이터
// ============================================

export interface CreateQuickWizardDataOptions {
  /** 기본 날짜 (기본값: 오늘) */
  defaultDate?: string;
  /** 미리 선택된 콘텐츠 */
  preselectedContent?: QuickWizardData["content"];
}

/**
 * Quick 모드 위저드 초기 데이터 생성
 */
export function createQuickWizardData(
  options: CreateQuickWizardDataOptions = {}
): QuickWizardData {
  const { defaultDate, preselectedContent } = options;
  const now = new Date().toISOString();
  const today = defaultDate || new Date().toISOString().split("T")[0];

  return {
    mode: "quick",
    currentStepId: "content-selection",
    visitedSteps: ["content-selection"],
    meta: {
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    },
    content: preselectedContent || null,
    schedule: {
      planDate: today,
      startTime: undefined,
      endTime: undefined,
      repeatType: "none",
      repeatEndDate: undefined,
      repeatDays: undefined,
    },
  };
}

// ============================================
// ContentAdd 모드 초기 데이터
// ============================================

export interface CreateContentAddWizardDataOptions {
  /** 템플릿 ID (필수) */
  templateId: string;
  /** 템플릿에서 상속받은 설정 */
  templateSettings?: InheritedTemplateSettings;
  /** 미리 선택된 콘텐츠 */
  preselectedContent?: ContentAddWizardData["content"];
}

/**
 * ContentAdd 모드 위저드 초기 데이터 생성
 */
export function createContentAddWizardData(
  options: CreateContentAddWizardDataOptions
): ContentAddWizardData {
  const { templateId, templateSettings, preselectedContent } = options;
  const now = new Date().toISOString();

  return {
    mode: "content-add",
    currentStepId: "content-selection",
    visitedSteps: ["content-selection"],
    meta: {
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    },
    templateId,
    templateSettings,
    content: preselectedContent || null,
    range: null,
    studyType: null,
    overrides: undefined,
  };
}

// ============================================
// 관리자: 배치 플랜 위저드 초기 데이터
// ============================================

export interface CreateBatchPlanWizardDataOptions {
  /** 템플릿 ID */
  templateId: string;
  /** 참가자 목록 */
  participants: AdminParticipant[];
}

/**
 * 배치 플랜 위저드 초기 데이터 생성
 */
export function createBatchPlanWizardData(
  options: CreateBatchPlanWizardDataOptions
): BatchPlanWizardData {
  const { templateId, participants } = options;
  const now = new Date().toISOString();

  return {
    mode: "admin-batch-plan",
    currentStepId: "content-recommendation",
    visitedSteps: ["content-recommendation"],
    meta: {
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    },
    templateId,
    participants,
    contentRecommendation: null,
    rangeAdjustments: null,
    planPreview: null,
    results: null,
  };
}

// ============================================
// 관리자: 일정 재조정 위저드 초기 데이터
// ============================================

export interface CreateRescheduleWizardDataOptions {
  /** 그룹 ID */
  groupId: string;
  /** 템플릿 ID */
  templateId: string;
  /** 초기 날짜 범위 */
  initialDateRange?: {
    from: string;
    to: string;
  };
}

/**
 * 일정 재조정 위저드 초기 데이터 생성
 */
export function createRescheduleWizardData(
  options: CreateRescheduleWizardDataOptions
): RescheduleWizardData {
  const { groupId, templateId, initialDateRange } = options;
  const now = new Date().toISOString();

  return {
    mode: "admin-reschedule",
    currentStepId: "date-range",
    visitedSteps: ["date-range"],
    meta: {
      createdAt: now,
      updatedAt: now,
      isDirty: false,
    },
    groupId,
    templateId,
    dateRange: initialDateRange
      ? {
          from: initialDateRange.from,
          to: initialDateRange.to,
          includeToday: false,
        }
      : null,
    contentAdjustments: null,
    previewResult: null,
  };
}

// ============================================
// 관리자: 캠프 템플릿 위저드 초기 데이터
// ============================================

export interface CreateCampTemplateWizardDataOptions {
  /** 기존 템플릿 ID (수정 시) */
  existingTemplateId?: string;
  /** 기존 데이터 (수정 시) */
  existingData?: Partial<CampTemplateWizardData>;
}

/**
 * 캠프 템플릿 위저드 초기 데이터 생성
 */
export function createCampTemplateWizardData(
  options: CreateCampTemplateWizardDataOptions = {}
): CampTemplateWizardData {
  const { existingTemplateId, existingData } = options;
  const now = new Date().toISOString();

  return {
    mode: "admin-camp-template",
    currentStepId: "basic-info",
    visitedSteps: ["basic-info"],
    meta: {
      createdAt: existingData?.meta?.createdAt || now,
      updatedAt: now,
      isDirty: false,
    },
    existingTemplateId,
    basicInfo: existingData?.basicInfo || null,
    periodSettings: existingData?.periodSettings || null,
    timeBlockSettings: existingData?.timeBlockSettings || null,
    contentPresets: existingData?.contentPresets || null,
    review: null,
  };
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 드래프트에서 위저드 데이터 복원
 */
export function restoreFromDraft<T extends FullWizardData | QuickWizardData | ContentAddWizardData>(
  draftData: Partial<T>,
  mode: T["mode"]
): T {
  const now = new Date().toISOString();

  switch (mode) {
    case "full":
    case "edit":
    case "template":
      return createFullWizardData({
        existingData: draftData as unknown as Partial<FullWizardData>,
      }) as unknown as T;
    case "quick": {
      const quickData = draftData as unknown as Partial<QuickWizardData>;
      return {
        ...createQuickWizardData(),
        ...quickData,
        meta: {
          ...(quickData.meta || {}),
          createdAt: quickData.meta?.createdAt || now,
          updatedAt: now,
          isDirty: false,
        },
      } as unknown as T;
    }
    case "content-add": {
      const contentAddData = draftData as unknown as Partial<ContentAddWizardData>;
      return {
        ...createContentAddWizardData({
          templateId: contentAddData.templateId || "",
        }),
        ...contentAddData,
        meta: {
          ...(contentAddData.meta || {}),
          createdAt: contentAddData.meta?.createdAt || now,
          updatedAt: now,
          isDirty: false,
        },
      } as unknown as T;
    }
    default:
      throw new Error(`Unknown wizard mode: ${mode}`);
  }
}

/**
 * 위저드 데이터를 저장 가능한 형태로 직렬화
 */
export function serializeWizardData<T extends FullWizardData | QuickWizardData | ContentAddWizardData>(
  data: T
): string {
  return JSON.stringify(data);
}

/**
 * 저장된 데이터를 위저드 데이터로 역직렬화
 */
export function deserializeWizardData<T extends FullWizardData | QuickWizardData | ContentAddWizardData>(
  serialized: string
): T | null {
  try {
    return JSON.parse(serialized) as T;
  } catch {
    return null;
  }
}
