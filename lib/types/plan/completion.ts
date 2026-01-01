/**
 * 플랜 완료 모드 관련 타입 정의
 *
 * 두 가지 완료 방식을 지원합니다:
 * - timer: 타이머를 사용한 완료 (학습 시간 추적)
 * - simple: 체크박스만으로 완료 (시간 추적 없음)
 */

import type { Tables } from "@/lib/supabase/database.types";

// ============================================
// 완료 모드 타입
// ============================================

/**
 * 플랜 완료 모드
 * - timer: 타이머 기반 완료 (기존 방식)
 * - simple: 체크박스 기반 간단 완료 (신규)
 */
export type CompletionMode = "timer" | "simple";

/**
 * 간단 완료 데이터
 */
export interface SimpleCompletionData {
  completedAt: Date;
  note?: string;
  completedBy: "student" | "admin";
}

/**
 * 타이머 완료 데이터
 */
export interface TimerCompletionData {
  startedAt: Date;
  pausedAt?: Date;
  completedAt: Date;
  totalDuration: number; // 총 학습 시간 (초)
  pausedDuration: number; // 일시정지 시간 (초)
  effectiveDuration: number; // 실제 학습 시간 (초)
}

/**
 * 완료 정보 유니온 타입
 */
export type CompletionInfo =
  | { mode: "simple"; data: SimpleCompletionData }
  | { mode: "timer"; data: TimerCompletionData }
  | { mode: "none"; data: null };

// ============================================
// 학생 권한 타입
// ============================================

/**
 * 학생 플랜 권한 설정
 * plan_groups.student_permissions JSONB 필드에 저장
 */
export interface StudentPlanPermissions {
  /** 단발성 플랜 추가 가능 여부 */
  canAddAdHoc: boolean;
  /** 메모 편집 가능 여부 */
  canEditMemo: boolean;
  /** 플랜 이동 가능 여부 */
  canMovePlans: boolean;
  /** 색상 변경 가능 여부 */
  canChangeColor: boolean;
  /** 완료 처리 가능 여부 */
  canComplete: boolean;
}

/**
 * 기본 학생 권한
 */
export const DEFAULT_STUDENT_PERMISSIONS: StudentPlanPermissions = {
  canAddAdHoc: true,
  canEditMemo: true,
  canMovePlans: false,
  canChangeColor: true,
  canComplete: true,
};

// ============================================
// 유틸리티 함수
// ============================================

type StudentPlan = Tables<"student_plan">;
type AdHocPlan = Tables<"ad_hoc_plans">;

/**
 * 플랜의 완료 정보를 반환합니다.
 */
export function getCompletionInfo(
  plan: Pick<
    StudentPlan,
    | "simple_completion"
    | "simple_completed_at"
    | "actual_start_time"
    | "actual_end_time"
    | "total_duration_seconds"
    | "paused_duration_seconds"
    | "status"
  >
): CompletionInfo {
  // 간단 완료인 경우
  if (plan.simple_completion && plan.simple_completed_at) {
    return {
      mode: "simple",
      data: {
        completedAt: new Date(plan.simple_completed_at),
        completedBy: "student", // TODO: 실제 완료자 추적 필요시 확장
      },
    };
  }

  // 타이머 완료인 경우
  if (plan.status === "completed" && plan.actual_end_time) {
    const totalDuration = plan.total_duration_seconds || 0;
    const pausedDuration = plan.paused_duration_seconds || 0;

    return {
      mode: "timer",
      data: {
        startedAt: new Date(plan.actual_start_time!),
        completedAt: new Date(plan.actual_end_time),
        totalDuration,
        pausedDuration,
        effectiveDuration: totalDuration - pausedDuration,
      },
    };
  }

  return { mode: "none", data: null };
}

/**
 * Ad-hoc 플랜의 완료 정보를 반환합니다.
 * Note: ad_hoc_plans uses different field names than student_plan:
 * - started_at (not actual_start_time)
 * - completed_at (not actual_end_time)
 * - actual_minutes (not total_duration_seconds, in minutes not seconds)
 */
export function getAdHocCompletionInfo(
  plan: Pick<
    AdHocPlan,
    | "simple_completion"
    | "simple_completed_at"
    | "started_at"
    | "completed_at"
    | "actual_minutes"
    | "paused_duration_seconds"
    | "status"
  >
): CompletionInfo {
  // 간단 완료인 경우
  if (plan.simple_completion && plan.simple_completed_at) {
    return {
      mode: "simple",
      data: {
        completedAt: new Date(plan.simple_completed_at),
        completedBy: "student",
      },
    };
  }

  // 타이머 완료인 경우
  if (plan.status === "completed" && plan.completed_at) {
    const totalDuration = (plan.actual_minutes || 0) * 60; // Convert minutes to seconds
    const pausedDuration = plan.paused_duration_seconds || 0;

    return {
      mode: "timer",
      data: {
        startedAt: plan.started_at ? new Date(plan.started_at) : new Date(plan.completed_at),
        completedAt: new Date(plan.completed_at),
        totalDuration,
        pausedDuration,
        effectiveDuration: totalDuration - pausedDuration,
      },
    };
  }

  return { mode: "none", data: null };
}

/**
 * 플랜이 완료되었는지 확인합니다.
 */
export function isCompleted(
  plan: Pick<StudentPlan, "simple_completion" | "status">
): boolean {
  return plan.simple_completion === true || plan.status === "completed";
}

/**
 * Ad-hoc 플랜이 완료되었는지 확인합니다.
 */
export function isAdHocCompleted(
  plan: Pick<AdHocPlan, "simple_completion" | "status">
): boolean {
  return plan.simple_completion === true || plan.status === "completed";
}

/**
 * 플랜의 완료 시간을 반환합니다.
 */
export function getCompletedAt(
  plan: Pick<StudentPlan, "simple_completed_at" | "actual_end_time">
): Date | null {
  if (plan.simple_completed_at) {
    return new Date(plan.simple_completed_at);
  }
  if (plan.actual_end_time) {
    return new Date(plan.actual_end_time);
  }
  return null;
}

/**
 * 학생 권한을 파싱합니다.
 */
export function parseStudentPermissions(
  permissions: unknown
): StudentPlanPermissions {
  if (!permissions || typeof permissions !== "object") {
    return DEFAULT_STUDENT_PERMISSIONS;
  }

  const p = permissions as Record<string, unknown>;

  return {
    canAddAdHoc:
      typeof p.canAddAdHoc === "boolean"
        ? p.canAddAdHoc
        : DEFAULT_STUDENT_PERMISSIONS.canAddAdHoc,
    canEditMemo:
      typeof p.canEditMemo === "boolean"
        ? p.canEditMemo
        : DEFAULT_STUDENT_PERMISSIONS.canEditMemo,
    canMovePlans:
      typeof p.canMovePlans === "boolean"
        ? p.canMovePlans
        : DEFAULT_STUDENT_PERMISSIONS.canMovePlans,
    canChangeColor:
      typeof p.canChangeColor === "boolean"
        ? p.canChangeColor
        : DEFAULT_STUDENT_PERMISSIONS.canChangeColor,
    canComplete:
      typeof p.canComplete === "boolean"
        ? p.canComplete
        : DEFAULT_STUDENT_PERMISSIONS.canComplete,
  };
}
