import { queryOptions } from "@tanstack/react-query";
import { getMemos } from "@/lib/domains/memo/actions/calendarMemos";

// ============================================
// Query Key Factory
// ============================================

export const calendarMemoKeys = {
  all: ["calendarMemos"] as const,
  student: (studentId: string) =>
    [...calendarMemoKeys.all, "student", studentId] as const,
  byRole: (studentId: string, role: "student" | "admin") =>
    [...calendarMemoKeys.student(studentId), "role", role] as const,
  byDate: (studentId: string, date: string) =>
    [...calendarMemoKeys.student(studentId), "date", date] as const,
};

// ============================================
// Query Options
// ============================================

/** 학생의 전체 메모 목록 */
export function studentMemosQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: calendarMemoKeys.student(studentId),
    queryFn: async () => {
      const result = await getMemos(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 30_000, // 30초
    gcTime: 5 * 60_000, // 5분
    enabled: !!studentId,
  });
}

/** 작성자 역할별 메모 목록 */
export function memosByRoleQueryOptions(
  studentId: string,
  role: "student" | "admin"
) {
  return queryOptions({
    queryKey: calendarMemoKeys.byRole(studentId, role),
    queryFn: async () => {
      const result = await getMemos(studentId, { authorRole: role });
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}
