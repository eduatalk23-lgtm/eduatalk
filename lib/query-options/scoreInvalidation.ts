/**
 * Score 도메인 캐시 무효화 헬퍼
 *
 * 모의고사/내신 관련 쿼리 무효화를 한 곳에서 관리하여 산재 방지.
 */
import type { QueryClient } from "@tanstack/react-query";
import { mockScoreKeys } from "./mockScores";
import { scoreKeys } from "./scores";
import { studentRecordKeys } from "./studentRecord";

/**
 * 모의고사 관련 쿼리 일괄 무효화.
 * 모의고사 CRUD 후 호출 — list, latestGrades, latestScoreInput, scoreTrends, scorePanelData + 전략 탭 갱신.
 */
export function invalidateMockScoreQueries(
  queryClient: QueryClient,
  studentId: string,
  tenantId: string,
): void {
  queryClient.invalidateQueries({ queryKey: mockScoreKeys.list(studentId, tenantId) });
  queryClient.invalidateQueries({ queryKey: mockScoreKeys.latestGrades(studentId, tenantId) });
  queryClient.invalidateQueries({ queryKey: mockScoreKeys.latestScoreInput(studentId, tenantId) });
  queryClient.invalidateQueries({ queryKey: scoreKeys.scoreTrends(studentId, tenantId) });
  queryClient.invalidateQueries({ queryKey: scoreKeys.scorePanelData(studentId) });
}

/**
 * 내신 성적 관련 쿼리 무효화.
 * 내신 CRUD 후 호출 — 해당 학년 성적 + 성적 추이 + 진단 탭 갱신.
 */
export function invalidateInternalScoreQueries(
  queryClient: QueryClient,
  studentId: string,
  schoolYear: number,
  tenantId?: string,
): void {
  queryClient.invalidateQueries({ queryKey: scoreKeys.internalGrades(studentId, schoolYear) });
  // 내신 변경은 진단 탭(competency 분석 기반)과 성적 추이에도 영향
  queryClient.invalidateQueries({ queryKey: studentRecordKeys.diagnosisTabPrefix(studentId) });
  if (tenantId) {
    queryClient.invalidateQueries({ queryKey: scoreKeys.scoreTrends(studentId, tenantId) });
  }
}
