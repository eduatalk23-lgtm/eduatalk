// ============================================
// Phase C-3: 3축 평가 — 적합도 + 유사도 + 실현가능성
// 각 축 score(0-100) + reasoning + confidence → composite
// ============================================

import {
  calculateCompetencyFitScore,
  getTopCompetencyItems,
  resolveCareerField,
} from "../competency-matcher";

// ─── 타입 ──────────────────────────────────

export interface AxisScore {
  score: number;       // 0-100
  reasoning: string;   // 사람이 읽을 수 있는 사유
  confidence: number;  // 0-100 (데이터 신뢰도)
}

export interface ThreeAxisResult {
  competencyFit: AxisScore;        // 적합도: 역량 + 탐구 키워드
  curriculumSimilarity: AxisScore;  // 유사도: 가중치 Jaccard
  placementFeasibility: AxisScore;  // 실현가능성: 배치 or 내신 근사
  composite: number;                // 가중 평균 (0-100)
  weights: Weights;
}

export interface Weights {
  fit: number;
  similarity: number;
  feasibility: number;
}

export interface ScoringInput {
  // 학과 정보
  candidateDeptName: string;
  candidateUnivName: string;
  candidateMidClassification: string | null;

  // 축 1: 적합도
  competencyScores: Array<{ competency_item: string; grade_value: string }>;

  // 축 2: 유사도 (기존 Jaccard 결과)
  curriculumSimilarity: number | null; // 0-100
  sharedCourseCount: number;
  curriculumSource: string | null; // 'import' | 'web_search' | 'ai_inferred' etc.

  // 축 3: 실현가능성
  placementLevel: string | null;    // safe | possible | bold | unstable | danger
  internalGpaAvg: number | null;    // 내신 평균 등급 (1~9, 낮을수록 좋음)
  hasMockScores: boolean;

  // 가중치 오버라이드
  weights?: Partial<Weights>;
}

// ─── 상수 ──────────────────────────────────

const DEFAULT_WEIGHTS: Weights = { fit: 0.35, similarity: 0.35, feasibility: 0.30 };

const PLACEMENT_SCORE_MAP: Record<string, number> = {
  safe: 100,
  possible: 80,
  bold: 60,
  unstable: 40,
  danger: 20,
};

/** 내신 등급 → 근사 점수 (배치 없을 때 대용) */
const GPA_TO_SCORE: Record<number, number> = {
  1: 95, 2: 85, 3: 72, 4: 60, 5: 50, 6: 40, 7: 30, 8: 20, 9: 10,
};

// ─── 메인 ──────────────────────────────────

export function calculateThreeAxisScore(input: ScoringInput): ThreeAxisResult {
  const weights: Weights = {
    fit: input.weights?.fit ?? DEFAULT_WEIGHTS.fit,
    similarity: input.weights?.similarity ?? DEFAULT_WEIGHTS.similarity,
    feasibility: input.weights?.feasibility ?? DEFAULT_WEIGHTS.feasibility,
  };

  const competencyFit = scoreCompetencyFit(input);
  const curriculumSimilarity = scoreCurriculumSimilarity(input);
  const placementFeasibility = scorePlacementFeasibility(input);

  // 가중 평균 (축이 유효한 것만)
  let totalScore = 0;
  let totalWeight = 0;

  if (competencyFit.confidence > 0) {
    totalScore += competencyFit.score * weights.fit;
    totalWeight += weights.fit;
  }
  if (curriculumSimilarity.confidence > 0) {
    totalScore += curriculumSimilarity.score * weights.similarity;
    totalWeight += weights.similarity;
  }
  if (placementFeasibility.confidence > 0) {
    totalScore += placementFeasibility.score * weights.feasibility;
    totalWeight += weights.feasibility;
  }

  const composite = totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : 0;

  return { competencyFit, curriculumSimilarity, placementFeasibility, composite, weights };
}

// ─── 축별 스코어링 ─────────────────────────

function scoreCompetencyFit(input: ScoringInput): AxisScore {
  if (input.competencyScores.length === 0) {
    return { score: 50, reasoning: "역량 데이터 없음 — 중립 점수", confidence: 0 };
  }

  const careerField = resolveCareerField(input.candidateMidClassification);
  const fitScore = calculateCompetencyFitScore(input.competencyScores, careerField);
  const highlights = getTopCompetencyItems(input.competencyScores, careerField, 3);

  if (fitScore == null) {
    return { score: 50, reasoning: "역량 점수 산출 불가", confidence: 0 };
  }

  const reasoning = highlights.length > 0
    ? `${input.candidateDeptName} 적합: ${highlights.join(", ")} 역량 우수 (${fitScore}점)`
    : `역량 적합도 ${fitScore}점`;

  return {
    score: Math.min(100, Math.max(0, fitScore)),
    reasoning,
    confidence: 80,
  };
}

function scoreCurriculumSimilarity(input: ScoringInput): AxisScore {
  if (input.curriculumSimilarity == null) {
    return { score: 0, reasoning: "커리큘럼 데이터 없음", confidence: 0 };
  }

  // source에 따라 confidence 조정
  let confidence = 90;
  let sourceNote = "";
  if (input.curriculumSource === "ai_inferred") {
    confidence = 40;
    sourceNote = " (AI 추론 기반)";
  } else if (input.curriculumSource === "web_search") {
    confidence = 75;
    sourceNote = " (웹 검색 기반)";
  }

  const reasoning = `커리큘럼 유사도 ${input.curriculumSimilarity.toFixed(1)}% — 공통 ${input.sharedCourseCount}과목${sourceNote}`;

  return {
    score: Math.min(100, Math.max(0, input.curriculumSimilarity)),
    reasoning,
    confidence,
  };
}

function scorePlacementFeasibility(input: ScoringInput): AxisScore {
  // 배치 판정이 있는 경우 (모의고사 기반)
  if (input.placementLevel && PLACEMENT_SCORE_MAP[input.placementLevel] != null) {
    const score = PLACEMENT_SCORE_MAP[input.placementLevel];
    const levelLabels: Record<string, string> = {
      safe: "안정권", possible: "적정권", bold: "소신권", unstable: "불안정", danger: "위험",
    };
    return {
      score,
      reasoning: `모의 기준 ${levelLabels[input.placementLevel] ?? input.placementLevel} (${score}점)`,
      confidence: 85,
    };
  }

  // 내신 GPA로 근사 (배치 없을 때)
  if (input.internalGpaAvg != null) {
    const rounded = Math.round(input.internalGpaAvg);
    const score = GPA_TO_SCORE[rounded] ?? 50;
    return {
      score,
      reasoning: `내신 평균 ${input.internalGpaAvg.toFixed(1)}등급 기반 근사 (${score}점)`,
      confidence: 40,
    };
  }

  // 데이터 없음
  return {
    score: 50,
    reasoning: "성적 데이터 없음 — 중립 점수",
    confidence: 0,
  };
}
