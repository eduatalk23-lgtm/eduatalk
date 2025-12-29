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
