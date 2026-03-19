// ============================================
// 모평/수능 점수 → SuneungScores 변환
// Phase 8.5a
// ============================================

import type { SuneungScores } from "../calculator/types";

/** 모평/수능 점수 입력 (UI 폼에서 사용) */
export interface MockScoreInput {
  /** 국어 원점수 */
  koreanRaw: number | null;
  /** 국어 표준점수 */
  korean: number | null;
  /** 수학 선택과목 */
  mathType: "미적분" | "기하" | "확률과통계";
  /** 수학 원점수 */
  mathRaw: number | null;
  /** 수학 표준점수 */
  math: number | null;
  /** 영어 등급 */
  english: number | null;
  /** 한국사 등급 */
  history: number | null;
  /** 탐구1 과목명 */
  inquiry1Subject: string;
  /** 탐구1 원점수 */
  inquiry1Raw: number | null;
  /** 탐구2 과목명 */
  inquiry2Subject: string;
  /** 탐구2 원점수 */
  inquiry2Raw: number | null;
  /** 제2외국어/한문 등급 (선택) */
  foreignLang: number | null;
}

/**
 * UI 입력 → Calculator SuneungScores 변환.
 * 수학 선택과목에 따라 적절한 필드에 매핑.
 */
export function convertToSuneungScores(input: MockScoreInput): SuneungScores {
  const scores: SuneungScores = {
    korean: input.korean,
    koreanRaw: input.koreanRaw,
    mathCalculus: null,
    mathCalculusRaw: null,
    mathGeometry: null,
    mathGeometryRaw: null,
    mathStatistics: null,
    mathStatisticsRaw: null,
    english: input.english,
    history: input.history,
    inquiry: {},
    foreignLang: input.foreignLang,
  };

  // 수학 선택과목 매핑
  switch (input.mathType) {
    case "미적분":
      scores.mathCalculus = input.math;
      scores.mathCalculusRaw = input.mathRaw;
      break;
    case "기하":
      scores.mathGeometry = input.math;
      scores.mathGeometryRaw = input.mathRaw;
      break;
    case "확률과통계":
      scores.mathStatistics = input.math;
      scores.mathStatisticsRaw = input.mathRaw;
      break;
  }

  // 탐구 매핑
  if (input.inquiry1Subject && input.inquiry1Raw != null) {
    scores.inquiry[input.inquiry1Subject] = input.inquiry1Raw;
  }
  if (input.inquiry2Subject && input.inquiry2Raw != null) {
    scores.inquiry[input.inquiry2Subject] = input.inquiry2Raw;
  }

  return scores;
}

/** 빈 MockScoreInput 생성 */
export function createEmptyMockScoreInput(): MockScoreInput {
  return {
    koreanRaw: null,
    korean: null,
    mathType: "미적분",
    mathRaw: null,
    math: null,
    english: null,
    history: null,
    inquiry1Subject: "",
    inquiry1Raw: null,
    inquiry2Subject: "",
    inquiry2Raw: null,
    foreignLang: null,
  };
}
