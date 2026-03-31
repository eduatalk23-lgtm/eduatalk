/**
 * 학생 관리 관련 상수 정의
 */

/**
 * 학생 상태 (학원 등록 기준)
 */
export type StudentStatus = "enrolled" | "not_enrolled";

export const STUDENT_STATUSES = [
  { value: "enrolled" as const, label: "재원" },
  { value: "not_enrolled" as const, label: "비재원" },
] as const;

/**
 * 비재원 사유
 */
export type WithdrawnReason = "졸업" | "퇴원" | "이사" | "비용" | "프로그램종료" | "개인사유" | "기타";

export const WITHDRAWN_REASONS = [
  { value: "졸업" as const, label: "졸업" },
  { value: "퇴원" as const, label: "퇴원" },
  { value: "이사" as const, label: "이사" },
  { value: "비용" as const, label: "비용" },
  { value: "프로그램종료" as const, label: "프로그램 종료" },
  { value: "개인사유" as const, label: "개인 사유" },
  { value: "기타" as const, label: "기타" },
] as const;

/**
 * 학생 목록 페이지네이션 크기
 */
export const STUDENT_LIST_PAGE_SIZE = 20;

/**
 * 학생 목록 정렬 옵션
 */
export type StudentSortOption = "name" | "created_at" | "grade";

/**
 * 학생 목록 정렬 옵션 상수
 */
export const STUDENT_SORT_OPTIONS: Record<
  StudentSortOption,
  { value: StudentSortOption; label: string }
> = {
  name: { value: "name", label: "이름순" },
  created_at: { value: "created_at", label: "최근 생성일" },
  grade: { value: "grade", label: "학년순" },
} as const;

/**
 * 학부 타입
 */
export type StudentDivision = "고등부" | "중등부" | "졸업";

/**
 * 학부 옵션 상수
 */
export const STUDENT_DIVISIONS: Array<{
  value: StudentDivision;
  label: string;
}> = [
  { value: "고등부", label: "고등부" },
  { value: "중등부", label: "중등부" },
  { value: "졸업", label: "졸업" },
] as const;

