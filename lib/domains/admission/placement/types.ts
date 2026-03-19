// ============================================
// 정시 배치 판정 타입
// Phase 8.5a
// ============================================

import type { ScoreCalculationResult } from "../calculator/types";

/** 5단계 배치 판정 */
export type PlacementLevel = "safe" | "possible" | "bold" | "unstable" | "danger";

/** 판정 임계값 (입결 평균 대비 비율) */
export const PLACEMENT_THRESHOLDS: Record<PlacementLevel, number> = {
  safe: 1.0,
  possible: 0.985,
  bold: 0.97,
  unstable: 0.95,
  danger: 0, // < 0.95
};

/** 판정 라벨 */
export const PLACEMENT_LABELS: Record<PlacementLevel, string> = {
  safe: "안정",
  possible: "적정",
  bold: "소신",
  unstable: "불안정",
  danger: "위험",
};

/** 판정 색상 (Tailwind 클래스) */
export const PLACEMENT_COLORS: Record<PlacementLevel, { bg: string; text: string; darkBg: string; darkText: string }> = {
  safe: { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "dark:bg-emerald-900/30", darkText: "dark:text-emerald-300" },
  possible: { bg: "bg-blue-100", text: "text-blue-700", darkBg: "dark:bg-blue-900/30", darkText: "dark:text-blue-300" },
  bold: { bg: "bg-amber-100", text: "text-amber-700", darkBg: "dark:bg-amber-900/30", darkText: "dark:text-amber-300" },
  unstable: { bg: "bg-orange-100", text: "text-orange-700", darkBg: "dark:bg-orange-900/30", darkText: "dark:text-orange-300" },
  danger: { bg: "bg-red-100", text: "text-red-700", darkBg: "dark:bg-red-900/30", darkText: "dark:text-red-300" },
};

/** 연도별 입결 비교 */
export interface HistoricalComparison {
  year: string;
  basis?: string;
  grade?: string;
  /** 입결 환산점수 (parseFloat) */
  score: number | null;
}

/** 단일 대학 배치 판정 결과 */
export interface PlacementVerdict {
  universityName: string;
  departmentName: string;
  region: string | null;
  departmentType: string | null;
  /** 학생 환산점수 */
  studentScore: number;
  /** 판정 레벨 */
  level: PlacementLevel;
  /** 입결 3개년 평균 (유효 연도만) */
  admissionAvg: number | null;
  /** 학생점수 - 입결평균 차이 */
  scoreDiff: number | null;
  /** 신뢰도 (0-100) */
  confidence: number;
  /** 연도별 입결 비교 */
  historicalComparisons: HistoricalComparison[];
  /** 비고 (결격사유 등) */
  notes: string[];
  /** 원본 환산 결과 */
  calculationResult: ScoreCalculationResult;
}

/** 배치 분석 필터 */
export interface PlacementFilter {
  levels?: PlacementLevel[];
  region?: string;
  departmentType?: string;
  search?: string;
}

/** 배치 분석 요약 */
export interface PlacementSummary {
  total: number;
  byLevel: Record<PlacementLevel, number>;
  /** 결격으로 제외된 수 */
  disqualified: number;
}

/** 배치 분석 전체 결과 */
export interface PlacementAnalysisResult {
  /** 학생 ID */
  studentId: string;
  /** 분석 대상 연도 */
  dataYear: number;
  /** 판정 목록 (totalScore 내림차순) */
  verdicts: PlacementVerdict[];
  /** 요약 */
  summary: PlacementSummary;
}
