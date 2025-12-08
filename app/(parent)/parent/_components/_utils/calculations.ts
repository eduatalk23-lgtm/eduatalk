/**
 * ParentDashboardContent에서 사용하는 계산 유틸리티 함수들
 * 서버 컴포넌트에서 사용하므로 순수 함수로 작성
 */

import type { ScoreRow } from "@/app/(student)/scores/dashboard/_utils";
import type { SubjectRiskAnalysis } from "@/app/(student)/analysis/_utils";

/**
 * 최근 성적을 정렬하여 반환 (최근 5개)
 */
export function getRecentScores(allScores: ScoreRow[]): ScoreRow[] {
  return allScores
    .filter((s) => s.grade !== null)
    .sort((a, b) => {
      const dateA = a.test_date ? new Date(a.test_date).getTime() : 0;
      const dateB = b.test_date ? new Date(b.test_date).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 5);
}

/**
 * 취약 과목을 반환 (risk_score가 높은 상위 3개)
 */
export function getWeakSubjects(riskAnalyses: SubjectRiskAnalysis[]): SubjectRiskAnalysis[] {
  return riskAnalyses
    .sort((a, b) => b.risk_score - a.risk_score)
    .slice(0, 3);
}

/**
 * 위험 신호를 반환 (risk_score >= 60)
 */
export function getRiskSignals(riskAnalyses: SubjectRiskAnalysis[]): SubjectRiskAnalysis[] {
  return riskAnalyses.filter((a) => a.risk_score >= 60);
}

