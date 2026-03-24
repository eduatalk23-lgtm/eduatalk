import { z } from "zod";
import type { GuideType, QualityTier } from "../types";
import type { ModelTier } from "@/lib/domains/plan/llm/types";

// ============================================================
// C3: AI 가이드 생성 입출력 타입
// ============================================================

/** 생성 소스 타입 */
export type GuideGenerationSource =
  | "keyword"
  | "clone_variant"
  | "pdf_extract"
  | "url_extract";

/** 키워드 기반 생성 입력 */
export interface KeywordGenerationInput {
  keyword: string;
  guideType: GuideType;
  targetSubject?: string;
  targetCareerField?: string;
  additionalContext?: string;
}

/** 기존 가이드 변형 입력 */
export interface CloneVariantInput {
  sourceGuideId: string;
  targetSubject?: string;
  targetCareerField?: string;
  variationNote?: string;
}

/** PDF 추출 기반 생성 입력 */
export interface PDFExtractionInput {
  pdfUrl: string;
  guideType: GuideType;
  targetSubject?: string;
  targetCareerField?: string;
  additionalContext?: string;
}

/** URL 추출 기반 생성 입력 */
export interface URLExtractionInput {
  url: string;
  guideType: GuideType;
  targetSubject?: string;
  targetCareerField?: string;
  additionalContext?: string;
}

/** AI 가이드 생성 통합 입력 */
export interface GuideGenerationInput {
  source: GuideGenerationSource;
  keyword?: KeywordGenerationInput;
  clone?: CloneVariantInput;
  pdf?: PDFExtractionInput;
  url?: URLExtractionInput;
  /** 교육과정 연도 (예: "2022") */
  curriculumYear?: string;
  /** 교과명 (예: "과학과") */
  subjectArea?: string;
  /** 교과 과목명 (예: "통합과학1") */
  subjectSelect?: string;
  /** 대단원명 (예: "물질과 규칙성") */
  unitMajor?: string;
  /** 소단원명 (예: "원소의 주기성") */
  unitMinor?: string;
  /** AI 모델 티어 (fast=Flash, advanced=Pro) — 기본 fast */
  modelTier?: ModelTier;
}

// ============================================================
// Zod 스키마 (generateObjectWithRateLimit용)
// ============================================================

const theorySectionSchema = z.object({
  order: z.number().describe("섹션 순서 (1부터 시작)"),
  title: z.string().describe("이론 섹션 제목"),
  content: z.string().describe("이론 내용 (HTML 형식, 2000자 이내)"),
});

const relatedPaperSchema = z.object({
  title: z.string().describe("논문 제목"),
  url: z.string().optional().describe("논문 URL"),
  summary: z.string().optional().describe("논문 요약 (1~2문장)"),
});

/** AI가 생성하는 개별 섹션 */
const contentSectionSchema = z.object({
  key: z.string().describe("섹션 키 (config의 key와 일치)"),
  label: z.string().describe("섹션 표시명"),
  content: z.string().describe("섹션 내용 (HTML 형식)"),
  items: z
    .array(z.string())
    .optional()
    .describe("목록형 데이터 (재료 목록 등)"),
  order: z.number().optional().describe("복수 섹션 순서"),
});

/** AI가 생성하는 가이드 콘텐츠 구조 (유형별 섹션 지원) */
export const generatedGuideSchema = z.object({
  title: z.string().describe("가이드 제목 (20~60자)"),
  guideType: z
    .enum([
      "reading",
      "topic_exploration",
      "subject_performance",
      "experiment",
      "program",
    ])
    .describe("가이드 유형"),
  bookTitle: z
    .string()
    .optional()
    .describe("관련 도서명 (독서탐구인 경우 필수)"),
  bookAuthor: z.string().optional().describe("도서 저자"),
  bookPublisher: z.string().optional().describe("출판사"),

  // 레거시 필드 (하위 호환)
  motivation: z.string().describe("탐구 동기 (HTML 형식)"),
  theorySections: z
    .array(theorySectionSchema)
    .min(2)
    .max(5)
    .describe("탐구 이론 섹션 (2~5개)"),
  reflection: z.string().describe("탐구 고찰 (HTML 형식)"),
  impression: z.string().describe("느낀점 (HTML 형식)"),
  summary: z.string().describe("탐구 요약 (HTML 형식)"),
  followUp: z.string().describe("후속 탐구 (HTML 형식)"),
  bookDescription: z
    .string()
    .optional()
    .describe("도서 소개 (HTML 형식)"),

  // 신규: 유형별 섹션 배열
  sections: z
    .array(contentSectionSchema)
    .optional()
    .describe("유형별 섹션 데이터 (config 기반, 신규 가이드용)"),

  relatedPapers: z
    .array(relatedPaperSchema)
    .max(3)
    .optional()
    .describe("관련 논문 (0~3개)"),
  setekExamples: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("교과 세특 예시 (0~3개, 각 200자 내외)"),
  suggestedSubjects: z
    .array(z.string())
    .max(5)
    .describe("관련 과목명 (한글, 최대 5개)"),
  suggestedCareerFields: z
    .array(z.string())
    .max(3)
    .describe("관련 계열 (한글, 최대 3개)"),
  suggestedClassifications: z
    .array(z.string())
    .max(5)
    .optional()
    .describe(
      "관련 KEDI 학과 소분류명 (예: '전산학ㆍ컴퓨터공학', '경영학', '물리학'). 확실한 것만 최대 5개.",
    ),
});

export type GeneratedGuideOutput = z.infer<typeof generatedGuideSchema>;

// ============================================================
// AI 리뷰 스키마
// ============================================================

export const guideReviewSchema = z.object({
  overallScore: z.number().min(0).max(100).describe("전체 점수 (0~100)"),
  dimensions: z.object({
    academicDepth: z.number().min(0).max(100).describe("학술적 깊이"),
    studentAccessibility: z.number().min(0).max(100).describe("학생 접근성"),
    structuralCompleteness: z.number().min(0).max(100).describe("구조적 완성도"),
    practicalRelevance: z.number().min(0).max(100).describe("실용적 연관성"),
  }),
  feedback: z.array(z.string()).describe("개선 피드백 (구체적 제안)"),
  strengths: z.array(z.string()).describe("강점"),
});

export type GuideReviewOutput = z.infer<typeof guideReviewSchema>;

/** 리뷰 점수 → QualityTier 매핑 */
export function scoreToQualityTier(score: number): QualityTier {
  if (score >= 80) return "ai_reviewed_approved";
  // 60~79: human review 필요하지만 ai_draft 유지
  return "ai_draft";
}

/** 리뷰 점수 → 상태 매핑 */
export function scoreToStatus(score: number): "pending_approval" | "review_failed" {
  if (score >= 60) return "pending_approval";
  return "review_failed";
}

// ============================================================
// AI 주제 추천 스키마
// ============================================================

export const suggestedTopicsSchema = z.object({
  topics: z
    .array(
      z.object({
        title: z.string().describe("탐구 주제 타이틀 (20~60자)"),
        reason: z.string().describe("추천 이유 (1문장)"),
        relatedSubjects: z
          .array(z.string())
          .max(3)
          .describe("연계 가능 과목 (최대 3개)"),
      }),
    )
    .min(5)
    .max(10)
    .describe("추천 탐구 주제 목록"),
});

export type SuggestedTopicsOutput = z.infer<typeof suggestedTopicsSchema>;
