/**
 * 5축 합격 진단 — 메인 탐구 정합성 계산 (순수 함수)
 *
 * 학생의 메인 탐구 카테고리 점수 맵과 목표 계열의 가중치를 받아
 * 탐구 정합성 점수(0~100)와 판정을 반환한다.
 *
 * DB 호출 없음 — async 없음.
 * 카테고리 분류(themeKeywords → categoryScores) 는 이 함수의 책임이 아님.
 * Phase δ 에서 LLM 분류기 또는 컨설턴트 수동 지정으로 categoryScores 를 생성한다.
 */

import type { UniversityTrack } from "@/lib/domains/record-analysis/eval/university-profile-matcher";
import type { InquiryCategory } from "../repository/main-inquiry-weights-repository";

// ─── 공개 타입 ──────────────────────────────────────────────────────────────

export interface MainInquiryAlignmentInput {
  /** 학생 메인 탐구 — 키워드와 진로 분야 (참조용, 계산에는 미사용) */
  studentTheme: {
    themeKeywords: string[];
    careerField: string | null;
  };
  /**
   * 학생 탐구 카테고리 분류 결과.
   * 각 카테고리에 0~1 점수. 합계가 반드시 1일 필요는 없다.
   * Phase δ LLM 분류기 또는 컨설턴트 수동 입력으로 채워진다.
   */
  categoryScores: Record<InquiryCategory, number>;
  /** 목표 대학 계열 */
  targetTrack: UniversityTrack;
  /** DB 에서 로드한 track 별 카테고리 가중치 (getWeightsForTrack 결과) */
  trackWeights: Record<InquiryCategory, number>;
}

export interface MainInquiryAlignmentResult {
  /** 가중 평균 정규화 점수 (0~100) */
  score: number;
  /**
   * 상위 정합 카테고리 3개.
   * matchScore = categoryScores[c] × trackWeights[c]
   */
  topCategories: Array<{
    category: InquiryCategory;
    matchScore: number;
    weight: number;
  }>;
  /** 점수 판정: excellent(>=80) | good(>=60) | weak(>=30) | misaligned(<30) */
  grade: "excellent" | "good" | "weak" | "misaligned";
}

// ─── 카테고리 목록 ────────────────────────────────────────────────────────────

const ALL_CATEGORIES: InquiryCategory[] = [
  "natural_science",
  "life_medical",
  "engineering",
  "it_software",
  "social_science",
  "humanities",
  "law_policy",
  "business_economy",
  "education",
  "arts_sports",
];

// ─── 순수 함수 ──────────────────────────────────────────────────────────────

/**
 * 메인 탐구 정합성 점수 계산.
 *
 * 스코어링:
 *   score = Σ(categoryScores[c] * trackWeights[c]) / Σ(trackWeights[c]) * 100
 *
 * Σ trackWeights = 0 이면 score = 0 (가중치가 없는 track).
 *
 * 부동소수점 비교는 Math.round 로 정수화하여 처리.
 */
export function computeMainInquiryAlignment(
  input: MainInquiryAlignmentInput,
): MainInquiryAlignmentResult {
  const { categoryScores, trackWeights } = input;

  // ── 카테고리별 matchScore 계산 ────────────────────────────────
  const categoryDetails = ALL_CATEGORIES.map((cat) => {
    const score = categoryScores[cat] ?? 0;
    const weight = trackWeights[cat] ?? 0;
    return {
      category: cat,
      matchScore: score * weight,
      weight,
    };
  });

  // ── 가중 평균 정규화 ──────────────────────────────────────────
  const weightSum = categoryDetails.reduce((s, d) => s + d.weight, 0);
  const numerator = categoryDetails.reduce((s, d) => s + d.matchScore, 0);

  // 고정 정밀도: Math.round 로 소수점 1자리 단위 반올림 후 정수 반환
  const rawScore = weightSum > 0 ? (numerator / weightSum) * 100 : 0;
  const score = Math.round(rawScore);

  // ── 상위 3 카테고리 (matchScore 내림차순) ─────────────────────
  const topCategories = [...categoryDetails]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  // ── 점수 판정 ─────────────────────────────────────────────────
  const grade = scoreToGrade(score);

  return {
    score,
    topCategories,
    grade,
  };
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function scoreToGrade(
  score: number,
): MainInquiryAlignmentResult["grade"] {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 30) return "weak";
  return "misaligned";
}
