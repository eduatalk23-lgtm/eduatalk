/**
 * Score 도메인 Query Key Factory + Query Option Builders
 *
 * 내신 성적(grades), 성적 추이(trends), 성적 패널(panel) 관련 쿼리 키를 중앙 관리.
 */

import { queryOptions } from "@tanstack/react-query";

export const scoreKeys = {
  /** 내신 성적 — 학년별 조회 (기존 ["studentRecord","grades",...] 호환) */
  internalGrades: (studentId: string, schoolYear: number) =>
    ["studentRecord", "grades", studentId, schoolYear] as const,

  /** 성적 추이 차트 */
  scoreTrends: (studentId: string, tenantId: string) =>
    ["scoreTrends", studentId, tenantId] as const,

  /** 성적 패널 (교육과정 계층 + 내신/모의 성적 일괄) */
  scorePanelData: (studentId: string) =>
    ["scorePanelData", studentId] as const,
};

// ============================================
// Query Option Builders
// ============================================

export function internalGradesQueryOptions(studentId: string, schoolYear: number, studentGrade: number) {
  return queryOptions({
    queryKey: scoreKeys.internalGrades(studentId, schoolYear),
    queryFn: async () => {
      const { fetchInternalScoresForGrade } = await import("@/lib/domains/score/actions/core");
      return fetchInternalScoresForGrade(studentId, studentGrade);
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: !!studentId && studentGrade >= 1 && studentGrade <= 3,
  });
}

export function scoreTrendsQueryOptions(studentId: string, tenantId: string) {
  return queryOptions({
    queryKey: scoreKeys.scoreTrends(studentId, tenantId),
    queryFn: async () => {
      const { fetchScoreTrendsAction } = await import("@/lib/domains/score/actions/core");
      return fetchScoreTrendsAction(studentId, tenantId);
    },
    staleTime: 5 * 60_000,
    enabled: !!studentId && !!tenantId,
  });
}

export function scorePanelDataQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: scoreKeys.scorePanelData(studentId),
    queryFn: async () => {
      const { fetchScorePanelData } = await import("@/lib/domains/score/actions/fetchScoreData");
      return fetchScorePanelData(studentId);
    },
    staleTime: 5 * 60_000,
    enabled: !!studentId,
  });
}
