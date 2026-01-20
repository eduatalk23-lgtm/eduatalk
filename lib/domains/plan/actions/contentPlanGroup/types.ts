/**
 * Content-based PlanGroup Types
 *
 * 콘텐츠별 플랜그룹 관련 타입 정의
 */

import type { StudyType } from "@/lib/types/plan";
import type { InvalidationHint } from "@/lib/query/keys";

// ============================================
// Constants
// ============================================

export const MAX_CONTENT_PLAN_GROUPS = 9;
export const MAX_CONTENTS_PER_PLAN_GROUP = 10;

// ============================================
// Types
// ============================================

export type PlanGroupSummary = {
  id: string;
  name: string;
  progressPercent: number;
  canComplete: boolean;
};

export type QuickCreateInput = {
  content: {
    type: "book" | "lecture" | "custom";
    id: string;
    name: string;
    subject?: string;
    subjectCategory?: string;
    totalUnits?: number; // 총 페이지/회차
  };
  range: {
    start: number;
    end: number;
    unit: "page" | "episode" | "chapter" | "unit";
  };
  schedule: {
    startDate: string;
    endDate: string;
    weekdays: number[]; // 0-6 (일-토)
    studyType: StudyType;
    reviewEnabled?: boolean;
    /** 복습 설정 모드: inherit(캘린더 설정 따르기) | custom(새로 설정) */
    reviewMode?: "inherit" | "custom";
    /** custom 모드일 때 복습 요일 (0-6, 일-토) */
    reviewDayOfWeek?: number;
  };
};

export type CreateQuickPlanInput = {
  title: string;
  planDate: string; // YYYY-MM-DD
  estimatedMinutes?: number;
  contentId?: string;
  contentType?: "book" | "lecture" | "custom" | "free";
  contentTitle?: string;
  rangeStart?: number;
  rangeEnd?: number;
  containerType?: "daily" | "weekly";
  isFreeLearning?: boolean;
  freeLearningType?: string;
  /**
   * 대상 학생 ID (관리자가 학생 대신 생성 시 사용)
   * 학생이 직접 호출 시 생략하면 본인 ID 자동 사용
   */
  studentId?: string;
  /**
   * 플래너 ID (옵션)
   * 생략 시 기본 플래너 자동 생성/사용
   */
  plannerId?: string;
  /**
   * 플랜 그룹 ID (옵션)
   * 캘린더 UI에서 특정 Plan Group이 이미 선택된 경우 사용
   * 생략 시 Planner 기반으로 자동 선택/생성
   */
  planGroupId?: string;
  /**
   * 시작 시간 (HH:mm)
   */
  startTime?: string;
  /**
   * 종료 시간 (HH:mm)
   */
  endTime?: string;
  /**
   * 설명
   */
  description?: string;
  /**
   * 태그
   */
  tags?: string[];
  /**
   * 색상
   */
  color?: string;
  /**
   * 아이콘
   */
  icon?: string;
  /**
   * 우선순위
   */
  priority?: number;
};

export type CreateQuickPlanResult = {
  success: boolean;
  planId?: string;
  planGroupId?: string;
  flexibleContentId?: string;
  error?: string;
  /** React Query 캐시 무효화 힌트 (클라이언트에서 자동 처리) */
  invalidationHints?: InvalidationHint[];
};

export type AddContentToCalendarOnlyInput = {
  planGroupId: string;
  content: {
    id: string;
    type: "book" | "lecture" | "custom";
    name: string;
    totalUnits?: number;
    subject?: string;
    subjectCategory?: string;
    masterContentId?: string;
  };
  range: {
    start: number;
    end: number;
    unit: "page" | "episode" | "chapter" | "unit" | "day";
  };
  studyType: {
    type: StudyType;
    daysPerWeek?: 2 | 3 | 4;
    reviewEnabled?: boolean;
    preferredDays?: number[];
  };
};

export type DefaultRecommendation = {
  recommendedDuration: number;
  recommendedDailyAmount: number;
  recommendedWeekdays: number[];
  studyType: StudyType;
  estimatedEndDate: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
};

export type ReviewDate = {
  date: Date;
  weekNumber: number;
  plansToReview: Date[];
};

/**
 * 복습 설정 타입
 * 사용자가 복습일 설정 방식을 선택할 수 있도록 함
 */
export type ReviewSettings = {
  /** 복습 설정 모드: inherit(캘린더 설정 따르기) | custom(새로 설정) */
  mode: "inherit" | "custom";
  /** 복습 활성화 여부 */
  enabled: boolean;
  /** custom 모드일 때 복습 요일 (0-6, 일-토) */
  customDayOfWeek?: number;
};

// ============================================
// Admin Quick Create Types
// ============================================

/**
 * 관리자가 학생을 대신하여 빠른 플랜을 생성할 때 사용하는 입력 타입
 */
export type CreateQuickPlanForStudentInput = CreateQuickPlanInput & {
  /** 대상 학생 ID (필수) */
  studentId: string;
  /** 테넌트 ID (옵션 - 없으면 관리자의 테넌트 사용) */
  tenantId?: string;
  /** 플래너 ID (필수 - Plan Group 자동 선택/생성 시 사용) */
  plannerId: string;
};

/**
 * 관리자 빠른 플랜 생성 결과
 */
export type CreateQuickPlanForStudentResult = CreateQuickPlanResult & {
  /** 대상 학생 ID */
  studentId?: string;
};
