/**
 * 학생 관리 관련 상수 정의
 */

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

