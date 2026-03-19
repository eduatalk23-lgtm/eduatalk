// ============================================
// 정시 배치 판정 엔진 — 순수 함수
// Phase 8.5a
// ============================================

import type { AdmissionResults } from "../types";
import type { ScoreCalculationResult } from "../calculator/types";
import type {
  PlacementLevel,
  PlacementVerdict,
  PlacementSummary,
  HistoricalComparison,
} from "./types";
import { PLACEMENT_THRESHOLDS } from "./types";

/**
 * 입결 JSONB에서 유효한 연도별 환산점수를 추출.
 * score 필드를 parseFloat → NaN이면 제외.
 */
export function parseAdmissionScores(
  admissionResults: AdmissionResults | null | undefined,
): HistoricalComparison[] {
  if (!admissionResults) return [];

  return Object.entries(admissionResults)
    .map(([year, data]) => {
      const parsed = data.score != null ? parseFloat(data.score) : null;
      return {
        year,
        basis: data.basis,
        grade: data.grade,
        score: parsed != null && !isNaN(parsed) ? parsed : null,
      };
    })
    .sort((a, b) => b.year.localeCompare(a.year)); // 최신 연도 먼저
}

/**
 * 유효 연도 점수의 평균 계산.
 * 유효 연도가 없으면 null 반환.
 */
export function calculateAdmissionAverage(
  comparisons: HistoricalComparison[],
): number | null {
  const validScores = comparisons
    .map((c) => c.score)
    .filter((s): s is number => s !== null);

  if (validScores.length === 0) return null;
  return validScores.reduce((sum, s) => sum + s, 0) / validScores.length;
}

/**
 * 신뢰도 계산.
 * - 기본: 3개년=80, 2개년=60, 1개년=40
 * - 편차 보너스: 표준편차가 작을수록(안정적) +최대 20점
 */
export function calculateConfidence(
  comparisons: HistoricalComparison[],
): number {
  const validScores = comparisons
    .map((c) => c.score)
    .filter((s): s is number => s !== null);

  const count = validScores.length;
  if (count === 0) return 0;

  // 기본 점수
  const baseScore = count >= 3 ? 80 : count === 2 ? 60 : 40;

  // 편차 보너스 (표준편차 기반)
  if (count < 2) return baseScore;

  const avg = validScores.reduce((s, v) => s + v, 0) / count;
  const variance = validScores.reduce((s, v) => s + (v - avg) ** 2, 0) / count;
  const stdDev = Math.sqrt(variance);

  // 표준편차가 평균의 1% 이하 → +20, 5% 이상 → +0
  const relativeStdDev = avg > 0 ? stdDev / avg : 1;
  const bonus = Math.max(0, Math.round(20 * (1 - relativeStdDev / 0.05)));

  return Math.min(100, baseScore + bonus);
}

/**
 * 학생 환산점수와 입결 평균 비교 → 5단계 판정.
 */
export function determineLevel(
  studentScore: number,
  admissionAvg: number | null,
): PlacementLevel {
  if (admissionAvg === null || admissionAvg <= 0) return "danger";

  const ratio = studentScore / admissionAvg;

  if (ratio >= PLACEMENT_THRESHOLDS.safe) return "safe";
  if (ratio >= PLACEMENT_THRESHOLDS.possible) return "possible";
  if (ratio >= PLACEMENT_THRESHOLDS.bold) return "bold";
  if (ratio >= PLACEMENT_THRESHOLDS.unstable) return "unstable";
  return "danger";
}

/** 입시 데이터 행 (repository 조회 결과) */
export interface AdmissionRow {
  university_name: string;
  department_name: string;
  region: string | null;
  department_type: string | null;
  admission_results: AdmissionResults | null;
}

/**
 * 배치 판정 메인 함수.
 * 환산 결과 + 입결 데이터 → PlacementVerdict 배열 생성.
 */
export function determineVerdicts(
  calculationResults: ScoreCalculationResult[],
  admissionRows: AdmissionRow[],
): PlacementVerdict[] {
  // 대학명 → 입결 행 맵 (동일 대학 여러 학과)
  const admissionMap = new Map<string, AdmissionRow[]>();
  for (const row of admissionRows) {
    const key = row.university_name;
    if (!admissionMap.has(key)) admissionMap.set(key, []);
    admissionMap.get(key)!.push(row);
  }

  const verdicts: PlacementVerdict[] = [];

  for (const result of calculationResults) {
    const rows = admissionMap.get(result.universityName);
    if (!rows || rows.length === 0) {
      // 입결 데이터 없음 → 단일 판정 (데이터 부족)
      verdicts.push({
        universityName: result.universityName,
        departmentName: "",
        region: null,
        departmentType: null,
        studentScore: result.totalScore,
        level: result.isEligible ? "danger" : "danger",
        admissionAvg: null,
        scoreDiff: null,
        confidence: 0,
        historicalComparisons: [],
        notes: result.isEligible ? ["입결 데이터 없음"] : result.disqualificationReasons,
        calculationResult: result,
      });
      continue;
    }

    // 각 학과별 판정
    for (const row of rows) {
      const comparisons = parseAdmissionScores(row.admission_results);
      const admissionAvg = calculateAdmissionAverage(comparisons);
      const confidence = calculateConfidence(comparisons);

      const notes: string[] = [];
      if (!result.isEligible) {
        notes.push(...result.disqualificationReasons);
      }

      const level = !result.isEligible
        ? "danger" as PlacementLevel
        : determineLevel(result.totalScore, admissionAvg);

      const scoreDiff = admissionAvg !== null
        ? Math.round((result.totalScore - admissionAvg) * 100) / 100
        : null;

      verdicts.push({
        universityName: result.universityName,
        departmentName: row.department_name,
        region: row.region,
        departmentType: row.department_type,
        studentScore: result.totalScore,
        level,
        admissionAvg,
        scoreDiff,
        confidence,
        historicalComparisons: comparisons,
        notes,
        calculationResult: result,
      });
    }
  }

  // totalScore 내림차순 정렬
  verdicts.sort((a, b) => b.studentScore - a.studentScore);

  return verdicts;
}

/**
 * 판정 목록으로부터 요약 생성.
 */
export function summarizeVerdicts(verdicts: PlacementVerdict[]): PlacementSummary {
  const byLevel: Record<PlacementLevel, number> = {
    safe: 0,
    possible: 0,
    bold: 0,
    unstable: 0,
    danger: 0,
  };

  let disqualified = 0;

  for (const v of verdicts) {
    byLevel[v.level]++;
    if (!v.calculationResult.isEligible) {
      disqualified++;
    }
  }

  return {
    total: verdicts.length,
    byLevel,
    disqualified,
  };
}

/**
 * 필터 적용.
 */
export function filterVerdicts(
  verdicts: PlacementVerdict[],
  filter: {
    levels?: PlacementLevel[];
    region?: string;
    departmentType?: string;
    search?: string;
  },
): PlacementVerdict[] {
  return verdicts.filter((v) => {
    if (filter.levels && filter.levels.length > 0 && !filter.levels.includes(v.level)) {
      return false;
    }
    if (filter.region && v.region !== filter.region) {
      return false;
    }
    if (filter.departmentType && v.departmentType !== filter.departmentType) {
      return false;
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const match =
        v.universityName.toLowerCase().includes(q) ||
        v.departmentName.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}
