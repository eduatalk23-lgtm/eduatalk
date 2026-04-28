// ============================================================
// CMS C1: 탐구 가이드 도메인 타입
// ============================================================

// ------------------------------------
// 1. 상수 타입
// ------------------------------------

export const GUIDE_TYPES = [
  // 세특용 5종 (기존)
  "reading",
  "topic_exploration",
  "subject_performance",
  "experiment",
  "program",
  // 창체용 3종 (Phase 2 Wave 1.1 추가)
  "reflection_program", // 자율·자치 — 학교 프로그램 + 인문학적 성찰
  "club_deep_dive", // 동아리 — 전공 심화 + 지속성
  "career_exploration_project", // 진로 — 자기주도 조사·탐색
] as const;
export type GuideType = (typeof GUIDE_TYPES)[number];

export const GUIDE_STATUSES = [
  "draft",
  "ai_generating",
  "ai_improving",
  "ai_failed",
  "ai_partial",
  "ai_reviewing",
  "review_failed",
  "awaiting_input",
  "pending_approval",
  "approved",
  "archived",
  "queued_generation",
] as const;
export type GuideStatus = (typeof GUIDE_STATUSES)[number];

export const GUIDE_SOURCE_TYPES = [
  "imported",
  "manual",
  "manual_edit",
  "ai_keyword",
  "ai_pdf_extract",
  "ai_url_extract",
  "ai_clone_variant",
  "ai_improve",
  "ai_hybrid",
  "ai_pipeline_design",
  "revert",
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

export const DIFFICULTY_LEVELS = ["basic", "intermediate", "advanced"] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  basic: "기초",
  intermediate: "심화",
  advanced: "고급",
};

// ------------------------------------
// 2. 가이드 타입 (guide_type) 한글 라벨
// ------------------------------------

export const GUIDE_TYPE_LABELS: Record<GuideType, string> = {
  reading: "독서탐구",
  topic_exploration: "주제탐구",
  subject_performance: "교과수행",
  experiment: "실험탐구",
  program: "프로그램",
  reflection_program: "성찰·프로그램",
  club_deep_dive: "동아리 심화",
  career_exploration_project: "진로 탐색",
};

export const GUIDE_STATUS_LABELS: Record<GuideStatus, string> = {
  draft: "초안",
  ai_generating: "AI 생성 중",
  ai_improving: "AI 개선 중",
  ai_failed: "AI 생성 실패",
  ai_partial: "AI 부분 생성",
  ai_reviewing: "AI 검토중",
  review_failed: "검토 실패",
  awaiting_input: "입력 대기",
  pending_approval: "승인 대기",
  approved: "승인됨",
  archived: "보관됨",
  queued_generation: "생성 대기",
};

export const GUIDE_SOURCE_TYPE_LABELS: Record<GuideSourceType, string> = {
  imported: "임포트",
  manual: "수동 작성",
  manual_edit: "수동 편집",
  ai_keyword: "AI 키워드",
  ai_pdf_extract: "AI PDF",
  ai_url_extract: "AI URL",
  ai_clone_variant: "AI 클론",
  ai_improve: "AI 개선",
  ai_hybrid: "AI 하이브리드",
  ai_pipeline_design: "AI 파이프라인 설계",
  revert: "되돌리기",
};

export const QUALITY_TIER_LABELS: Record<QualityTier, string> = {
  expert_authored: "전문가 작성",
  expert_reviewed: "전문가 검토",
  ai_reviewed_approved: "AI 검토통과",
  ai_draft: "AI 초안",
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
  subject_area: string | null;
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
  version: number;
  is_latest: boolean;
  original_guide_id: string | null;
  /** 직전 부모 버전 ID (트리 간선) */
  parent_version_id: string | null;
  /** 버전 생성 사유 (Git commit message) */
  version_message: string | null;
  /** AI 리뷰 세부 결과 */
  review_result: {
    dimensions: Record<string, number>;
    feedback: string[];
    strengths: string[];
    reviewedAt: string;
  } | null;
  /** ask-input: 에이전트가 사용자에게 묻는 질문/선택지/응답 */
  agent_question: {
    question: string;
    choices?: string[];
    context?: string;
  } | null;
  created_at: string;
  updated_at: string;
  /** 난이도 */
  difficulty_level: DifficultyLevel | null;
  /** AI 자동 설정 여부 (false=컨설턴트 수동 변경) */
  difficulty_auto: boolean;
  /** Phase A: 주제 클러스터 ID */
  topic_cluster_id?: string | null;
  /** Phase A: 주제 클러스터명 (findGuides JOIN 결과) */
  topic_cluster_name?: string | null;
  /** 생성자 이름 (findGuides 조인 결과) */
  creator_name?: string | null;
}

/** 참고 자료 항목 — AI가 조사한 설명 + 컨설턴트가 추가하는 링크 */
export interface ResourceItem {
  /** AI가 조사하여 작성한 참고 자료 설명 */
  description: string;
  /** 컨설턴트가 검증 후 추가하는 URL (초기엔 null) */
  url?: string | null;
  /** 컨설턴트에게 보이는 검색/등록 안내 */
  consultantHint?: string;
  /** Claude Web Search로 검증된 출처 발췌 텍스트 */
  citedText?: string;
}

/** 목차형 아웃라인 항목 (3-level hierarchy) */
export interface OutlineItem {
  /** 계층 깊이: 0=대주제, 1=중주제, 2=세부항목 */
  depth: 0 | 1 | 2;
  /** 항목 텍스트 */
  text: string;
  /** 컨설턴트 팁/코멘트 (선택) */
  tip?: string;
  /** 참고 자료 — AI가 조사한 설명 + 컨설턴트가 링크 추가 */
  resources?: (ResourceItem | string)[];
}

/** theory_sections JSONB 내 개별 섹션 */
export interface TheorySection {
  order: number;
  title: string;
  content: string;
  content_format?: ContentFormat;
  image_path?: string;
  images?: TheorySectionImage[];
  /** 목차형 아웃라인 (산문과 병행) */
  outline?: OutlineItem[];
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
  /** Claude Web Search로 검증된 출처 발췌 텍스트 */
  citedText?: string;
  /** 논문 실존 신뢰도: high=확실, medium=불확실, low=존재 의심 */
  confidence?: "high" | "medium" | "low";
  /** 논문이 실존한다고 판단한 근거 */
  verificationNote?: string;
}

/** 유형별 섹션 데이터 (content_sections JSONB) */
export interface ContentSection {
  /** SectionDefinition.key와 매칭 */
  key: string;
  /** 표시명 */
  label: string;
  /** HTML 또는 plain text */
  content: string;
  /** 콘텐츠 형식 */
  content_format: ContentFormat;
  /** 이미지 (선택) */
  images?: TheorySectionImage[];
  /** text_list 타입용 (재료 목록 등) */
  items?: string[];
  /** key_value 타입용 (프로그램 개요 등) */
  metadata?: Record<string, string>;
  /** 복수 섹션 순서 (content_sections에서 같은 key가 여러 개일 때) */
  order?: number;
  /** 목차형 아웃라인 데이터 (산문과 병행) */
  outline?: OutlineItem[];
}

/** exploration_guide_content 테이블 행 */
export interface ExplorationGuideContent {
  guide_id: string;
  // 레거시 필드 (기존 가이드 호환)
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
  // 신규: 유형별 섹션 데이터
  content_sections: ContentSection[];
  created_at: string;
  updated_at: string;
}

/** exploration_guide_career_fields 테이블 행 */
export interface GuideCareerField {
  id: number;
  code: string;
  name_kor: string;
  sort_order: number;
  created_at: string;
}

/** @deprecated Use GuideCareerField instead */
export type CareerField = GuideCareerField;

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
  /** 대상 과목 (세특 영역 타겟) */
  target_subject_id: string | null;
  /** 대상 창체 영역 (autonomy/club/career) */
  target_activity_type: string | null;
  /** 연결 레코드 변경 시 stale 마킹 */
  is_stale: boolean;
  stale_reason: string | null;
  /** AI 추천 사유 */
  ai_recommendation_reason: string | null;
  /** 컨설턴트 피드백 */
  feedback_notes: string | null;
  /** 컨설턴트 확정 시각 */
  confirmed_at: string | null;
  /** 확정한 컨설턴트 UUID */
  confirmed_by: string | null;
  /** Phase β G10 — 배정 시점 난이도 스냅샷 */
  difficulty_level: "basic" | "intermediate" | "advanced" | null;
  /** Phase β G10 — 주제 클러스터 */
  topic_cluster_id: string | null;
  /** Phase β G10 — 배정 시점 학생 레벨 */
  student_level_at_assign: number | null;
  /** G5 학기 1급화 */
  semester: number | null;
  /** 배정 당시 활성 메인 탐구 */
  main_exploration_id: string | null;
  /** 메인 탐구 내 tier */
  main_exploration_tier: "foundational" | "development" | "advanced" | null;
  /** 배정 출처 */
  assignment_source: "auto" | "consultant" | "ai_pipeline" | "ai_recommended";
  /** 난이도 cap 우회 사유 */
  override_reason: string | null;
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
  classifications: Array<{ id: number; mid_name: string; sub_name: string }>;
}

/** 가이드 목록 필터 */
export interface GuideListFilter {
  guideType?: GuideType;
  status?: GuideStatus;
  subjectId?: string;
  careerFieldId?: number;
  classificationId?: number;
  curriculumYear?: string;
  searchQuery?: string;
  tenantId?: string | null;
  /** true면 최신 버전만, false면 전체 (기본: true) */
  latestOnly?: boolean;
  /** 교과 그룹의 과목명 배열 (교과 선택 시 → subject_select IN 쿼리) */
  subjectSelectIn?: string[];
  /** 과목 (미적분, 확률과통계, ...) — 특정 과목 선택 시 */
  subjectSelect?: string;
  /** 대단원 */
  unitMajor?: string;
  /** 소단원 */
  unitMinor?: string;
  /** 소스 타입 (imported, manual, ai_keyword, ...) */
  sourceType?: GuideSourceType;
  /** 품질 등급 (expert_authored, ai_draft, ...) */
  qualityTier?: QualityTier;
  /** 난이도 */
  difficultyLevel?: DifficultyLevel;
  /** Phase A: 주제 클러스터 ID */
  topicClusterId?: string;
  page?: number;
  pageSize?: number;
}

/** AI 추천 주제 (suggested_topics 테이블) */
export interface SuggestedTopic {
  id: string;
  tenant_id: string | null;
  guide_type: string;
  subject_name: string | null;
  career_field: string | null;
  curriculum_year: number | null;
  target_major: string | null;
  subject_group: string | null;
  major_unit: string | null;
  minor_unit: string | null;
  title: string;
  reason: string | null;
  related_subjects: string[];
  used_count: number;
  guide_created_count: number;
  ai_model_version: string | null;
  difficulty_level: DifficultyLevel | null;
  created_at: string;
}

/** 주제 목록 필터 (페이지네이션 포함) */
export interface TopicListFilter {
  guideType?: string;
  subjectName?: string;
  careerField?: string;
  difficultyLevel?: DifficultyLevel;
  subjectGroup?: string;
  majorUnit?: string;
  minorUnit?: string;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

/** 버전 히스토리 아이템 */
export interface GuideVersionItem {
  id: string;
  version: number;
  is_latest: boolean;
  status: GuideStatus;
  source_type: GuideSourceType;
  parent_version_id: string | null;
  version_message: string | null;
  registered_by: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
}

/** 가이드 생성/수정 입력 */
export interface GuideUpsertInput {
  legacyId?: number;
  tenantId?: string | null;
  guideType: GuideType;
  curriculumYear?: string;
  subjectArea?: string;
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
  version?: number;
  isLatest?: boolean;
  originalGuideId?: string;
  parentVersionId?: string;
  versionMessage?: string;
  reviewResult?: Record<string, unknown> | null;
  difficultyLevel?: DifficultyLevel;
  difficultyAuto?: boolean;
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
  /** 신규: 유형별 섹션 데이터 */
  contentSections?: ContentSection[];
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
  /** 세특 대상 과목 UUID */
  targetSubjectId?: string;
  /** 창체 대상 영역 */
  targetActivityType?: "autonomy" | "club" | "career";
  /** 연결 레코드 타입 */
  linkedRecordType?: LinkedRecordType;
  /** 연결 레코드 ID */
  linkedRecordId?: string;
  /** AI 추천 사유 */
  aiRecommendationReason?: string;
  // ---- Phase β G10 — 격자 cap 컨텍스트 (nullable, 점진 도입) ----
  /** 배정 시점 가이드 난이도 스냅샷 */
  difficultyLevel?: "basic" | "intermediate" | "advanced" | null;
  /** 주제 클러스터 */
  topicClusterId?: string | null;
  /** 배정 시점 학생 레벨 (1~5) */
  studentLevelAtAssign?: number | null;
  /** 학기 (1 | 2) */
  semester?: 1 | 2 | null;
  /** 활성 메인 탐구 id */
  mainExplorationId?: string | null;
  /** 메인 탐구 내 tier */
  mainExplorationTier?: "foundational" | "development" | "advanced" | null;
  /** 배정 출처 */
  assignmentSource?: "auto" | "consultant" | "ai_pipeline" | "ai_recommended";
  /** 난이도 cap 우회 사유 */
  overrideReason?: string | null;
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
// 5. 공유 링크 타입
// ------------------------------------

/** exploration_guide_shares 테이블 행 */
export interface GuideShare {
  id: string;
  guide_id: string;
  share_token: string;
  visible_sections: string[];
  created_by: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------
// 6. Import 관련 타입
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
