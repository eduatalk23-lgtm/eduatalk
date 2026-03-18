import { queryOptions } from "@tanstack/react-query";
import { fetchRecordTabData } from "@/lib/domains/student-record/actions/record";
import { fetchStorylineTabData } from "@/lib/domains/student-record/actions/storyline";
import { fetchSupplementaryTabData } from "@/lib/domains/student-record/actions/supplementary";
import { fetchStrategyTabData } from "@/lib/domains/student-record/actions/strategy";

// ============================================
// Query Key Factory
// ============================================

export const studentRecordKeys = {
  all: ["studentRecord"] as const,
  recordTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "recordTab", studentId, schoolYear] as const,
  storylineTab: (studentId: string) =>
    [...studentRecordKeys.all, "storylineTab", studentId] as const,
  supplementaryTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "supplementaryTab", studentId, schoolYear] as const,
  strategyTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "strategyTab", studentId, schoolYear] as const,
};

// ============================================
// Query Options
// ============================================

export function recordTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
    queryFn: async () => {
      const result = await fetchRecordTabData(studentId, schoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && !!schoolYear,
  });
}

export function supplementaryTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.supplementaryTab(studentId, schoolYear),
    queryFn: async () => {
      const result = await fetchSupplementaryTabData(studentId, schoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && !!schoolYear,
  });
}

export function strategyTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.strategyTab(studentId, schoolYear),
    queryFn: async () => {
      const result = await fetchStrategyTabData(studentId, schoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && !!schoolYear,
  });
}

export function storylineTabQueryOptions(studentId: string, schoolYear: number) {
  return queryOptions({
    queryKey: studentRecordKeys.storylineTab(studentId),
    queryFn: async () => {
      const result = await fetchStorylineTabData(studentId, schoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}
