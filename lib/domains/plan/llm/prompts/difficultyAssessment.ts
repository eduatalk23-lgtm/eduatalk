/**
 * Content Difficulty Assessment Prompt
 * Phase 3.1: 교재 난이도 평가 시스템
 *
 * AI를 사용하여 콘텐츠(교재/강의)의 난이도를 자동 분석합니다.
 */

import { estimateTokens } from "../client";

// ============================================
// Types
// ============================================

/**
 * 난이도 평가 요청
 */
export interface DifficultyAssessmentRequest {
  /** 콘텐츠 유형 */
  contentType: "book" | "lecture";
  /** 제목 */
  title: string;
  /** 과목 */
  subject: string;
  /** 과목 카테고리 */
  subjectCategory?: string;
  /** 출판사/플랫폼 */
  publisher?: string;
  /** 목차 또는 강의 목록 */
  toc?: string;
  /** 설명 */
  description?: string;
  /** 총 페이지/강의 수 */
  totalUnits?: number;
  /** 교육과정 (2015, 2022) */
  curriculum?: string;
  /** 대상 학년 */
  targetGrades?: number[];
}

/**
 * 난이도 평가 결과
 */
export interface DifficultyAssessmentResult {
  /** 종합 난이도 점수 (0-5) */
  overallScore: number;
  /** 확신도 (0-1) */
  confidence: number;
  /** 어휘 복잡도 (0-5) */
  vocabularyComplexity: number;
  /** 개념 밀도 (0-5) */
  conceptDensity: number;
  /** 선수지식 깊이 (1-5) */
  prerequisiteDepth: number;
  /** 수리적 복잡도 (0-5) */
  mathematicalComplexity: number;
  /** 단위당 예상 학습 시간 (시간) */
  estimatedHoursPerUnit: number;
  /** 수준별 권장 학습 속도 */
  recommendedPace: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  /** 선수 개념 목록 */
  prerequisiteConcepts: string[];
  /** 다루는 핵심 개념 목록 */
  keyConceptsCovered: string[];
  /** 분석 근거 */
  reasoning: string;
}

/**
 * 학습 수준
 */
export type LearningLevel = "beginner" | "intermediate" | "advanced";

// ============================================
// System Prompt
// ============================================

export const DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT = `당신은 한국 수능/내신 교육과정 전문가입니다. 교재와 강의의 난이도를 정확하게 평가합니다.

## 평가 기준

### 1. 어휘 복잡도 (vocabulary_complexity: 0-5)
- 0-1: 일상 용어 위주, 전문용어 거의 없음
- 1-2: 기초 학술 용어, 교과서 수준
- 2-3: 중급 전문용어, 추상적 개념어 적당히 포함
- 3-4: 고급 전문용어 다수, 학술적 표현 빈번
- 4-5: 전문 학술 용어 위주, 대학 수준 어휘

### 2. 개념 밀도 (concept_density: 0-5)
- 0-1: 장당 1-2개 개념, 충분한 예시와 설명
- 1-2: 장당 3-4개 개념, 적절한 복습 포함
- 2-3: 장당 5-7개 개념, 빠른 진도
- 3-4: 장당 8-10개 개념, 압축적 내용
- 4-5: 장당 10개 이상 개념, 매우 압축적

### 3. 선수지식 깊이 (prerequisite_depth: 1-5)
- 1: 선수지식 거의 불필요 (기초 입문)
- 2: 기본 개념 이해 필요 (이전 학년 기초)
- 3: 중급 선수지식 필요 (이전 과목 완료)
- 4: 고급 선수지식 필요 (여러 과목 연계)
- 5: 전문가 수준 배경지식 필요

### 4. 수리적 복잡도 (mathematical_complexity: 0-5)
- 0: 수식 없음
- 1: 기본 사칙연산, 간단한 공식
- 2: 중학교 수준 수식, 기본 함수
- 3: 고등학교 수학 1-2 수준
- 4: 미적분, 확률통계 활용
- 5: 대학 수학 수준

## 종합 점수 계산
overall_score = (vocabulary * 0.25) + (concept_density * 0.30) + (prerequisite * 0.25) + (mathematical * 0.20)

## 학습 속도 가이드라인
- 교재: beginner 3-5페이지/세션, intermediate 5-8페이지/세션, advanced 8-12페이지/세션
- 강의: beginner 1-2강/세션, intermediate 2-3강/세션, advanced 3-4강/세션

## 응답 형식
반드시 유효한 JSON으로만 응답하세요. 다른 텍스트는 포함하지 마세요.`;

// ============================================
// User Prompt Builder
// ============================================

/**
 * 난이도 평가 사용자 프롬프트 생성
 */
export function buildDifficultyAssessmentPrompt(
  request: DifficultyAssessmentRequest
): string {
  const contentTypeKo = request.contentType === "book" ? "교재" : "강의";
  const unitTypeKo = request.contentType === "book" ? "페이지" : "강";

  let prompt = `다음 ${contentTypeKo}를 분석하여 난이도를 평가하세요:

## 콘텐츠 정보
- 제목: ${request.title}
- 과목: ${request.subject}`;

  if (request.subjectCategory) {
    prompt += `\n- 과목 카테고리: ${request.subjectCategory}`;
  }

  if (request.publisher) {
    prompt += `\n- ${request.contentType === "book" ? "출판사" : "플랫폼"}: ${request.publisher}`;
  }

  if (request.totalUnits) {
    prompt += `\n- 총 ${unitTypeKo}: ${request.totalUnits}${unitTypeKo}`;
  }

  if (request.curriculum) {
    prompt += `\n- 교육과정: ${request.curriculum}개정`;
  }

  if (request.targetGrades && request.targetGrades.length > 0) {
    const gradeStr = request.targetGrades.map((g) => `고${g}`).join(", ");
    prompt += `\n- 대상 학년: ${gradeStr}`;
  }

  if (request.toc) {
    prompt += `\n\n## 목차/강의 목록\n${request.toc}`;
  }

  if (request.description) {
    prompt += `\n\n## 설명\n${request.description}`;
  }

  prompt += `

## 출력 형식
{
  "overallScore": 3.5,
  "confidence": 0.85,
  "vocabularyComplexity": 3.2,
  "conceptDensity": 4.0,
  "prerequisiteDepth": 2,
  "mathematicalComplexity": 3.8,
  "estimatedHoursPerUnit": 0.5,
  "recommendedPace": {
    "beginner": "3 ${unitTypeKo}/세션",
    "intermediate": "5 ${unitTypeKo}/세션",
    "advanced": "8 ${unitTypeKo}/세션"
  },
  "prerequisiteConcepts": ["개념1", "개념2"],
  "keyConceptsCovered": ["핵심개념1", "핵심개념2", "핵심개념3"],
  "reasoning": "분석 근거 설명..."
}`;

  return prompt;
}

// ============================================
// Response Parser
// ============================================

/**
 * AI 응답 파싱 및 검증
 */
export function parseDifficultyAssessmentResponse(
  response: string
): DifficultyAssessmentResult {
  // JSON 추출 시도
  let jsonStr = response;

  // 코드 블록 제거
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  // JSON 파싱
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr.trim());
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${response.slice(0, 200)}`);
  }

  // 타입 가드
  if (!isValidDifficultyResult(parsed)) {
    throw new Error("AI response does not match expected schema");
  }

  // 값 범위 검증 및 보정
  return {
    overallScore: clamp(parsed.overallScore, 0, 5),
    confidence: clamp(parsed.confidence, 0, 1),
    vocabularyComplexity: clamp(parsed.vocabularyComplexity, 0, 5),
    conceptDensity: clamp(parsed.conceptDensity, 0, 5),
    prerequisiteDepth: clamp(parsed.prerequisiteDepth, 1, 5),
    mathematicalComplexity: clamp(parsed.mathematicalComplexity, 0, 5),
    estimatedHoursPerUnit: Math.max(0, parsed.estimatedHoursPerUnit),
    recommendedPace: {
      beginner: parsed.recommendedPace?.beginner || "3 페이지/세션",
      intermediate: parsed.recommendedPace?.intermediate || "5 페이지/세션",
      advanced: parsed.recommendedPace?.advanced || "8 페이지/세션",
    },
    prerequisiteConcepts: Array.isArray(parsed.prerequisiteConcepts)
      ? parsed.prerequisiteConcepts
      : [],
    keyConceptsCovered: Array.isArray(parsed.keyConceptsCovered)
      ? parsed.keyConceptsCovered
      : [],
    reasoning: parsed.reasoning || "",
  };
}

/**
 * 응답 유효성 검사
 */
function isValidDifficultyResult(data: unknown): data is DifficultyAssessmentResult {
  if (!data || typeof data !== "object") return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.overallScore === "number" &&
    typeof obj.confidence === "number" &&
    typeof obj.vocabularyComplexity === "number" &&
    typeof obj.conceptDensity === "number" &&
    typeof obj.prerequisiteDepth === "number" &&
    typeof obj.mathematicalComplexity === "number" &&
    typeof obj.estimatedHoursPerUnit === "number"
  );
}

/**
 * 값 범위 제한
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ============================================
// Token Estimation
// ============================================

/**
 * 프롬프트 토큰 수 추정
 */
export function estimateDifficultyPromptTokens(
  request: DifficultyAssessmentRequest
): number {
  const systemTokens = estimateTokens(DIFFICULTY_ASSESSMENT_SYSTEM_PROMPT);
  const userPrompt = buildDifficultyAssessmentPrompt(request);
  const userTokens = estimateTokens(userPrompt);

  // 예상 응답 토큰 (약 500)
  const responseTokens = 500;

  return systemTokens + userTokens + responseTokens;
}

// ============================================
// Difficulty Level Mapping
// ============================================

/**
 * 점수를 난이도 레벨로 변환
 */
export function scoreToDifficultyLevel(score: number): "easy" | "medium" | "hard" {
  if (score < 2) return "easy";
  if (score < 3.5) return "medium";
  return "hard";
}

/**
 * 점수를 한글 난이도로 변환
 */
export function scoreToDifficultyLabel(score: number): string {
  if (score < 1) return "매우 쉬움";
  if (score < 2) return "쉬움";
  if (score < 3) return "보통";
  if (score < 4) return "어려움";
  return "매우 어려움";
}

/**
 * 학생 수준과 콘텐츠 난이도 적합성 계산
 */
export function calculateDifficultyFit(
  studentLevel: number, // 1-5
  contentDifficulty: number // 0-5
): "too_easy" | "appropriate" | "challenging" | "too_hard" {
  const diff = contentDifficulty - studentLevel;

  if (diff < -1) return "too_easy";
  if (diff < 0.5) return "appropriate";
  if (diff < 1.5) return "challenging";
  return "too_hard";
}

// ============================================
// Subject-Specific Adjustments
// ============================================

/**
 * 과목별 기본 난이도 가중치
 */
export const SUBJECT_DIFFICULTY_WEIGHTS: Record<string, number> = {
  // 수학 계열 (수리적 복잡도 높음)
  수학: 1.1,
  "미적분": 1.2,
  "기하": 1.15,
  "확률과통계": 1.1,

  // 과학 계열 (개념 밀도 높음)
  물리학: 1.15,
  화학: 1.1,
  생명과학: 1.0,
  지구과학: 1.0,

  // 언어 계열
  국어: 1.0,
  영어: 1.0,

  // 사회 계열
  한국사: 0.95,
  사회문화: 0.95,
  윤리와사상: 1.0,
  정치와법: 1.0,
  경제: 1.05,
};

/**
 * 과목별 가중치 적용
 */
export function applySubjectWeight(
  score: number,
  subject: string
): number {
  const weight = SUBJECT_DIFFICULTY_WEIGHTS[subject] || 1.0;
  return clamp(score * weight, 0, 5);
}
