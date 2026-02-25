/**
 * Calendar Permission Utilities
 *
 * 캘린더 권한 시스템을 위한 유틸리티 함수
 *
 * 권한 모델:
 * - full: 모든 설정 수정 가능 (관리자 또는 본인 생성 캘린더)
 * - execute_only: 플랜 수행만 가능, 설정은 읽기 전용 (관리자 생성 캘린더)
 * - view_only: 조회만 가능 (캘린더 미선택 등)
 *
 * @module lib/domains/admin-plan/utils/calendarPermission
 */

import type { CalendarPermission } from "@/lib/types/plan";

/**
 * 뷰 모드 타입
 * admin: 관리자 모드 (모든 권한)
 * student: 학생 모드 (소유권에 따른 권한)
 */
export type ViewMode = "admin" | "student" | "personal";

/**
 * 캘린더 정보 (권한 확인에 필요한 최소 정보)
 */
interface CalendarInfo {
  createdBy: string | null;
}

/**
 * 캘린더 권한 결정
 *
 * @param viewMode - 현재 뷰 모드 ("admin" | "student")
 * @param calendar - 캘린더 정보 (null이면 view_only)
 * @param currentUserId - 현재 사용자 ID (null이면 view_only)
 * @returns 캘린더 권한
 *
 * @example
 * // 관리자 모드 → 항상 full
 * getCalendarPermission("admin", calendar, userId) // "full"
 *
 * // 학생 모드, 본인 생성 캘린더 → full
 * getCalendarPermission("student", { createdBy: userId }, userId) // "full"
 *
 * // 학생 모드, 관리자 생성 캘린더 → execute_only
 * getCalendarPermission("student", { createdBy: adminId }, userId) // "execute_only"
 */
export function getCalendarPermission(
  viewMode: ViewMode,
  calendar: CalendarInfo | null,
  currentUserId: string | null
): CalendarPermission {
  // 관리자 모드 (admin / personal) → 항상 full
  if (viewMode !== "student") {
    return "full";
  }

  // 캘린더 없음 또는 사용자 ID 없음 → view_only
  if (!calendar || !currentUserId) {
    return "view_only";
  }

  // 학생 모드 → 소유권 확인
  // 본인이 생성한 캘린더면 full, 아니면 execute_only
  return calendar.createdBy === currentUserId ? "full" : "execute_only";
}

/** @deprecated Use getCalendarPermission */
export const getCalendarSettingsPermission = getCalendarPermission;

/**
 * 설정 수정 가능 여부 확인
 *
 * @param permission - 캘린더 권한
 * @returns 설정 수정 가능 여부 (full 권한만 true)
 */
export function canEditCalendarSettings(permission: CalendarPermission): boolean {
  return permission === "full";
}

/** @deprecated Use canEditCalendarSettings */
export const canEditPlannerSettings = canEditCalendarSettings;
/** @deprecated Use canEditCalendarSettings */
export const canEditCalendarSettingsSettings = canEditCalendarSettings;

/**
 * 본인 생성 캘린더 여부 확인
 *
 * @param calendar - 캘린더 정보
 * @param currentUserId - 현재 사용자 ID
 * @returns 본인 생성 캘린더 여부
 */
export function isOwnCalendar(
  calendar: CalendarInfo | null,
  currentUserId: string | null
): boolean {
  if (!calendar || !currentUserId) {
    return false;
  }
  return calendar.createdBy === currentUserId;
}

/** @deprecated Use isOwnCalendar */
export const isOwnCalendarSettings = isOwnCalendar;

/**
 * 권한 레벨에 따른 허용 작업 확인
 *
 * @param permission - 캘린더 권한
 * @returns 허용되는 작업 목록
 */
export function getAllowedActions(permission: CalendarPermission): {
  canExecutePlans: boolean;
  canViewSettings: boolean;
  canEditSettings: boolean;
  canManageExclusionOverrides: boolean;
} {
  switch (permission) {
    case "full":
      return {
        canExecutePlans: true,
        canViewSettings: true,
        canEditSettings: true,
        canManageExclusionOverrides: true,
      };
    case "execute_only":
      return {
        canExecutePlans: true,
        canViewSettings: true,
        canEditSettings: false,
        canManageExclusionOverrides: false,
      };
    case "view_only":
    default:
      return {
        canExecutePlans: true,
        canViewSettings: true,
        canEditSettings: false,
        canManageExclusionOverrides: false,
      };
  }
}
