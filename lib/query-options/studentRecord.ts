import { queryOptions } from "@tanstack/react-query";
import { fetchRecordTabData } from "@/lib/domains/student-record/actions/record";
import { fetchStorylineTabData } from "@/lib/domains/student-record/actions/storyline";
import { fetchSupplementaryTabData } from "@/lib/domains/student-record/actions/supplementary";
import { fetchStrategyTabData } from "@/lib/domains/student-record/actions/strategy";
import { fetchDiagnosisTabData } from "@/lib/domains/student-record/actions/diagnosis";
import { fetchCrossRefData } from "@/lib/domains/student-record/actions/cross-ref-data-builder";

// ============================================
// Query Key Factory
// ============================================

export const studentRecordKeys = {
  all: ["studentRecord"] as const,
  overview: (studentId: string) =>
    [...studentRecordKeys.all, "overview", studentId] as const,
  recordTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "recordTab", studentId, schoolYear] as const,
  diagnosisTab: (studentId: string, schoolYear: number) =>
    [...studentRecordKeys.all, "diagnosisTab", studentId, schoolYear] as const,
  /** schoolYear 무관 prefix 매칭 — 진단 캐시 전체 무효화용 */
  diagnosisTabPrefix: (studentId: string) =>
    [...studentRecordKeys.all, "diagnosisTab", studentId] as const,
  storylineTab: (studentId: string, schoolYear?: number) =>
    [...studentRecordKeys.all, "storylineTab", studentId, ...(schoolYear != null ? [schoolYear] : [])] as const,
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
  gradeAwarePipeline: (studentId: string) =>
    [...studentRecordKeys.all, "gradeAwarePipelineStatus", studentId] as const,
  edges: (studentId: string) =>
    [...studentRecordKeys.all, "edges", studentId] as const,
  hyperedges: (studentId: string) =>
    [...studentRecordKeys.all, "hyperedges", studentId] as const,
  narrativeArcs: (studentId: string) =>
    [...studentRecordKeys.all, "narrativeArcs", studentId] as const,
  profileCards: (studentId: string) =>
    [...studentRecordKeys.all, "profileCards", studentId] as const,
  studentStateLatest: (studentId: string) =>
    [...studentRecordKeys.all, "studentStateLatest", studentId] as const,
  perceptionTrigger: (studentId: string) =>
    [...studentRecordKeys.all, "perceptionTrigger", studentId] as const,
  latestProposalJob: (studentId: string) =>
    [...studentRecordKeys.all, "latestProposalJob", studentId] as const,
  proposalJobDetail: (jobId: string) =>
    [...studentRecordKeys.all, "proposalJobDetail", jobId] as const,
  setekGuides: (studentId: string) =>
    [...studentRecordKeys.all, "setekGuides", studentId] as const,
  changcheGuides: (studentId: string) =>
    [...studentRecordKeys.all, "changcheGuides", studentId] as const,
  haengteukGuide: (studentId: string) =>
    [...studentRecordKeys.all, "haengteukGuide", studentId] as const,
  warningSnapshots: (studentId: string) =>
    [...studentRecordKeys.all, "warningSnapshots", studentId] as const,
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

/** Phase 1 Layer 2: DB 영속화 하이퍼엣지 조회 */
export function hyperedgesQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.hyperedges(studentId),
    queryFn: async () => {
      const { fetchPersistedHyperedges } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchPersistedHyperedges(studentId, tenantId);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

/** Phase 2 Layer 3: DB 영속화 narrative_arc 조회 (8단계 서사 태깅) */
export function narrativeArcsQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.narrativeArcs(studentId),
    queryFn: async () => {
      const { fetchPersistedNarrativeArcs } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchPersistedNarrativeArcs(studentId, tenantId);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

/** Phase 2 Step 4b: DB 영속화 profile_card 조회 (H2 Layer 0, 학년별 서사 프로필) */
export function profileCardsQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.profileCards(studentId),
    queryFn: async () => {
      const { fetchPersistedProfileCards } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchPersistedProfileCards(studentId, tenantId);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

/** α1-6: 학생 최신 StudentState snapshot (α1-3-d cron 기반). snapshot 부재 시 null. */
export function studentStateQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.studentStateLatest(studentId),
    queryFn: async () => {
      const { fetchLatestStudentStateSnapshot } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchLatestStudentStateSnapshot(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!studentId,
  });
}

/** α4 (2026-04-20 C): snapshot 2개 비교 기반 Perception Trigger 판정 결과. */
export function perceptionTriggerQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.perceptionTrigger(studentId),
    queryFn: async () => {
      const { fetchPerceptionTriggerResult } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchPerceptionTriggerResult(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!studentId,
  });
}

/** α4 Sprint 2 (2026-04-20): 최신 완료된 Proposal Job (UI 배너용). */
export function latestProposalJobQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.latestProposalJob(studentId),
    queryFn: async () => {
      const { fetchLatestProposalJob } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchLatestProposalJob(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!studentId,
  });
}

/** α4 Sprint 3 (2026-04-20): ProposalJob 상세 (Drawer 에서 enabled=open 시 활성). */
export function proposalJobDetailQueryOptions(jobId: string | null) {
  return queryOptions({
    queryKey: studentRecordKeys.proposalJobDetail(jobId ?? "none"),
    queryFn: async () => {
      if (!jobId) return null;
      const { fetchProposalJobDetail } = await import(
        "@/lib/domains/student-record/actions/diagnosis-helpers"
      );
      return fetchProposalJobDetail(jobId);
    },
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    enabled: !!jobId,
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

/** Phase 3: 서버 사이드 overview (경고 + 진행률) — staleTime 30초, CRUD/파이프라인 완료 시 invalidate */
export function overviewQueryOptions(
  studentId: string,
  studentGrade: number,
  initialSchoolYear: number,
) {
  return queryOptions({
    queryKey: studentRecordKeys.overview(studentId),
    queryFn: async () => {
      const { fetchStudentRecordOverview } = await import(
        "@/lib/domains/student-record/actions/overview"
      );
      const result = await fetchStudentRecordOverview(studentId, studentGrade, initialSchoolYear);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && studentGrade > 0,
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
    queryKey: studentRecordKeys.storylineTab(studentId, schoolYear),
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

/** 학년별 파이프라인 + synthesis 파이프라인 상태 조회 */
export function gradeAwarePipelineStatusQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.gradeAwarePipeline(studentId),
    queryFn: async () => {
      const { fetchGradeAwarePipelineStatus } = await import(
        "@/lib/domains/student-record/actions/pipeline-orchestrator"
      );
      const result = await fetchGradeAwarePipelineStatus(studentId);
      if (!result.success) throw new Error(result.error);
      return result.data!;
    },
    staleTime: 2_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

// ============================================
// Phase 9.1: Report
// ============================================

/** E2: 경고 히스토리 스냅샷 (최근 2개 — 이전 vs 현재 비교용) */
export function warningSnapshotsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: studentRecordKeys.warningSnapshots(studentId),
    queryFn: async () => {
      const { fetchWarningSnapshots } = await import(
        "@/lib/domains/student-record/actions/warning-history"
      );
      return fetchWarningSnapshots(studentId, 2);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId,
  });
}

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
