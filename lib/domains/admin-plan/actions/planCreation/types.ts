/**
 * 플랜 생성 공통 타입 정의
 *
 * 모든 플랜 생성 액션에서 사용되는 공통 인터페이스와 타입
 * plannerId를 필수로 강제하여 플래너 우선 생성 원칙을 구현
 *
 * @module lib/domains/admin-plan/actions/planCreation/types
 */

import type { TimeRange } from "@/lib/scheduler/calculateAvailableDates";

// ============================================
// 기본 타입
// ============================================

/**
 * 모든 플랜 생성 작업에 필요한 기본 입력값
 * plannerId를 필수로 하여 플래너 없이 플랜 생성 불가
 */
export interface BasePlanCreationInput {
  /** 테넌트 ID - 멀티테넌트 격리를 위해 필수 */
  tenantId: string;
  /** 학생 ID - 플랜 대상 학생 */
  studentId: string;
  /** 플래너 ID - 모든 플랜 생성에 필수 */
  plannerId: string;
  /** 대상 날짜 */
  targetDate: string;
}

/**
 * 플랜 생성 결과 공통 타입
 */
export interface PlanCreationResult<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

// ============================================
// 플래너 검증 타입
// ============================================

/**
 * 플래너 검증 결과
 */
export interface PlannerValidationResult {
  success: boolean;
  error?: string;
  planner?: ValidatedPlanner;
}

/**
 * 검증된 플래너 정보
 * 플랜 생성 시 필요한 플래너 설정값 포함
 */
export interface ValidatedPlanner {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  blockSetId: string | null;
  defaultSchedulerType: string;
  defaultSchedulerOptions: Record<string, unknown>;
  studyHours: TimeRange | null;
  selfStudyHours: TimeRange | null;
  lunchTime: TimeRange | null;
  nonStudyTimeBlocks: unknown[];
}

// ============================================
// 빠른 플랜 생성 타입
// ============================================

/**
 * 빠른 플랜 생성 입력
 */
export interface QuickPlanCreationInput extends BasePlanCreationInput {
  /** 플랜 제목 */
  title: string;
  /** 예상 소요 시간 (분) */
  estimatedMinutes?: number;
  /** 콘텐츠 타입 */
  contentType?: string;
  /** 자유학습 타입 */
  freeLearningType?: string;
  /** 컨테이너 타입 */
  containerType?: "daily" | "weekly";
}

/**
 * 빠른 플랜 생성 결과
 */
export interface QuickPlanCreationResult {
  planGroupId: string;
  planId: string;
}

// ============================================
// 단발성 플랜 생성 타입
// ============================================

/**
 * 단발성 플랜 생성 입력
 */
export interface AdHocPlanCreationInput extends BasePlanCreationInput {
  /** 플랜 제목 */
  title: string;
  /** 설명 */
  description?: string;
  /** 예상 소요 시간 (분) */
  estimatedMinutes?: number;
  /** 플랜 그룹 ID - 없으면 플래너에서 자동 생성 */
  planGroupId?: string;
  /** 컨테이너 타입 */
  containerType?: "daily" | "weekly";
}

/**
 * 단발성 플랜 생성 결과
 */
export interface AdHocPlanCreationResult {
  planGroupId: string;
  planId: string;
}

// ============================================
// 콘텐츠 기반 플랜 생성 타입
// ============================================

/**
 * 콘텐츠 기반 플랜 생성 입력
 */
export interface ContentPlanCreationInput extends BasePlanCreationInput {
  /** 유연한 콘텐츠 ID */
  flexibleContentId: string;
  /** 콘텐츠 제목 */
  contentTitle: string;
  /** 과목 */
  contentSubject?: string | null;
  /** 범위 시작 */
  rangeStart?: number | null;
  /** 범위 끝 */
  rangeEnd?: number | null;
  /** 배치 모드 */
  distributionMode: "today" | "weekly" | "period";
  /** 기간 종료일 (period 모드에서 사용) */
  periodEndDate?: string;
  /** 플랜 그룹 ID - 없으면 자동 생성 */
  planGroupId?: string;
}

/**
 * 콘텐츠 기반 플랜 생성 결과
 */
export interface ContentPlanCreationResult {
  planGroupId: string;
  planIds: string[];
}

// ============================================
// AI 플랜 생성 타입
// ============================================

/**
 * AI 플랜 생성 입력
 */
export interface AIPlanCreationInput extends BasePlanCreationInput {
  /** 플랜 그룹 ID - AI 생성은 기존 그룹에만 가능 */
  planGroupId: string;
  /** 컨텍스트 데이터 */
  contextData: {
    contents: ContentInfo[];
    scores?: ScoreInfo[];
  };
  /** 추가 프롬프트 */
  prompt?: string;
}

/**
 * 콘텐츠 정보 (AI 플랜 생성용)
 */
export interface ContentInfo {
  id: string;
  title: string;
  subject?: string;
  estimatedMinutes?: number;
}

/**
 * 점수 정보 (AI 플랜 생성용)
 */
export interface ScoreInfo {
  subject: string;
  score: number;
  date: string;
}

/**
 * AI 플랜 생성 결과
 */
export interface AIPlanCreationResult {
  planGroupId: string;
  planIds: string[];
  generatedCount: number;
}

// ============================================
// Plan Group 선택 타입
// ============================================

/**
 * Plan Group 선택 결과
 */
export interface PlanGroupSelectorResult {
  status: "found" | "not-found" | "multiple" | "error";
  planGroupId?: string;
  planGroups?: PlanGroupInfo[];
  message?: string;
}

/**
 * Plan Group 정보
 */
export interface PlanGroupInfo {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
}
