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

// ============================================================
// 학생 프로필 컨텍스트 (가이드 생성 시 선택적 주입)
// ============================================================

/** 가이드 생성 시 학생 진로/역량 맥락 — 없으면 범용 가이드 생성 */
export interface StudentProfileContext {
  studentId: string;
  name: string;
  /** 희망 전공 (예: "정치·외교") — students.target_major */
  targetMajor?: string;
  /** 희망 계열 코드 (예: "SOC") — students.desired_career_field */
  desiredCareerField?: string;
  /** 역량 진단 상위 항목 (예: ["탐구력", "진로탐색"]) */
  topCompetencies?: string[];
  /** 역량 진단 하위 항목 (보완 필요) */
  weakCompetencies?: string[];
  /** 스토리라인 키워드 (예: ["국제인권", "난민정책"]) */
  storylineKeywords?: string[];
  /** 전공 권장교과 — getMajorRecommendedCourses() 결과 */
  recommendedCourses?: {
    general: string[];
    career: string[];
    fusion?: string[];
  };
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
  /** 학생 프로필 (선택) — 있으면 진로 연계 가이드, 없으면 범용 */
  studentProfile?: StudentProfileContext;
  /** 학생 ID (선택) — studentProfile이 없으면 이 ID로 자동 로드 */
  studentId?: string;
  /** 활성 섹션 키 목록 (선택) — 지정 시 이 섹션들만 AI가 생성 */
  selectedSectionKeys?: string[];
}

// ============================================================
// Zod 스키마 (generateObjectWithRateLimit용)
// ============================================================

/** 참고 자료 항목 (AI 생성용) */
const resourceItemSchema = z.object({
  description: z
    .string()
    .describe(
      "참고 자료 설명 (1~2문장, 100자 이내). URL 포함 금지. 예: '니켈 촉매의 활성 온도는 300-400°C 범위로 보고됨(김○○, 2022)'",
    ),
  consultantHint: z
    .string()
    .optional()
    .describe(
      "컨설턴트용 검색 안내 (30자 이내). 예: 'RISS: 니켈 촉매 메탄화 활성 온도'",
    ),
});

/** 목차형 아웃라인 항목 */
const outlineItemSchema = z.object({
  depth: z
    .enum(["0", "1", "2"])
    .transform((v): 0 | 1 | 2 => Number(v) as 0 | 1 | 2)
    .describe("계층 깊이: 0=대주제, 1=중주제, 2=세부항목"),
  text: z.string().describe("항목 텍스트"),
  tip: z
    .string()
    .optional()
    .describe(
      "학생 행동 지시 팁 — 전체 outline에서 6~10개 항목에 반드시 포함. 예: '5회 반복 실험하여 표준편차 산출'",
    ),
  resources: z
    .array(resourceItemSchema)
    .optional()
    .describe(
      "참고 자료 — AI가 조사한 내용을 설명 텍스트로 제공 (URL 포함 금지). 전체 outline에서 5~8개 항목에 반드시 포함. 각 항목은 학생에게 추가 맥락을 주는 설명과, 컨설턴트에게 링크 등록을 안내하는 힌트로 구성",
    ),
});

const theorySectionSchema = z.object({
  order: z.number().describe("섹션 순서 (1부터 시작)"),
  title: z.string().describe("이론 섹션 제목"),
  content: z.string().describe("이론 내용 (HTML 형식, 2000자 이내)"),
  outline: z
    .array(outlineItemSchema)
    .optional()
    .describe("목차형 아웃라인 (레거시 호환)"),
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
  content: z.string().describe("섹션 내용 (HTML 형식, 산문형)"),
  items: z
    .array(z.string())
    .optional()
    .describe("목록형 데이터 (HTML 태그 없이 순수 텍스트, 학습목표/재료 등)"),
  order: z.number().optional().describe("복수 섹션 순서"),
  outline: z
    .array(outlineItemSchema)
    .optional()
    .describe(
      "목차형 아웃라인 (탐구이론 content_sections에 필수 — 산문 content와 병행). 전체 합산 40개 이상, tip 6개+, resources 5개+ 포함 필수",
    ),
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

  // 레거시 필드 (하위 호환 — Phase 2 이후 점진 폐기)
  motivation: z.string().optional().describe("레거시: 탐구 동기 (HTML 형식)"),
  theorySections: z
    .array(theorySectionSchema)
    .optional()
    .describe("레거시: 탐구 이론 섹션"),
  reflection: z.string().optional().describe("레거시: 탐구 고찰 (HTML 형식)"),
  impression: z.string().optional().describe("레거시: 느낀점 (HTML 형식)"),
  summary: z.string().optional().describe("레거시: 탐구 요약 (HTML 형식)"),
  followUp: z.string().optional().describe("레거시: 후속 탐구 (HTML 형식)"),
  bookDescription: z
    .string()
    .optional()
    .describe("도서 소개 (HTML 형식)"),

  // 유형별 섹션 배열 (section-config 기반)
  sections: z
    .array(contentSectionSchema)
    .min(1)
    .describe("유형별 섹션 데이터 — section-config의 key와 일치해야 합니다"),

  relatedPapers: z
    .array(relatedPaperSchema)
    .max(3)
    .optional()
    .describe("관련 논문 (0~3개)"),
  setekExamples: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("교과 세특 예시 (0~3개, 각 200~500자, HTML 형식)"),
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
    outlineQuality: z
      .number()
      .min(0)
      .max(100)
      .describe("탐구 로드맵 품질 (outline 없으면 0)"),
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
