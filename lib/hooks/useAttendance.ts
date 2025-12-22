"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordAttendanceAction } from "@/lib/domains/attendance";
import type { CreateAttendanceRecordInput } from "@/lib/domains/attendance/types";

/**
 * 출석 기록 생성/수정 Mutation 반환 타입
 */
export type RecordAttendanceResult = {
  success: boolean;
  error?: string;
  smsResult?: {
    success: boolean;
    error?: string;
    skipped?: boolean;
  };
};

/**
 * 출석 기록 생성/수정 Mutation
 * 성공 시 출석 목록 및 통계 쿼리를 자동으로 무효화합니다.
 */
export function useRecordAttendance() {
  const queryClient = useQueryClient();

  return useMutation<RecordAttendanceResult, Error, CreateAttendanceRecordInput>({
    mutationFn: async (input: CreateAttendanceRecordInput) => {
      const result = await recordAttendanceAction(input);
      if (!result.success) {
        throw new Error(result.error || "출석 기록 저장에 실패했습니다.");
      }
      return result;
    },
    onSuccess: () => {
      // 출석 목록 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ["attendance", "list"],
      });
      // 출석 통계 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ["attendance", "statistics"],
      });
      // 학생별 출석 기록 쿼리 무효화
      queryClient.invalidateQueries({
        queryKey: ["attendance", "student"],
      });
    },
  });
}

