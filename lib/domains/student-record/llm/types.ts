// ============================================
// AI 역량 태그 제안 타입
// Phase 5.5a — 구조화된 추론 근거 포함
// ============================================

import type { CompetencyItemCode } from "../types";

/** AI가 제안하는 개별 태그 */
export interface TagSuggestion {
  /** 역량 항목 코드 */
  competencyItem: CompetencyItemCode;
  /** 긍정/부정/확인필요 */
  evaluation: "positive" | "negative" | "needs_review";
  /** AI가 추출한 근거 키워드 (원문에서) */
  evidenceKeywords: string[];
  /** AI의 판단 이유 (한 문장) */
  reasoning: string;
  /** 매칭된 루브릭 질문 */
  matchedRubricQuestion: string;
}

/** suggestTags 액션의 입력 */
export interface SuggestTagsInput {
  /** 분석할 텍스트 (세특/창체/행특 내용) */
  content: string;
  /** 기록 유형 */
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  /** 과목명 (세특인 경우) */
  subjectName?: string;
  /** 학년 */
  grade?: number;
}

/** suggestTags 액션의 출력 */
export interface SuggestTagsResult {
  suggestions: TagSuggestion[];
  /** 분석 요약 (전체적인 역량 인상) */
  summary: string;
}
