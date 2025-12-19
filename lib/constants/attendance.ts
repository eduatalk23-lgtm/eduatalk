/**
 * 출석 관리 관련 상수 정의
 */

/**
 * 출석 목록 페이지네이션 크기
 */
export const ATTENDANCE_LIST_PAGE_SIZE = 20;

/**
 * 출석 목록 정렬 옵션
 */
export type AttendanceSortOption = "date" | "student_name" | "status";

/**
 * 출석 목록 정렬 옵션 상수
 */
export const ATTENDANCE_SORT_OPTIONS: Record<
  AttendanceSortOption,
  { value: AttendanceSortOption; label: string }
> = {
  date: { value: "date", label: "날짜순" },
  student_name: { value: "student_name", label: "학생명순" },
  status: { value: "status", label: "상태순" },
} as const;

