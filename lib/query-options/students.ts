import { queryOptions } from "@tanstack/react-query";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";
import { getStudentDetailAction } from "@/lib/domains/student/actions/detail";

/**
 * 학생 검색 쿼리 옵션
 */
export function studentSearchQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["studentSearch", query] as const,
    queryFn: () => searchStudentsAction(query),
    staleTime: 1000 * 30, // 30초
  });
}

/**
 * 학생 상세 조회 쿼리 옵션
 */
export function studentDetailQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: ["studentDetail", studentId] as const,
    queryFn: () => getStudentDetailAction(studentId),
    staleTime: 1000 * 60, // 1분
  });
}
