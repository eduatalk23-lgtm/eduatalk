import { queryOptions } from "@tanstack/react-query";

export const mockScoreKeys = {
  latestGrades: (studentId: string, tenantId: string) =>
    ["mockScores", "latestGrades", studentId, tenantId] as const,
};

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
