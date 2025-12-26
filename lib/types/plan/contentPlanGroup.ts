/**
 * Content-based PlanGroup Types
 *
 * 콘텐츠별 플랜그룹 생성을 위한 타입 정의
 * - 4단계 간소화 플로우 (콘텐츠 → 범위 → 학습유형 → 미리보기)
 * - 템플릿(위저드) 플랜그룹에서 설정 상속
 * - 전략/취약 과목 배분
 */

import type { PlanGroup, SchedulerOptions } from './domain';

// ============================================================
// 기본 타입
// ============================================================

/**
 * 학습 유형
 * - strategy: 전략 과목 (주 N일만 학습)
 * - weakness: 취약 과목 (매일 학습)
 */
export type StudyType = 'strategy' | 'weakness';

/**
 * 플랜그룹 생성 모드
 * - wizard: 7단계 위저드 (기존)
 * - content_based: 4단계 콘텐츠별 생성 (신규)
 * - template: 템플릿
 * - camp: 캠프
 */
export type CreationMode = 'wizard' | 'content_based' | 'template' | 'camp';

/**
 * 범위 단위
 */
export type RangeUnit = 'page' | 'episode' | 'day' | 'chapter' | 'unit';

// ============================================================
// 템플릿 상속 설정
// ============================================================

/**
 * 템플릿(위저드 플랜그룹)에서 상속받는 설정값
 */
export interface InheritedTemplateSettings {
  /** 학습 기간 */
  period: {
    startDate: string; // YYYY-MM-DD
    endDate: string;
  };
  /** 학습 요일 (0-6, 0=일요일) */
  weekdays: number[];
  /** 블록세트 ID */
  blockSetId: string | null;
  /** 학습 시간 설정 */
  studyHours: unknown | null;
  /** 자율학습 시간 */
  selfStudyHours: unknown | null;
  /** 제외일 목록 */
  exclusions: Array<{
    date: string;
    reason: string;
  }>;
  /** 스케줄러 옵션 */
  schedulerOptions: SchedulerOptions | null;
  /** 학습/복습 주기 */
  studyReviewCycle?: {
    studyDays: number;
    reviewDays: number;
  };
}

// ============================================================
// 콘텐츠별 플랜그룹 생성 입력
// ============================================================

/**
 * 콘텐츠별 플랜그룹 생성 입력
 * 4단계 위저드에서 수집하는 데이터
 */
export interface CreateContentPlanGroupInput {
  /**
   * Step 0: 템플릿 참조
   * 설정을 상속받을 위저드 플랜그룹 ID
   */
  templatePlanGroupId: string;

  /**
   * Step 1: 콘텐츠 선택
   */
  content: {
    id: string;
    type: 'book' | 'lecture' | 'custom';
    name: string;
    /** 총 분량 (페이지 수 또는 에피소드 수) */
    totalUnits?: number;
    /** 과목명 */
    subject?: string;
    /** 과목 카테고리 */
    subjectCategory?: string;
  };

  /**
   * Step 2: 범위 설정
   */
  range: {
    start: number;
    end: number;
    unit: RangeUnit;
    /** 상세 범위 (대단원/중단원 선택 시) */
    detailStartId?: string;
    detailEndId?: string;
  };

  /**
   * Step 3: 학습 유형 선택
   */
  studyType: {
    type: StudyType;
    /** 전략 과목일 때: 주당 학습일 (2-4) */
    daysPerWeek?: 2 | 3 | 4;
    /** 선호하는 요일 (0-6) */
    preferredDays?: number[];
    /** 주간 복습 활성화 (매주 토요일 복습 플랜 생성) */
    reviewEnabled?: boolean;
  };

  /**
   * Step 4: 템플릿 설정 오버라이드 (선택적)
   */
  overrides?: {
    period?: {
      startDate: string;
      endDate: string;
    };
    weekdays?: number[];
    blockSetId?: string;
  };
}

// ============================================================
// 콘텐츠별 플랜그룹 생성 결과
// ============================================================

/**
 * 생성된 플랜 정보
 */
export interface GeneratedPlan {
  id: string;
  date: string; // YYYY-MM-DD
  rangeStart: number;
  rangeEnd: number;
  status: 'pending' | 'in_progress' | 'completed';
  containerType: 'daily' | 'weekly';
  estimatedDuration?: number; // 분
}

/**
 * 콘텐츠별 플랜그룹 생성 결과
 */
export interface ContentPlanGroupResult {
  success: boolean;
  /** 생성된 플랜그룹 */
  planGroup?: PlanGroup & {
    template_plan_group_id: string;
    study_type: StudyType;
    strategy_days_per_week: number | null;
    creation_mode: 'content_based';
  };
  /** 생성된 플랜 목록 */
  plans?: GeneratedPlan[];
  /** 요약 정보 */
  summary?: ContentPlanGroupSummary;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 플랜그룹 생성 요약
 */
export interface ContentPlanGroupSummary {
  /** 총 플랜 수 */
  totalPlans: number;
  /** 학습일 수 */
  studyDays: number;
  /** 복습일 수 */
  reviewDays: number;
  /** 일일 평균 분량 */
  dailyAmount: number;
  /** 예상 완료일 */
  estimatedEndDate: string;
  /** 총 분량 */
  totalRange: number;
}

// ============================================================
// 미리보기
// ============================================================

/**
 * 플랜 미리보기 항목
 */
export interface PlanPreviewItem {
  date: string;
  dayType: 'study' | 'review';
  dayOfWeek: number; // 0-6
  rangeStart: number;
  rangeEnd: number;
  estimatedDuration: number; // 분
  weekNumber: number;
}

/**
 * 콘텐츠별 플랜그룹 미리보기
 */
export interface ContentPlanGroupPreview {
  /** 템플릿에서 상속된 설정 */
  inheritedSettings: InheritedTemplateSettings;
  /** 계산된 분배 정보 */
  distribution: {
    totalDays: number;
    studyDays: number;
    reviewDays: number;
    dailyAmount: number;
    weeklyAmount?: number;
  };
  /** 플랜 미리보기 목록 */
  planPreviews: PlanPreviewItem[];
  /** 경고 메시지 */
  warnings: string[];
  /** 정보 메시지 */
  info: string[];
}

// ============================================================
// 9개 제한 관리
// ============================================================

/**
 * 콘텐츠별 플랜그룹 개수 정보
 */
export interface ContentPlanGroupCount {
  /** 현재 활성 개수 */
  current: number;
  /** 최대 개수 (항상 9) */
  max: 9;
  /** 추가 가능 여부 */
  canAdd: boolean;
  /** 남은 슬롯 수 */
  remaining: number;
}

// ============================================================
// 확장된 PlanGroup 타입
// ============================================================

/**
 * 콘텐츠 기반 플랜그룹 (확장 필드 포함)
 */
export type ContentBasedPlanGroup = PlanGroup & {
  /** 템플릿 플랜그룹 참조 */
  template_plan_group_id: string | null;
  /** 학습 유형 */
  study_type: StudyType | null;
  /** 전략 과목 주당 학습일 */
  strategy_days_per_week: number | null;
  /** 생성 모드 */
  creation_mode: CreationMode;
};

// ============================================================
// 액션 파라미터
// ============================================================

/**
 * 템플릿 설정 조회 파라미터
 */
export interface GetTemplateSettingsParams {
  templatePlanGroupId: string;
  /** 템플릿의 제외일 포함 여부 */
  includeExclusions?: boolean;
  /** 템플릿의 학원 일정 포함 여부 */
  includeAcademySchedules?: boolean;
}

/**
 * 미리보기 생성 파라미터
 */
export interface PreviewContentPlanGroupParams extends CreateContentPlanGroupInput {
  /** 미리보기 플랜 최대 개수 (기본: 전체) */
  maxPreviewPlans?: number;
}
