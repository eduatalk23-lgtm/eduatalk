import { queryOptions } from "@tanstack/react-query";
import { fetchRecordTabData } from "@/lib/domains/student-record/actions/record";
import { fetchStorylineTabData } from "@/lib/domains/student-record/actions/storyline";
import { fetchSupplementaryTabData } from "@/lib/domains/student-record/actions/supplementary";
import { fetchStrategyTabData } from "@/lib/domains/student-record/actions/strategy";
import { fetchDiagnosisTabData, fetchCrossRefData } from "@/lib/domains/student-record/actions/diagnosis";

// ============================================
// Query Key Factory
// ============================================

export const studentRecordKeys = {
  all: ["studentRecord"] as const,
  recordTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "recordTab", studentId, schoolYear] as const,
  diagnosisTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "diagnosisTab", studentId, schoolYear] as const,
  storylineTab: (studentId: string) =>
    [...studentRecordKeys.all, "storylineTab", studentId] as const,
  supplementaryTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "supplementaryTab", studentId, schoolYear] as const,
  strategyTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "strategyTab", studentId, schoolYear] as const,
  coursePlanTab: (studentId: string) =>
    [...studentRecordKeys.all, "coursePlanTab", studentId] as const,
  crossRef: (studentId: string) =>
    [...studentRecordKeys.all, "crossRef", studentId] as const,
  pipeline: (studentId: string) =>
    [...studentRecordKeys.all, "pipeline", studentId] as const,
  edges: (studentId: string) =>
    [...studentRecordKeys.all, "edges", studentId] as const,
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

export function crossRefQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.crossRef(studentId),
    queryFn: async () => {
      const data = await fetchCrossRefData(studentId, tenantId);
      if (!data || typeof data !== "object") {
        return { storylineLinks: [], readingLinks: [], readingLabelMap: {}, recordLabelMap: {}, recordContentMap: {} };
      }
      return data;
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

/** Phase E4: DB 영속화 엣지 조회 */
export function edgesQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.edges(studentId),
    queryFn: async () => {
      const { fetchPersistedEdges } = await import(
        "@/lib/domains/student-record/actions/diagnosis"
      );
      return fetchPersistedEdges(studentId, tenantId);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

/** AI 초기 분석 파이프라인 상태 (3초 폴링, running 시에만) */
export function pipelineStatusQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.pipeline(studentId),
    queryFn: async () => {
      const { fetchPipelineStatus } = await import(
        "@/lib/domains/student-record/actions/pipeline"
      );
      const result = await fetchPipelineStatus(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 2_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

export function diagnosisTabQueryOptions(
  studentId: string,
  schoolYear: number,
  tenantId: string,
) {
  return queryOptions({
    queryKey: studentRecordKeys.diagnosisTab(studentId, schoolYear),
    queryFn: async () => {
      const data = await fetchDiagnosisTabData(studentId, schoolYear, tenantId);
      if (!data || typeof data !== "object") {
        throw new Error("진단 데이터 조회 실패");
      }
      return data;
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

// ============================================
// 수강 계획 (Course Plan)
// ============================================

export function coursePlanTabQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.coursePlanTab(studentId),
    queryFn: async () => {
      const { fetchCoursePlanTabData } = await import(
        "@/lib/domains/student-record/actions/coursePlan"
      );
      const result = await fetchCoursePlanTabData(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

// ============================================
// Phase 9.1: Report
// ============================================

export function reportDataQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: [...studentRecordKeys.all, "report", studentId] as const,
    queryFn: async () => {
      const { fetchReportData } = await import(
        "@/lib/domains/student-record/actions/report"
      );
      const result = await fetchReportData(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    enabled: !!studentId,
  });
}
