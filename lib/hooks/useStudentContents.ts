"use client";

import { useTypedQuery } from "@/lib/hooks/useTypedQuery";
import { studentContentsQueryOptions } from "@/lib/query-options/studentContents";

type UseStudentContentsOptions = {
  studentId: string;
  enabled?: boolean;
};

/**
 * 학생 콘텐츠 목록 조회 훅
 * 
 * @example
 * ```typescript
 * const { data: contents, isLoading } = useStudentContents({
 *   studentId: "student-123",
 * });
 * 
 * // contents.books, contents.lectures, contents.custom 사용
 * ```
 * 
 * @param options - 조회 옵션
 * @returns React Query 쿼리 결과
 */
export function useStudentContents({
  studentId,
  enabled = true,
}: UseStudentContentsOptions) {
  return useTypedQuery({
    ...studentContentsQueryOptions(studentId),
    enabled: enabled && !!studentId,
  });
}

