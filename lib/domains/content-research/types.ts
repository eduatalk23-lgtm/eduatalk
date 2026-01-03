/**
 * 콘텐츠 리서치 도메인 타입 정의
 *
 * AI 메타데이터 추출 및 콘텐츠 등록을 위한 타입 정의
 */

// ============================================
// 콘텐츠 타입
// ============================================

export type ContentType = "book" | "lecture";

// ============================================
// AI 메타데이터 추출 결과
// ============================================

/**
 * 추출된 메타데이터
 */
export interface ExtractedMetadata {
  /** 과목 (예: 수학, 영어, 물리) */
  subject: string | null;
  /** 과목 추론 확신도 (0-1) */
  subjectConfidence: number;

  /** 과목 카테고리 (예: 수학, 영어, 과학탐구) */
  subjectCategory: string | null;
  /** 과목 카테고리 확신도 */
  subjectCategoryConfidence: number;

  /** 난이도 (easy, medium, hard) */
  difficulty: "easy" | "medium" | "hard" | null;
  /** 난이도 확신도 */
  difficultyConfidence: number;

  /** 대상 학년 (예: ["고1", "고2"]) */
  gradeLevel: string[];
  /** 학년 확신도 */
  gradeLevelConfidence: number;

  /** 교육과정 (예: "2015", "2022") */
  curriculum: string | null;
  /** 교육과정 확신도 */
  curriculumConfidence: number;

  /** 강의 유형 (강의 전용) */
  lectureType?: "concept" | "problem" | "review" | "exam_prep" | "intensive" | null;
  /** 강의 유형 확신도 */
  lectureTypeConfidence?: number;

  /** 강사명 (강의 전용, 제목에서 추출 가능한 경우) */
  instructorName?: string | null;

  /** AI 추론 근거 */
  reasoning: string;
}

/**
 * 메타데이터 추출 요청
 */
export interface ExtractMetadataRequest {
  /** 콘텐츠 제목 */
  title: string;
  /** 콘텐츠 타입 */
  contentType: ContentType;
  /** 출판사/플랫폼 (선택) */
  publisher?: string;
  /** 추가 컨텍스트 (선택) */
  additionalContext?: string;
}

/**
 * 메타데이터 추출 결과
 */
export interface ExtractMetadataResult {
  /** 추출 성공 여부 */
  success: boolean;
  /** 추출된 메타데이터 */
  metadata: ExtractedMetadata | null;
  /** 에러 메시지 (실패 시) */
  error?: string;
  /** 사용된 모델 */
  modelId?: string;
  /** 토큰 사용량 */
  tokensUsed?: number;
  /** 비용 (USD) */
  costUsd?: number;
}

// ============================================
// 출판사/플랫폼 패턴
// ============================================

/**
 * 출판사별 난이도 패턴
 */
export interface PublisherPattern {
  name: string;
  keywords: string[];
  defaultDifficulty?: "easy" | "medium" | "hard";
  defaultGradeLevel?: string[];
  subjectHints?: Record<string, string>;
}

// ============================================
// 콘텐츠 등록 관련
// ============================================

/**
 * 간편 콘텐츠 등록 요청 (도서)
 */
export interface QuickBookRegistrationRequest {
  /** 도서 제목 */
  title: string;
  /** 총 페이지 수 (선택) */
  totalPages?: number;
  /** 출판사 (선택) */
  publisherName?: string;
  /** ISBN-13 (선택) */
  isbn13?: string;
  /** AI 추론 메타데이터 사용 여부 */
  useAiMetadata: boolean;
  /** AI 추론 결과 (useAiMetadata가 true인 경우) */
  aiMetadata?: ExtractedMetadata;
  /** 사용자 수정 메타데이터 (AI 결과를 수정한 경우) */
  userOverrides?: Partial<ExtractedMetadata>;
}

/**
 * 간편 콘텐츠 등록 요청 (강의)
 */
export interface QuickLectureRegistrationRequest {
  /** 강의 제목 */
  title: string;
  /** 총 강의 수 */
  totalEpisodes: number;
  /** 총 시간 (분 단위, 선택) */
  totalDuration?: number;
  /** 플랫폼 (선택) */
  platform?: string;
  /** 강사명 (선택) */
  instructorName?: string;
  /** AI 추론 메타데이터 사용 여부 */
  useAiMetadata: boolean;
  /** AI 추론 결과 */
  aiMetadata?: ExtractedMetadata;
  /** 사용자 수정 메타데이터 */
  userOverrides?: Partial<ExtractedMetadata>;
}

// ============================================
// 벌크 임포트 관련
// ============================================

/**
 * 임포트 행 검증 결과
 */
export interface ImportRowValidation {
  /** 행 인덱스 */
  rowIndex: number;
  /** 원본 데이터 */
  originalData: Record<string, unknown>;
  /** 검증 상태 */
  status: "valid" | "needs_review" | "invalid";
  /** 누락 필드 */
  missingFields: string[];
  /** AI 추정값 */
  aiSuggestions?: Partial<ExtractedMetadata>;
  /** 검증 메시지 */
  messages: string[];
  /** 보강된 데이터 (파생 필드 포함) */
  enrichedData?: Record<string, unknown>;
}

/**
 * 벌크 임포트 검증 결과
 */
export interface BulkImportValidationResult {
  /** 총 행 수 */
  totalRows: number;
  /** 유효 행 수 */
  validRows: number;
  /** 검토 필요 행 수 */
  needsReviewRows: number;
  /** 무효 행 수 */
  invalidRows: number;
  /** 개별 행 검증 결과 */
  rows: ImportRowValidation[];
}

// ============================================
// AI 추출 로그 (비용 추적)
// ============================================

/**
 * AI 메타데이터 추출 로그
 */
export interface AIExtractionLog {
  id: string;
  contentType: ContentType;
  contentId?: string;
  inputTitle: string;
  inputPublisher?: string;
  extractedMetadata: ExtractedMetadata;
  confidenceScores: Record<string, number>;
  modelId?: string;
  tokensUsed?: number;
  costUsd?: number;
  userModified: boolean;
  finalMetadata?: ExtractedMetadata;
  createdAt: Date;
}
