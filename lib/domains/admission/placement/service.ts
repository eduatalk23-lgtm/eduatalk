// ============================================
// 정시 배치 분석 서비스
// Phase 8.5a
// ============================================

import type { SuneungScores } from "../calculator/types";
import { calculateBatch } from "../calculator/calculator";
import {
  getScoreConfigs,
  getAllConversionTables,
  getAllRestrictions,
  getAllPercentageTables,
  findAdmissionsWithScores,
} from "../repository";
import { determineVerdicts, summarizeVerdicts } from "./engine";
import type { PlacementAnalysisResult } from "./types";

/**
 * 배치 분석 메인 서비스.
 *
 * 1. 전 대학 환산 설정 + 변환 테이블 + 결격사유 + 입결 데이터 일괄 조회
 * 2. calculateBatch()로 전 대학 환산
 * 3. 입결 비교 → 5단계 판정
 *
 * @param studentId 학생 ID (결과 식별용)
 * @param suneungScores 학생의 수능/모평 점수
 * @param dataYear 데이터 연도 (기본 2026)
 */
export async function analyzePlacement(
  studentId: string,
  suneungScores: SuneungScores,
  dataYear = 2026,
): Promise<PlacementAnalysisResult> {
  // 1. 데이터 일괄 조회 (병렬)
  const [configs, conversionTables, restrictions, percentageTables, admissionRows] =
    await Promise.all([
      getScoreConfigs(dataYear),
      getAllConversionTables(dataYear),
      getAllRestrictions(dataYear),
      getAllPercentageTables(dataYear),
      findAdmissionsWithScores(dataYear),
    ]);

  // 2. 전 대학 환산 점수 계산
  const calculationResults = calculateBatch(
    suneungScores,
    configs,
    conversionTables,
    restrictions,
    {
      percentageTablesByUniv: percentageTables,
    },
  );

  // 3. 입결 비교 → 판정
  const verdicts = determineVerdicts(calculationResults, admissionRows);
  const summary = summarizeVerdicts(verdicts);

  return {
    studentId,
    dataYear,
    verdicts,
    summary,
  };
}
