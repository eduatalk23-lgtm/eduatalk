/**
 * Content-based PlanGroup Types
 *
 * 콘텐츠별 플랜그룹 관련 타입 정의
 */

import type { StudyType } from "@/lib/types/plan";

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
};

export type CreateQuickPlanResult = {
  success: boolean;
  planId?: string;
  planGroupId?: string;
  flexibleContentId?: string;
  error?: string;
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
