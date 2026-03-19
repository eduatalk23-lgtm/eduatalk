// ============================================
// AI 역량 분석 타입
// Phase 5.5a: 태그 제안 + Phase 6.1: 인라인 하이라이트
// ============================================

import type { CompetencyItemCode, CompetencyGrade, StrategyTargetArea, StrategyPriority } from "../types";

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

// ============================================
// Phase 6.1: 인라인 하이라이트 타입
// ============================================

/** 하이라이트된 구절 + 역량 태그 */
export interface HighlightTag {
  /** 역량 항목 코드 */
  competencyItem: CompetencyItemCode;
  /** 긍정/부정/확인필요 */
  evaluation: "positive" | "negative" | "needs_review";
  /** 원문에서 인용한 근거 구절 (정확한 발췌) */
  highlight: string;
  /** 판단 이유 */
  reasoning: string;
}

/** 세특 구간별 분석 결과 */
export interface AnalyzedSection {
  /** 구간 유형 */
  sectionType: "학업태도" | "학업수행능력" | "탐구활동" | "전체";
  /** 이 구간에 해당하는 원문 텍스트 (Phase 6.2 — 3구간 분리) */
  sectionText?: string;
  /** 이 구간에서 발견된 역량 태그들 */
  tags: HighlightTag[];
  /** 컨설턴트 확인 필요 여부 */
  needsReview: boolean;
}

/** 세특 하이라이트 분석 입력 */
export interface HighlightAnalysisInput {
  content: string;
  recordType: "setek" | "personal_setek" | "changche" | "haengteuk";
  subjectName?: string;
  grade?: number;
}

/** 세특 하이라이트 분석 출력 */
export interface HighlightAnalysisResult {
  /** 구간별 분석 (학업태도/수행능력/탐구활동) */
  sections: AnalyzedSection[];
  /** 종합 등급 제안 */
  competencyGrades: {
    item: CompetencyItemCode;
    grade: CompetencyGrade;
    reasoning: string;
  }[];
  /** 전체 요약 */
  summary: string;
}

// ============================================
// Phase 7: AI 보완전략 제안 타입
// ============================================

/** AI가 제안하는 보완전략 항목 */
export interface StrategySuggestion {
  /** 보완 영역 */
  targetArea: StrategyTargetArea;
  /** 보완 전략 내용 */
  strategyContent: string;
  /** 우선순위 */
  priority: StrategyPriority;
  /** 제안 이유 (진단 근거) */
  reasoning: string;
  /** 웹 검색 출처 (Grounding) */
  sourceUrls?: string[];
}

/** suggestStrategies 액션의 입력 */
export interface SuggestStrategiesInput {
  /** 종합 진단의 약점 */
  weaknesses: string[];
  /** 부족 역량 항목 (등급 B- 이하) */
  weakCompetencies: { item: CompetencyItemCode; grade: CompetencyGrade; label: string }[];
  /** 학년 */
  grade: number;
  /** 추천 전공 계열 */
  targetMajor?: string;
  /** 기존 보완전략 (중복 방지) */
  existingStrategies?: string[];
}

/** suggestStrategies 액션의 출력 */
export interface SuggestStrategiesResult {
  suggestions: StrategySuggestion[];
  /** 전체 요약 */
  summary: string;
}

// ============================================
// Phase 9.2: AI 활동 요약서 타입
// ============================================

/** generateActivitySummary 액션의 입력 */
export interface ActivitySummaryInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      seteks: Array<{ subject_name: string; content: string }>;
      personalSeteks: Array<{ title: string; content: string }>;
      changche: Array<{ activity_type: string; content: string }>;
      haengteuk: { content: string } | null;
      readings: Array<{ book_title: string; book_author?: string }>;
    }
  >;
  storylines?: Array<{ title: string; keywords: string[] }>;
}

/** generateActivitySummary 액션의 출력 */
export interface ActivitySummaryResult {
  title: string;
  sections: import("../types").ActivitySummarySection[];
  fullText: string;
}

// ============================================
// Phase 9.3: 세특 방향 가이드 (컨설턴트 내부용)
// ============================================

/** generateSetekGuide 액션의 입력 */
export interface SetekGuideInput {
  studentName: string;
  grade: number;
  targetMajor?: string;
  targetGrades: number[];
  recordDataByGrade: Record<
    number,
    {
      seteks: Array<{ subject_name: string; content: string }>;
      changche: Array<{ activity_type: string; content: string }>;
    }
  >;
  competencyScores?: Array<{ item: string; grade: string; narrative?: string }>;
  storylines?: Array<{ title: string; keywords: string[] }>;
  strengths?: string[];
  weaknesses?: string[];
}

/** generateSetekGuide 액션의 출력 */
export interface SetekGuideResult {
  title: string;
  guides: import("../types").SetekGuideItem[];
  overallDirection: string;
}
