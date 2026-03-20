// ============================================================
// CMS C1: 탐구 가이드 도메인 타입
// ============================================================

// ------------------------------------
// 1. 상수 타입
// ------------------------------------

export const GUIDE_TYPES = [
  "reading",
  "topic_exploration",
  "subject_performance",
  "experiment",
  "program",
] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

export const GUIDE_STATUSES = [
  "draft",
  "ai_reviewing",
  "review_failed",
  "pending_approval",
  "approved",
  "archived",
] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const GUIDE_SOURCE_TYPES = [
  "imported",
  "manual",
  "ai_keyword",
  "ai_pdf_extract",
  "ai_url_extract",
  "ai_clone_variant",
  "ai_hybrid",
] as const;
export type GuideSourceType = (typeof GUIDE_SOURCE_TYPES)[number];

export const CONTENT_FORMATS = ["plain", "html", "json"] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const QUALITY_TIERS = [
  "expert_authored",
  "expert_reviewed",
  "ai_reviewed_approved",
  "ai_draft",
] as const;
export type QualityTier = (typeof QUALITY_TIERS)[number];

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "submitted",
  "completed",
  "cancelled",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const LINKED_RECORD_TYPES = [
  "setek",
  "personal_setek",
  "changche",
  "haengteuk",
  "reading",
] as const;
export type LinkedRecordType = (typeof LINKED_RECORD_TYPES)[number];

export const UNIT_TYPES = ["major", "minor", "standard"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// ------------------------------------
// 2. 가이드 타입 (guide_type) 한글 라벨
// ------------------------------------

export const GUIDE_TYPE_LABELS: Record<GuideType, string> = {
  reading: "독서탐구",
  topic_exploration: "주제탐구",
  subject_performance: "교과수행",
  experiment: "실험탐구",
  program: "프로그램",
};

export const GUIDE_STATUS_LABELS: Record<GuideStatus, string> = {
  draft: "초안",
  ai_reviewing: "AI 검토중",
  review_failed: "검토 실패",
  pending_approval: "승인 대기",
  approved: "승인됨",
  archived: "보관됨",
};

// ------------------------------------
// 3. DB Row 타입 (수동 정의 — 타입 생성 후 교체 가능)
// ------------------------------------

/** exploration_guides 테이블 행 */
export interface ExplorationGuide {
  id: string;
  legacy_id: number | null;
  tenant_id: string | null;
  guide_type: GuideType;
  curriculum_year: string | null;
  subject_select: string | null;
  unit_major: string | null;
  unit_minor: string | null;
  title: string;
  book_title: string | null;
  book_author: string | null;
  book_publisher: string | null;
  book_year: number | null;
  status: GuideStatus;
  source_type: GuideSourceType;
  source_reference: string | null;
  parent_guide_id: string | null;
  content_format: ContentFormat;
  quality_score: number | null;
  quality_tier: QualityTier | null;
  registered_by: string | null;
  registered_at: string | null;
  ai_model_version: string | null;
  ai_prompt_version: string | null;
  created_at: string;
  updated_at: string;
}

/** theory_sections JSONB 내 개별 섹션 */
export interface TheorySection {
  order: number;
  title: string;
  content: string;
  content_format?: ContentFormat;
  image_path?: string;
  images?: TheorySectionImage[];
}

/** theory_sections 내 이미지 메타데이터 */
export interface TheorySectionImage {
  url: string;
  source_type: "ai_generated" | "chart" | "manual_upload";
  ai_prompt?: string;
  chart_config?: unknown;
  caption?: string;
  width?: number;
  height?: number;
}

/** related_papers JSONB 내 개별 논문 */
export interface RelatedPaper {
  title: string;
  url?: string;
  summary?: string;
}

/** exploration_guide_content 테이블 행 */
export interface ExplorationGuideContent {
  guide_id: string;
  motivation: string | null;
  theory_sections: TheorySection[];
  reflection: string | null;
  impression: string | null;
  summary: string | null;
  follow_up: string | null;
  book_description: string | null;
  related_papers: RelatedPaper[];
  related_books: string[];
  image_paths: string[];
  guide_url: string | null;
  setek_examples: string[];
  raw_source: unknown | null;
  created_at: string;
  updated_at: string;
}

/** exploration_guide_career_fields 테이블 행 */
export interface CareerField {
  id: number;
  code: string;
  name_kor: string;
  sort_order: number;
  created_at: string;
}

/** exploration_guide_curriculum_units 테이블 행 */
export interface CurriculumUnit {
  id: number;
  curriculum_year: string;
  subject_area: string;
  subject_name: string;
  unit_type: UnitType;
  unit_code: string | null;
  unit_name: string;
  parent_unit_id: number | null;
  learning_elements: string | null;
  sort_order: number;
  created_at: string;
}

/** exploration_guide_assignments 테이블 행 */
export interface GuideAssignment {
  id: string;
  tenant_id: string;
  student_id: string;
  guide_id: string;
  assigned_by: string | null;
  school_year: number;
  grade: number;
  school_name: string | null;
  status: AssignmentStatus;
  student_notes: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  linked_record_type: LinkedRecordType | null;
  linked_record_id: string | null;
  storyline_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------
// 4. 서비스 레이어 타입
// ------------------------------------

/** 가이드 목록 쿼리 (메타만, content 미포함) */
export interface GuideListItem extends ExplorationGuide {
  subject_names?: string[];
  career_field_names?: string[];
}

/** 가이드 상세 (메타 + 본문) */
export interface GuideDetail extends ExplorationGuide {
  content: ExplorationGuideContent | null;
  subjects: Array<{ id: string; name: string }>;
  career_fields: Array<{ id: number; code: string; name_kor: string }>;
}

/** 가이드 목록 필터 */
export interface GuideListFilter {
  guideType?: GuideType;
  status?: GuideStatus;
  subjectId?: string;
  careerFieldId?: number;
  curriculumYear?: string;
  searchQuery?: string;
  tenantId?: string | null;
  page?: number;
  pageSize?: number;
}

/** 가이드 생성/수정 입력 */
export interface GuideUpsertInput {
  legacyId?: number;
  tenantId?: string | null;
  guideType: GuideType;
  curriculumYear?: string;
  subjectSelect?: string;
  unitMajor?: string;
  unitMinor?: string;
  title: string;
  bookTitle?: string;
  bookAuthor?: string;
  bookPublisher?: string;
  bookYear?: number;
  status?: GuideStatus;
  sourceType?: GuideSourceType;
  sourceReference?: string;
  parentGuideId?: string;
  contentFormat?: ContentFormat;
  qualityScore?: number;
  qualityTier?: QualityTier;
  aiModelVersion?: string;
  aiPromptVersion?: string;
  registeredBy?: string;
}

/** 가이드 본문 입력 */
export interface GuideContentInput {
  motivation?: string;
  theorySections?: TheorySection[];
  reflection?: string;
  impression?: string;
  summary?: string;
  followUp?: string;
  bookDescription?: string;
  relatedPapers?: RelatedPaper[];
  relatedBooks?: string[];
  imagePaths?: string[];
  guideUrl?: string;
  setekExamples?: string[];
  rawSource?: unknown;
}

/** 배정 생성 입력 */
export interface AssignmentCreateInput {
  tenantId: string;
  studentId: string;
  guideId: string;
  assignedBy?: string;
  schoolYear: number;
  grade: number;
  schoolName?: string;
  notes?: string;
}

/** 배정 + 가이드 메타 JOIN */
export interface AssignmentWithGuide extends GuideAssignment {
  exploration_guides: Pick<
    ExplorationGuide,
    "id" | "title" | "guide_type" | "book_title" | "book_author" | "status"
  >;
}

/** 가이드 추천 필터 */
export interface GuideRecommendationFilter {
  careerFieldIds?: number[];
  subjectIds?: string[];
  guideType?: GuideType;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

// ------------------------------------
// 5. Import 관련 타입
// ------------------------------------

/** Access DB에서 추출한 가이드 원본 (52 컬럼) */
export interface AccessGuideRow {
  ID: number;
  구분유형: string;
  개정년도: string;
  교과선택: string;
  과목선택: string;
  대단원선택: string;
  소단원선택: string;
  계열선택: string;
  학과: string;
  주제: string;
  탐구동기: string;
  탐구이론: string;
  탐구고찰: string;
  느낀점: string;
  탐구요약: string;
  저자: string;
  출판사: string;
  출판연도: string;
  도서소개: string;
  관련논문1: string;
  논문URL1: string;
  관련논문2: string;
  논문URL2: string;
  관련도서1: string;
  관련도서2: string;
  관련도서3: string;
  교과세특1: string;
  교과세특2: string;
  후속탐구: string;
  도서이름: string;
  등록자: string;
  등록일: string;
  논문요약1: string;
  관련도서4: string;
  관련도서5: string;
  관련도서6: string;
  관련도서7: string;
  원본: string;
  ImagePath1: string;
  탐구이론2: string;
  탐구이론3: string;
  탐구이론4: string;
  탐구이론5: string;
  ImagePath2: string;
  ImagePath3: string;
  ImagePath4: string;
  ImagePath5: string;
  ImagePath6: string;
  ImagePath7: string;
  탐구이론6: string;
  탐구이론7: string;
  가이드URL: string;
  가이드URL_Num: string;
}

/** Import 매칭 결과 */
export interface ImportMatchResult {
  legacyId: number;
  title: string;
  /** 매칭된 과목 목록 (쉼표 구분 복수 과목 각각 매칭) */
  matchedSubjects: Array<{ subjectId: string; subjectName: string }>;
  /** 매칭 실패한 과목명 */
  unmatchedSubjects: string[];
  originalSubjectName: string;
  careerFieldMatched: boolean;
  matchedCareerFieldIds: number[];
  errors: string[];
}

/** Import 배치 결과 */
export interface ImportBatchResult {
  total: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ legacyId: number; error: string }>;
  subjectMatchRate: number;
  careerFieldMatchRate: number;
}
