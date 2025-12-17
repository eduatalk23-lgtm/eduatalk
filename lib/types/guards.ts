/**
 * 타입 가드 함수
 * 런타임 타입 검증을 위한 유틸리티
 */

/**
 * 문자열이 유효한 UUID인지 확인
 */
export function isUUID(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * 값이 null이 아닌 객체인지 확인
 */
export function isNonNullObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 값이 문자열 배열인지 확인
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * 값이 숫자 배열인지 확인
 */
export function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "number")
  );
}

/**
 * 값이 유효한 날짜 문자열인지 확인 (YYYY-MM-DD 형식)
 */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * 값이 유효한 이메일인지 확인
 */
export function isEmail(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * 값이 유효한 역할(role)인지 확인
 */
export function isRole(
  value: unknown
): value is "superadmin" | "admin" | "teacher" | "student" | "parent" {
  if (typeof value !== "string") {
    return false;
  }
  const validRoles = ["superadmin", "admin", "teacher", "student", "parent"];
  return validRoles.includes(value);
}

/**
 * 값이 유효한 플랜 상태인지 확인
 */
export function isPlanStatus(
  value: unknown
): value is "draft" | "saved" | "active" | "completed" | "archived" {
  if (typeof value !== "string") {
    return false;
  }
  const validStatuses = ["draft", "saved", "active", "completed", "archived"];
  return validStatuses.includes(value);
}

/**
 * 값이 유효한 콘텐츠 타입인지 확인
 */
export function isContentType(
  value: unknown
): value is "book" | "lecture" | "custom" {
  if (typeof value !== "string") {
    return false;
  }
  const validTypes = ["book", "lecture", "custom"];
  return validTypes.includes(value);
}

// ============================================
// Plan 관련 타입 가드 함수
// ============================================

import type {
  PlanContent,
  PlanContentWithDetails,
  SchedulerOptionsWithTimeSettings,
  MasterBookWithJoins,
  MasterLectureWithJoins,
} from "./plan/domain";

/**
 * 값이 PlanContentWithDetails인지 확인
 * start_detail_id 또는 end_detail_id 필드 존재 여부로 판단
 */
export function isPlanContentWithDetails(
  value: PlanContent | PlanContentWithDetails
): value is PlanContentWithDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    ("start_detail_id" in value || "end_detail_id" in value)
  );
}

/**
 * 값이 SchedulerOptionsWithTimeSettings인지 확인
 * TimeSettings 필드 존재 여부로 판단
 */
export function isSchedulerOptionsWithTimeSettings(
  value: unknown
): value is SchedulerOptionsWithTimeSettings {
  if (!isNonNullObject(value)) {
    return false;
  }

  // TimeSettings의 주요 필드 중 하나라도 존재하면 true
  const timeSettingsFields = [
    "lunch_time",
    "camp_study_hours",
    "camp_self_study_hours",
    "designated_holiday_hours",
    "use_self_study_with_blocks",
    "enable_self_study_for_holidays",
    "enable_self_study_for_study_days",
  ];

  return timeSettingsFields.some((field) => field in value);
}

/**
 * 값이 MasterBookWithJoins인지 확인
 * JOIN된 데이터 필드 존재 여부로 판단
 */
export function isMasterBookWithJoins(
  value: unknown
): value is MasterBookWithJoins {
  if (!isNonNullObject(value)) {
    return false;
  }

  // JOIN 필드 중 하나라도 존재하면 true
  const joinFields = [
    "curriculum_revisions",
    "subjects",
    "publishers",
    "difficulty_levels",
  ];

  return joinFields.some((field) => field in value);
}

/**
 * 값이 MasterLectureWithJoins인지 확인
 * JOIN된 데이터 필드 존재 여부로 판단
 */
export function isMasterLectureWithJoins(
  value: unknown
): value is MasterLectureWithJoins {
  if (!isNonNullObject(value)) {
    return false;
  }

  // JOIN 필드 중 하나라도 존재하면 true
  const joinFields = ["curriculum_revisions", "subjects", "difficulty_levels"];

  return joinFields.some((field) => field in value);
}

