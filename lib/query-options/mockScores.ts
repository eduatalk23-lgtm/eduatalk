import { queryOptions } from "@tanstack/react-query";

export const mockScoreKeys = {
  all: ["mockScores"] as const,
  list: (studentId: string, tenantId: string) =>
    [...mockScoreKeys.all, "list", studentId, tenantId] as const,
  latestGrades: (studentId: string, tenantId: string) =>
    [...mockScoreKeys.all, "latestGrades", studentId, tenantId] as const,
  latestScoreInput: (studentId: string, tenantId: string) =>
    [...mockScoreKeys.all, "latestScoreInput", studentId, tenantId] as const,
};

/**
 * 모의고사 성적 목록 조회 옵션.
 * MockScoreSection에서 사용 (클라이언트 Supabase 쿼리 대체).
 */
export function mockScoreListQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: mockScoreKeys.list(studentId, tenantId),
    queryFn: async () => {
      const { fetchMockScoresList } = await import("@/lib/domains/score/actions/core");
      return fetchMockScoresList(studentId, tenantId);
    },
    staleTime: 30_000,
    enabled: !!studentId && !!tenantId,
  });
}

/**
 * 학생의 최신 모의고사 등급 조회 옵션.
 * MinScorePanel SimulationForm + PlacementDashboard에서 자동 입력에 사용.
 */
export function latestMockGradesQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: mockScoreKeys.latestGrades(studentId, tenantId),
    queryFn: async () => {
      const { fetchLatestMockGradesAction } = await import(
        "@/lib/domains/score/actions/core"
      );
      return fetchLatestMockGradesAction(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
  });
}
