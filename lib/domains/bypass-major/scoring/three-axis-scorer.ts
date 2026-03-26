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
  /** 점수 기반 배치 라벨 (safe/possible/bold/unstable/danger) — 모의 또는 내신 기반 */
  placementLabel: string | null;
  composite: number;                // 가중 평균 (0-100)
  compositeConfidence: number;      // 0-100 — 0이면 "데이터 부족", >0이면 신뢰할 수 있는 점수
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
  /** 과목그룹별 내신 (국영수/과학/사회) — 계열 맞춤 가중 */
  subjectGroupGpa?: {
    korean: number | null;
    math: number | null;
    english: number | null;
    science: number | null;
    social: number | null;
  } | null;
  /** 해당 학과의 입결 평균 등급 (낮을수록 어려움) — 학과별 차등 배치 */
  admissionAvgGrade?: number | null;

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

  // compositeConfidence: 유효 축의 가중 평균 confidence (0이면 데이터 부족)
  const axes = [competencyFit, curriculumSimilarity, placementFeasibility];
  const validAxes = axes.filter((a) => a.confidence > 0);
  const compositeConfidence = validAxes.length > 0
    ? Math.round(validAxes.reduce((sum, a) => sum + a.confidence, 0) / validAxes.length)
    : 0;

  // 배치 점수 → 라벨 역변환 (모의/내신 모두)
  const pScore = placementFeasibility.score;
  const placementLabel = placementFeasibility.confidence > 0
    ? pScore >= 90 ? "safe" : pScore >= 70 ? "possible" : pScore >= 55 ? "bold" : pScore >= 35 ? "unstable" : "danger"
    : null;

  return { competencyFit, curriculumSimilarity, placementFeasibility, placementLabel, composite, compositeConfidence, weights };
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

  // 내신 GPA 기반 — 입결 비교 우선, 없으면 절대 등급 변환
  if (input.subjectGroupGpa || input.internalGpaAvg != null) {
    const gpa = input.subjectGroupGpa;
    const mid = input.candidateMidClassification;

    // 계열별 가중 GPA 계산
    let weightedGpa: number | null = null;
    let gpaDetail = "";

    if (gpa) {
      const { avg: wa, detail } = calcWeightedGpa(gpa, mid);
      weightedGpa = wa;
      gpaDetail = detail;
    }

    const effectiveGpa = weightedGpa ?? input.internalGpaAvg;
    if (effectiveGpa == null) {
      // GPA 없음 — 아래 "데이터 없음"으로
    } else if (input.admissionAvgGrade != null && input.admissionAvgGrade > 0) {
      // 입결 비교: 학생 GPA vs 학과 입결 평균
      const gap = input.admissionAvgGrade - effectiveGpa; // 양수=여유, 음수=부족
      const { score, label } = gapToScoreAndLabel(gap);
      const gpaStr = gpaDetail || `평균 ${effectiveGpa.toFixed(1)}등급`;
      return {
        score,
        reasoning: `내신 ${gpaStr} vs 입결 ${input.admissionAvgGrade.toFixed(1)}등급 → ${gap >= 0 ? "여유" : "부족"} ${Math.abs(gap).toFixed(1)}등급 (${label})`,
        confidence: 70,
      };
    } else {
      // 입결 없음 — 절대 등급 변환 (기존 방식)
      const rounded = Math.round(effectiveGpa);
      const score = GPA_TO_SCORE[rounded] ?? 50;
      const reasoning = gpaDetail
        ? `내신 ${gpaDetail} → 가중평균 ${effectiveGpa.toFixed(1)}등급 (${score}점, 입결 미보유)`
        : `내신 평균 ${effectiveGpa.toFixed(1)}등급 기반 근사 (${score}점, 입결 미보유)`;
      return { score, reasoning, confidence: 40 };
    }
  }

  // 데이터 없음
  return {
    score: 50,
    reasoning: "성적 데이터 없음 — 중립 점수",
    confidence: 0,
  };
}

/** 계열별 과목그룹 가중 GPA 계산 */
function calcWeightedGpa(
  gpa: NonNullable<ScoringInput["subjectGroupGpa"]>,
  mid: string | null,
): { avg: number | null; detail: string } {
  // 계열별 과목 가중치 (합계 1.0)
  type W = { korean: number; math: number; english: number; science: number; social: number };
  const STEM: W = { korean: 0.10, math: 0.35, english: 0.15, science: 0.30, social: 0.10 };
  const HUMANITIES: W = { korean: 0.30, math: 0.10, english: 0.30, science: 0.10, social: 0.20 };
  const BALANCED: W = { korean: 0.20, math: 0.20, english: 0.20, science: 0.20, social: 0.20 };

  const stemMids = new Set([
    "수학·물리·천문·지구", "화학·생명과학·환경", "전기·전자·컴퓨터",
    "기계", "화공·고분자·에너지", "재료", "건설", "의료", "약학",
    "보건", "간호", "농림·수산",
  ]);
  const humanitiesMids = new Set([
    "언어·문학", "인문학", "사회과학", "법학", "교육",
  ]);

  const w = mid && stemMids.has(mid) ? STEM
    : mid && humanitiesMids.has(mid) ? HUMANITIES
    : BALANCED;

  let totalWeight = 0;
  let totalScore = 0;
  const parts: string[] = [];

  const entries: [string, number | null, number][] = [
    ["국", gpa.korean, w.korean],
    ["수", gpa.math, w.math],
    ["영", gpa.english, w.english],
    ["과", gpa.science, w.science],
    ["사", gpa.social, w.social],
  ];

  for (const [label, grade, weight] of entries) {
    if (grade != null) {
      totalWeight += weight;
      totalScore += grade * weight;
      parts.push(`${label}${grade.toFixed(1)}`);
    }
  }

  if (totalWeight === 0) return { avg: null, detail: "" };
  const avg = Math.round((totalScore / totalWeight) * 100) / 100;
  return { avg, detail: parts.join(" ") };
}

/**
 * 입결 대비 갭 → 배치 점수 + 라벨
 *
 * gap = 입결평균 - 학생GPA (등급 기준, 양수=여유, 음수=부족)
 * 예: 입결 2.5, 학생 1.4 → gap=1.1 → 안정
 *     입결 1.2, 학생 1.4 → gap=-0.2 → 소신
 */
function gapToScoreAndLabel(gap: number): { score: number; label: string } {
  if (gap >= 1.0) return { score: 95, label: "안정" };
  if (gap >= 0.5) return { score: 85, label: "안정" };
  if (gap >= 0.0) return { score: 72, label: "적정" };
  if (gap >= -0.3) return { score: 60, label: "소신" };
  if (gap >= -0.7) return { score: 45, label: "불안정" };
  return { score: 25, label: "위험" };
}
