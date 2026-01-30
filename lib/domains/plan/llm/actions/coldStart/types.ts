/**
 * 콜드 스타트 추천 시스템 타입 정의
 *
 * 이 파일은 콜드 스타트 추천 파이프라인에서 사용하는 모든 타입을 정의합니다.
 * 각 Task의 Input/Output 타입이 명확하게 분리되어 있어
 * 독립적인 테스트와 개발이 가능합니다.
 *
 * 파이프라인 흐름:
 * Task 1 (입력 검증) → Task 2 (쿼리 생성) → Task 3 (웹 검색)
 * → Task 4 (결과 파싱) → Task 5 (정렬/필터)
 */

// ============================================================================
// 공통 타입
// ============================================================================

/**
 * 지원하는 교과 목록
 * - 현재 고등학교 주요 교과만 지원
 * - 향후 중학교, 초등학교 교과 추가 가능
 */
export const SUPPORTED_SUBJECT_CATEGORIES = [
  "국어",
  "수학",
  "영어",
  "한국사",
  "사회",
  "과학",
] as const;

export type SubjectCategory = (typeof SUPPORTED_SUBJECT_CATEGORIES)[number];

/**
 * 교과별 세부 과목 매핑
 * - 각 교과에 속하는 세부 과목들을 정의
 * - 사용자가 더 구체적인 검색을 원할 때 사용
 */
export const SUBJECTS_BY_CATEGORY: Record<SubjectCategory, string[]> = {
  국어: ["국어", "화법과 작문", "독서", "언어와 매체", "문학"],
  수학: ["수학", "수학I", "수학II", "미적분", "확률과 통계", "기하"],
  영어: ["영어", "영어I", "영어II", "영어 독해와 작문"],
  한국사: ["한국사"],
  사회: ["통합사회", "한국지리", "세계지리", "동아시아사", "세계사", "경제", "정치와 법", "사회문화", "생활과 윤리", "윤리와 사상"],
  과학: ["통합과학", "물리학I", "물리학II", "화학I", "화학II", "생명과학I", "생명과학II", "지구과학I", "지구과학II"],
};

/**
 * 난이도 레벨
 * - 개념: 기초 개념 학습용
 * - 기본: 기본 문제 풀이용
 * - 심화: 고난도 문제 대비용
 */
export const DIFFICULTY_LEVELS = ["개념", "기본", "심화"] as const;

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/**
 * 콘텐츠 타입
 * - book: 교재, 문제집
 * - lecture: 인터넷 강의
 */
export const CONTENT_TYPES = ["book", "lecture"] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

// ============================================================================
// Task 1: 입력 검증
// ============================================================================

/**
 * Task 1 입력: 사용자가 선택한 값들
 *
 * @example
 * {
 *   subjectCategory: "수학",
 *   subject: "미적분",
 *   difficulty: "개념",
 *   contentType: "book"
 * }
 */
export interface ColdStartRawInput {
  /** 교과 (필수) - 국어, 수학, 영어 등 */
  subjectCategory?: string;

  /** 과목 (선택) - 미적분, 문학 등 세부 과목 */
  subject?: string;

  /** 난이도 (선택) - 개념, 기본, 심화 */
  difficulty?: string;

  /** 콘텐츠 타입 (선택) - book 또는 lecture */
  contentType?: string;
}

/**
 * Task 1 출력: 검증된 입력값
 *
 * 성공 시 validatedInput에 검증된 값이 들어갑니다.
 * 실패 시 error에 에러 메시지가 들어갑니다.
 */
export type ValidateInputResult =
  | {
      success: true;
      validatedInput: ValidatedColdStartInput;
    }
  | {
      success: false;
      error: string;
    };

/**
 * 검증이 완료된 입력값
 * - 모든 필드가 유효한 타입으로 변환됨
 */
export interface ValidatedColdStartInput {
  subjectCategory: SubjectCategory;
  subject: string | null;
  difficulty: DifficultyLevel | null;
  contentType: ContentType | null;
}

// ============================================================================
// Task 2: 검색 쿼리 생성
// ============================================================================

/**
 * Task 2 출력: 생성된 검색 쿼리
 *
 * @example
 * {
 *   query: "고등학교 수학 미적분 개념 교재 추천 목차",
 *   context: "미적분 개념서"
 * }
 */
export interface SearchQuery {
  /** 웹 검색에 사용할 검색어 */
  query: string;

  /** AI에게 전달할 맥락 정보 (어떤 콘텐츠를 찾는지) */
  context: string;
}

// ============================================================================
// Task 3: 웹 검색 실행
// ============================================================================

/**
 * Task 3 출력: 웹 검색 결과 (파싱 전)
 *
 * 성공 시 rawContent에 AI 응답 텍스트가 들어갑니다.
 * 실패 시 error에 에러 메시지가 들어갑니다.
 */
export type ExecuteSearchResult =
  | {
      success: true;
      rawContent: string;
    }
  | {
      success: false;
      error: string;
    };

// ============================================================================
// Task 4: 결과 파싱
// ============================================================================

// ============================================================================
// 추천 근거 관련 타입 (Recommendation Metadata)
// ============================================================================

/**
 * 추천 이유 카테고리
 * - quality: 콘텐츠 품질 관련
 * - popularity: 인기도/평판 관련
 * - suitability: 학습자 적합성 관련
 * - structure: 구성/체계 관련
 */
export type RecommendationReasonCategory =
  | "quality"
  | "popularity"
  | "suitability"
  | "structure";

/**
 * 추천 이유 항목
 */
export interface RecommendationReason {
  /** 카테고리 */
  category: RecommendationReasonCategory;

  /** 추천 이유 텍스트 */
  text: string;

  /** 신뢰도 (0-1) */
  confidence?: number;
}

/**
 * 후기/리뷰 하이라이트
 */
export interface ReviewHighlight {
  /** 후기 유형 */
  type: "positive" | "negative" | "neutral";

  /** 후기 내용 */
  text: string;

  /** 출처 (네이버, 인터파크 등) */
  source?: string;
}

/**
 * 후기/리뷰 요약 정보
 */
export interface ReviewSummary {
  /** 평균 평점 (5점 만점) */
  averageRating?: number;

  /** 총 리뷰 수 */
  reviewCount?: number;

  /** 긍정적 후기 요약 */
  positives?: string[];

  /** 부정적 후기 요약 */
  negatives?: string[];

  /** 핵심 후기 하이라이트 */
  highlights?: ReviewHighlight[];

  /** 자주 언급되는 키워드 */
  keywords?: string[];
}

/**
 * 콘텐츠 특성 정보
 */
export interface ContentCharacteristics {
  /** 장점 */
  strengths?: string[];

  /** 단점/주의사항 */
  weaknesses?: string[];

  /** 난이도 분포 (%) */
  difficultyBreakdown?: {
    basic: number;
    standard: number;
    advanced: number;
  };

  /** 학습 스타일 적합도 (0-100) */
  learningStyles?: {
    visual: number;
    conceptual: number;
    practice: number;
  };
}

/**
 * 추천 메타데이터 (DB 저장용)
 */
export interface RecommendationMetadata {
  /** 추천 정보 */
  recommendation: {
    /** 추천 점수 (0-100) */
    score: number;

    /** 추천 이유 요약 */
    summary: string;

    /** 상세 추천 이유 */
    reasons: RecommendationReason[];

    /** 추천 대상 학생 유형 */
    targetStudents: string[];
  };

  /** 후기/리뷰 정보 */
  reviews?: ReviewSummary;

  /** 콘텐츠 특성 */
  characteristics?: ContentCharacteristics;

  /** 메타 정보 */
  meta: {
    /** 데이터 수집 일시 */
    collectedAt: string;

    /** 데이터 소스 */
    sources: string[];

    /** 신뢰도 (0-1) */
    reliability: number;
  };
}

// ============================================================================
// Task 4: 결과 파싱 - 강사 정보 (lecture 콘텐츠용)
// ============================================================================

/**
 * 강사 정보 (AI 검색에서 수집)
 *
 * lecture 콘텐츠의 경우 강사에 대한 상세 정보를 함께 수집합니다.
 * 이 정보는 master_instructors 테이블에 저장될 수 있습니다.
 */
export interface InstructorInfo {
  /** 강사명 (필수) */
  name: string;

  /** 플랫폼 (메가스터디, 이투스, 대성마이맥, EBS 등) */
  platform?: string;

  /** 프로필 요약 (경력, 소개) */
  profileSummary?: string;

  /** 담당 교과 목록 */
  subjectCategories?: string[];

  /** 담당 세부 과목 목록 */
  subjects?: string[];

  /** 전문 영역 (개념 설명, 문제풀이, 실전 대비 등) */
  specialty?: string;

  /**
   * 강의 스타일
   * - 개념형: 개념 설명 위주
   * - 문풀형: 문제 풀이 위주
   * - 속성형: 빠른 진도, 핵심만
   * - 심화형: 깊이 있는 설명
   * - 균형형: 개념과 문제 풀이 균형
   */
  teachingStyle?: "개념형" | "문풀형" | "속성형" | "심화형" | "균형형" | string;

  /**
   * 주력 난이도
   * - 개념: 기초 개념 설명
   * - 기본: 중간 난이도
   * - 심화: 고난도
   * - 최상위: 최고 난이도
   */
  difficultyFocus?: "개념" | "기본" | "심화" | "최상위" | string;

  /**
   * 강의 속도
   * - 빠름: 빠른 진행
   * - 보통: 평균 속도
   * - 느림: 천천히 설명
   */
  lecturePace?: "빠름" | "보통" | "느림" | string;

  /**
   * 설명 방식
   * - 친절함: 상세하고 친절한 설명
   * - 핵심만: 핵심 위주 간결한 설명
   * - 반복강조: 중요 내용 반복
   * - 비유활용: 비유와 예시 활용
   */
  explanationStyle?: "친절함" | "핵심만" | "반복강조" | "비유활용" | string;

  /** 평균 리뷰 점수 (5점 만점) */
  reviewScore?: number;

  /** 총 리뷰 수 */
  reviewCount?: number;

  /** 추천 대상 학생 유형 */
  targetStudents?: string[];

  /** 강사 장점 */
  strengths?: string[];

  /** 강사 단점/주의사항 */
  weaknesses?: string[];

  /** 추천 이유 */
  recommendationReasons?: string[];
}

// ============================================================================
// Task 4: 결과 파싱 - 콘텐츠 정보
// ============================================================================

/**
 * 챕터/강의 정보
 * - 목차의 각 항목을 나타냄
 * - 플랜 생성 시 범위 지정에 사용됨
 */
export interface ChapterInfo {
  /** 챕터 제목 (예: "1. 수열의 극한") */
  title: string;

  /** 시작 범위 (페이지 번호 또는 강의 번호) */
  startRange: number;

  /** 종료 범위 (페이지 번호 또는 강의 번호) */
  endRange: number;

  /** 해당 챕터/에피소드 소요시간 (분) */
  duration?: number;
}

/**
 * 파싱된 콘텐츠 아이템
 * - 교재 또는 강의 하나를 나타냄
 * - 기존 VirtualContentItem과 호환됨
 */
export interface ParsedContentItem {
  /** 제목 (필수) */
  title: string;

  /** 저자 또는 강사 */
  author?: string;

  /** 출판사 또는 플랫폼 */
  publisher?: string;

  /** 콘텐츠 타입 - book 또는 lecture */
  contentType: ContentType;

  /** 총 범위 - 총 페이지 수 또는 총 강의 수 (필수) */
  totalRange: number;

  /** 목차 정보 - 챕터별 범위 */
  chapters: ChapterInfo[];

  /** 설명 또는 특징 */
  description?: string;

  /** 총 예상 소요시간 (시간 단위) */
  estimatedHours?: number;

  /** 평균 에피소드 길이 (분 단위) - 강의 콘텐츠용 */
  averageEpisodeDuration?: number;

  // ────────────────────────────────────────────────────────────────────
  // 추천 근거 정보 (AI 검색에서 수집)
  // ────────────────────────────────────────────────────────────────────

  /** 추천 이유 목록 */
  recommendationReasons?: string[];

  /** 추천 대상 학생 유형 */
  targetStudents?: string[];

  /** 후기/리뷰 요약 */
  reviewSummary?: ReviewSummary;

  /** 장점 목록 */
  strengths?: string[];

  /** 단점/주의사항 목록 */
  weaknesses?: string[];

  // ────────────────────────────────────────────────────────────────────
  // 강사 정보 (lecture 콘텐츠 전용)
  // ────────────────────────────────────────────────────────────────────

  /**
   * 강사 상세 정보 (lecture 콘텐츠인 경우)
   *
   * 이 정보는 master_instructors 테이블에 저장됩니다.
   */
  instructorInfo?: InstructorInfo;
}

/**
 * Task 4 출력: 파싱된 콘텐츠 목록
 */
export type ParseResultsResult =
  | {
      success: true;
      items: ParsedContentItem[];
    }
  | {
      success: false;
      error: string;
    };

// ============================================================================
// Task 5: 결과 정렬 및 필터링
// ============================================================================

/**
 * 사용자 선호도 설정
 * - 결과를 필터링하고 정렬하는 데 사용
 */
export interface UserPreferences {
  /** 원하는 콘텐츠 타입 (없으면 전체) */
  contentType?: ContentType | null;

  /** 최대 결과 개수 (기본: 5) */
  maxResults?: number;
}

/**
 * 추천 결과 아이템
 * - ParsedContentItem에 추천 관련 정보가 추가됨
 */
export interface RecommendationItem extends ParsedContentItem {
  /** 추천 순위 (1부터 시작) */
  rank: number;

  /** 일치도 점수 (0-100) */
  matchScore: number;

  /** 추천 이유 (간단 요약) */
  reason: string;

  /** 추천 메타데이터 (DB 저장용 상세 정보) */
  recommendationMetadata?: RecommendationMetadata;
}

/**
 * Task 5 출력: 최종 추천 결과
 */
export interface RankResultsResult {
  success: true;
  recommendations: RecommendationItem[];

  /** 검색된 전체 개수 */
  totalFound: number;

  /** 필터 후 반환된 개수 */
  filtered: number;
}

// ============================================================================
// 파이프라인 통합
// ============================================================================

/**
 * DB 저장 통계 (파이프라인에서 saveToDb 옵션 사용 시)
 */
export interface PersistenceStats {
  /** 새로 저장된 콘텐츠 수 */
  newlySaved: number;

  /** 중복으로 스킵된 수 */
  duplicatesSkipped: number;

  /** 저장된 콘텐츠 ID 목록 */
  savedIds: string[];

  /** 저장 에러 목록 */
  errors: Array<{ title: string; error: string }>;
}

/**
 * 콜드 스타트 파이프라인 최종 결과
 */
export type ColdStartPipelineResult =
  | {
      success: true;
      recommendations: RecommendationItem[];
      stats: {
        totalFound: number;
        filtered: number;
        searchQuery: string;
        /** Rate limit 또는 Parse 실패 시 DB fallback을 사용했는지 */
        usedFallback?: boolean;
        /** Fallback 사용 이유 */
        fallbackReason?: "rate_limit" | "parse_failure";
      };
      /** DB 저장 통계 (saveToDb 옵션 사용 시에만 포함) */
      persistence?: PersistenceStats;
    }
  | {
      success: false;
      error: string;
      /** 어느 단계에서 실패했는지 */
      failedAt: "validation" | "query" | "search" | "parse" | "rank" | "persistence";
    };
