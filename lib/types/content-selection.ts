/**
 * Phase 3: 콘텐츠 선택 타입 정의
 * 
 * Step3Contents + Step4RecommendedContents 통합을 위한
 * 공통 타입 및 인터페이스 정의
 */

// ============================================================================
// 기본 타입
// ============================================================================

// 공통 타입은 lib/types/common.ts에서 import
import type { ContentType, ExclusionType } from "@/lib/types/common";
export type { ContentType, ExclusionType };

// ============================================================================
// 슬롯 관련 타입
// ============================================================================

/**
 * 슬롯 타입 (콘텐츠 유형)
 */
export type SlotType = "book" | "lecture" | "custom" | "self_study" | "test";

/**
 * 콘텐츠 슬롯 (간소화 타입)
 * @deprecated ContentSlot을 사용하세요 (line 685 참조)
 * 이 타입은 이전 버전과의 호환성을 위해 남겨둡니다.
 * 실제 ContentSlot 타입은 SlotTemplate을 확장한 완전한 버전입니다.
 */
export type ContentSlotLegacy = {
  /** 슬롯 고유 ID */
  id?: string;
  /** 슬롯 인덱스 (0-based) */
  slot_index: number;
  /** 슬롯 타입 */
  slot_type: SlotType | null;
  /** 교과 (국어, 수학, 영어 등) */
  subject_category?: string;
  /** 과목 ID */
  subject_id?: string | null;
  /** 과목명 */
  subject?: string | null;
  /** 과목 유형 (전략/취약) */
  subject_type?: "strategy" | "weakness" | null;
  /** 주간 학습일 수 (전략과목: 주 N일) */
  weekly_days?: number | null;
  /** 연결된 콘텐츠 ID (학생 콘텐츠) */
  content_id?: string | null;
  /** 연결된 마스터 콘텐츠 ID (추천 콘텐츠) */
  master_content_id?: string | null;
  /** 콘텐츠 제목 */
  title?: string | null;
  /** 시작 범위 (페이지/회차) */
  start_range?: number | null;
  /** 끝 범위 (페이지/회차) */
  end_range?: number | null;
  /** 슬롯 메모 */
  memo?: string | null;
  /** 슬롯 잠금 여부 (편집 불가) */
  is_locked?: boolean;
  /** 연결된 슬롯 ID */
  linked_slot_id?: string | null;
  /** 연결 타입 (앞/뒤) */
  link_type?: "after" | "before" | null;
  /** 배타적 슬롯 ID들 (동시에 배정되지 않음) */
  exclusive_with?: string[];
};

// ============================================================================
// 콘텐츠 마스터 검색 결과 타입
// ============================================================================

/**
 * 콘텐츠 마스터 검색 결과 (공통 필드)
 */
export type ContentMasterSearchResultBase = {
  id: string;
  title: string;
  subject_category: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  difficulty_level: string | null;
  publisher?: string | null;
  platform?: string | null;
  content_type: "book" | "lecture";
};

/**
 * 교재 마스터 검색 결과
 */
export type BookMasterSearchResult = ContentMasterSearchResultBase & {
  content_type: "book";
  total_pages: number | null;
  publisher?: string | null;
};

/**
 * 강의 마스터 검색 결과
 */
export type LectureMasterSearchResult = ContentMasterSearchResultBase & {
  content_type: "lecture";
  total_episodes: number | null;
  platform?: string | null;
};

/**
 * 콘텐츠 마스터 검색 결과 (통합)
 */
export type ContentMasterSearchResult = BookMasterSearchResult | LectureMasterSearchResult;

// ============================================================================
// 콘텐츠 관련 타입
// ============================================================================

/**
 * 선택된 콘텐츠 (학생 + 추천)
 */
export type SelectedContent = {
  content_type: ContentType;
  content_id: string;
  start_range: number;
  end_range: number;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
  title?: string;
  subject_category?: string;
  master_content_id?: string | null;
  is_auto_recommended?: boolean; // 자동 배정 여부
  recommendation_source?: "auto" | "admin" | "template" | null; // 추천 소스
  isLoadingMetadata?: boolean; // 메타데이터 로딩 중 플래그 (Optimistic UI)
  metadataError?: string; // 메타데이터 로드 실패 시 에러 메시지
};

/**
 * 콘텐츠 메타데이터
 */
export type ContentMetadata = {
  subject?: string | null;
  subject_group_name?: string | null; // 교과명 (subject_groups.name)
  semester?: string | null;
  revision?: string | null;
  /** @deprecated difficulty_level_id를 사용하세요. 하위 호환성을 위해 유지됩니다. */
  difficulty_level?: string | null;
  difficulty_level_id?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

/**
 * 콘텐츠 상세 정보 (책)
 */
export type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

/**
 * 콘텐츠 상세 정보 (강의)
 */
export type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};

/**
 * 콘텐츠 상세 정보 (통합)
 */
export type ContentDetail = BookDetail | LectureEpisode;

/**
 * 콘텐츠 범위
 */
export type ContentRange = {
  start: string;
  end: string;
  start_detail_id?: string | null;
  end_detail_id?: string | null;
};

// ============================================================================
// 추천 콘텐츠 관련 타입
// ============================================================================

/**
 * 추천 메타데이터 타입
 * 
 * plan_contents.recommendation_metadata JSONB 필드에 저장되는 구조
 */
export type RecommendationMetadata = {
  scoreDetails?: {
    schoolGrade?: number | null;
    schoolAverageGrade?: number | null;
    mockPercentile?: number | null;
    mockGrade?: number | null;
    riskScore?: number;
  };
  priority?: number;
  [key: string]: unknown; // 확장 가능한 필드
};

/**
 * 추천 콘텐츠
 */
export type RecommendedContent = {
  id: string;
  contentType: "book" | "lecture"; // 추천 콘텐츠는 custom 타입이 될 수 없음
  title: string;
  subject_category: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  publisher?: string | null;
  platform?: string | null;
  difficulty_level: string | null;
  reason: string;
  priority: number;
  scoreDetails?: {
    schoolGrade?: number | null;
    schoolAverageGrade?: number | null;
    mockPercentile?: number | null;
    mockGrade?: number | null;
    riskScore?: number;
  };
};

/**
 * 추천 설정
 */
export type RecommendationSettings = {
  selectedSubjects: Set<string>;
  recommendationCounts: Map<string, number>;
  autoAssignContents: boolean;
};

// ============================================================================
// 상태 관리 타입
// ============================================================================

/**
 * 콘텐츠 선택 전체 상태
 */
export type ContentSelectionState = {
  // 학생 콘텐츠
  studentContents: SelectedContent[];
  
  // 추천 콘텐츠
  recommendedContents: RecommendedContent[];
  selectedRecommendedIds: Set<string>;
  
  // 공통
  totalSelected: number; // student + recommended
  maxContents: number; // 9
  
  // 필수 과목
  requiredSubjects: Set<"국어" | "수학" | "영어">;
  selectedSubjects: Map<string, number>;
  
  // UI 상태
  activeTab: "student" | "recommended";
  isLoading: boolean;
  error: string | null;
};

// ============================================================================
// 컴포넌트 Props 타입
// ============================================================================

/**
 * ContentCard Props
 */
export type ContentCardProps = {
  // 콘텐츠 정보
  content: {
    id: string;
    title: string;
    subject?: string | null;
    subject_group_name?: string | null; // 교과명
    semester?: string | null;
    revision?: string | null; // 개정교육과정
    difficulty?: string | null;
    publisher?: string | null;
    platform?: string | null;
    contentType?: "book" | "lecture"; // 콘텐츠 타입 (범위 표시용)
  };
  
  // 상태
  selected: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  
  // 범위 정보
  range?: ContentRange;
  
  // 추천 정보 (추천 콘텐츠인 경우)
  recommended?: {
    priority: number;
    reason: string;
    scoreDetails?: RecommendedContent["scoreDetails"];
  };
  
  // 메타데이터 로딩 상태 (Optimistic UI)
  isLoadingMetadata?: boolean;
  metadataError?: string;
  
  // 이벤트 핸들러
  onToggle?: () => void;
  onRemove?: () => void;
  onEditRange?: () => void;
};

/**
 * RangeSettingModal Props
 */
export type RangeSettingModalProps = {
  // 모달 상태
  open: boolean;
  onClose: () => void;
  
  // 콘텐츠 정보
  content: {
    id: string;
    type: "book" | "lecture"; // custom 타입은 범위 설정을 지원하지 않음
    title: string;
  };
  
  // 콘텐츠 소스 구분 (추천 = 마스터, 학생 = 학생 콘텐츠)
  isRecommendedContent?: boolean;
  
  // 현재 범위
  currentRange?: ContentRange;
  
  // 저장 핸들러
  onSave: (range: ContentRange) => void;
  
  // 상태
  loading?: boolean;
  error?: string | null;
  
  // 학생 ID (관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 필요)
  studentId?: string | null;
};

/**
 * ContentRangeInput Props
 */
export type ContentRangeInputProps = {
  // 콘텐츠 타입
  type: ContentType;
  
  // 상세 정보
  details: ContentDetail[];
  
  // 현재 선택 (상세 정보가 있을 때)
  startDetailId?: string | null;
  endDetailId?: string | null;
  
  // 직접 입력 값 (상세 정보가 없을 때)
  startRange?: string | null;
  endRange?: string | null;
  
  // 총 페이지수/회차 (직접 입력 시 최대값 제한용)
  totalPages?: number | null;
  totalEpisodes?: number | null;
  
  // 변경 핸들러
  onStartChange: (detailId: string) => void;
  onEndChange: (detailId: string) => void;
  
  // 직접 입력 변경 핸들러
  onStartRangeChange?: (range: string) => void;
  onEndRangeChange?: (range: string) => void;
  
  // 상태
  loading?: boolean;
  error?: string | null;
};

/**
 * ProgressIndicator Props
 */
export type ProgressIndicatorProps = {
  // 진행 상태
  current: number;
  max: number;
  
  // 필수 과목 체크
  requiredSubjects?: {
    subject: string;
    selected: boolean;
  }[];
  
  // 경고 표시
  showWarning?: boolean;
  warningMessage?: string;
};

/**
 * ContentSelectionTabs Props
 */
export type ContentSelectionTabsProps = {
  // 활성 탭
  activeTab: "student" | "recommended";
  onTabChange: (tab: "student" | "recommended") => void;
  
  // 탭별 개수
  studentCount: number;
  recommendedCount: number;
  
  // 상태
  disabled?: boolean;
};

/**
 * StudentContentsPanel Props
 */
export type StudentContentsPanelProps = {
  // 데이터
  contents: {
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; subject?: string | null; subject_group_name?: string | null; curriculum_revision_name?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null; subject?: string | null; subject_group_name?: string | null; curriculum_revision_name?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null; subject?: string | null; subject_group_name?: string | null; curriculum_revision_name?: string | null }>;
  };
  
  // 선택된 콘텐츠
  selectedContents: SelectedContent[];
  
  // 제한
  maxContents: number;
  currentTotal: number; // student + recommended
  
  // 이벤트 핸들러
  onUpdate: (contents: SelectedContent[]) => void;
  
  // 상태
  editable?: boolean;
  isCampMode?: boolean;
  
  // 학생 ID (관리자/컨설턴트가 특정 학생의 콘텐츠를 조회할 때 필요)
  studentId?: string | null;
};

/**
 * RecommendedContentsPanel Props
 */
export type RecommendedContentsPanelProps = {
  // 데이터
  recommendedContents: RecommendedContent[];
  allRecommendedContents: RecommendedContent[];

  // 선택된 콘텐츠
  selectedContents: SelectedContent[];
  selectedRecommendedIds: Set<string>;

  // 제한
  maxContents: number;
  currentTotal: number; // student + recommended

  // 추천 설정
  settings: RecommendationSettings;
  onSettingsChange: (settings: RecommendationSettings) => void;

  // 이벤트 핸들러
  onUpdate: (contents: SelectedContent[]) => void;
  onRequestRecommendations: () => Promise<void>;
  /** 웹 검색 기반 AI 추천 (콜드 스타트) */
  onWebSearchRecommendations?: (
    subjectCategory: string,
    options?: {
      difficultyLevel?: string;
      contentType?: "book" | "lecture" | "all";
      maxResults?: number;
    }
  ) => Promise<{ fromCache: number; fromWebSearch: number; newlySaved: number } | undefined>;

  // 상태
  isEditMode?: boolean;
  isCampMode?: boolean;
  loading?: boolean;
  hasRequestedRecommendations?: boolean;
  hasScoreData?: boolean;
  studentId?: string;
  isAdminContinueMode?: boolean;
  editable?: boolean;
};

/**
 * Step3ContentSelection Props (메인 컴포넌트)
 * 
 * data와 onUpdate는 optional입니다. Context에서 가져올 수 있으면 생략 가능합니다.
 */
export type Step3ContentSelectionProps = {
  // WizardData (optional: Context에서 가져올 수 있음)
  data?: {
    student_contents: SelectedContent[];
    recommended_contents: SelectedContent[];
    // Note: 다양한 버전의 schedule_summary가 사용되므로 타입을 느슨하게 유지
    schedule_summary?: Record<string, unknown>;
    subject_constraints?: {
      enable_required_subjects_validation?: boolean;
      required_subjects?: Array<{
        subject_group_id: string;
        subject_category: string;
        min_count: number;
        subjects_by_curriculum?: Array<{
          curriculum_revision_id: string;
          subject_id?: string;
          subject_name?: string;
        }>;
      }>;
      excluded_subjects?: string[];
      constraint_handling?: "strict" | "warning" | "auto_fix";
    };
    // 슬롯 모드 관련 (v2.0)
    use_slot_mode?: boolean;
    content_slots?: ContentSlot[];
  };
  /** 데이터 업데이트 함수 (optional: Context에서 가져올 수 있음) */
  onUpdate?: (updates: Partial<{
    student_contents: SelectedContent[];
    recommended_contents: SelectedContent[];
    subject_constraints?: {
      enable_required_subjects_validation?: boolean;
      required_subjects?: Array<{
        subject_group_id: string;
        subject_category: string;
        min_count: number;
        subjects_by_curriculum?: Array<{
          curriculum_revision_id: string;
          subject_id?: string;
          subject_name?: string;
        }>;
      }>;
      excluded_subjects?: string[];
      constraint_handling?: "strict" | "warning" | "auto_fix";
    };
    // 슬롯 모드 관련 (v2.0)
    use_slot_mode?: boolean;
    content_slots?: ContentSlot[];
  }>) => void;
  
  // 콘텐츠 목록
  contents: StudentContentsPanelProps["contents"];
  
  // 추천 관련
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
  
  // 상태
  editable?: boolean;
};

// ============================================================================
// 유틸리티 타입
// ============================================================================

/**
 * 콘텐츠 선택 검증 결과
 */
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * 필수 과목 체크 결과
 */
export type RequiredSubjectsCheck = {
  국어: boolean;
  수학: boolean;
  영어: boolean;
  allRequired: boolean;
};

/**
 * 콘텐츠 중복 체크 결과
 */
export type DuplicateCheck = {
  isDuplicate: boolean;
  duplicateWith?: string; // content_id
  reason?: string;
};

// ============================================================================
// API 응답 타입
// ============================================================================

/**
 * 콘텐츠 메타데이터 API 응답
 */
export type ContentMetadataResponse = ContentMetadata;

/**
 * 콘텐츠 상세 정보 API 응답
 */
export type ContentDetailsResponse = {
  details: ContentDetail[];
  type: ContentType;
};

/**
 * 추천 콘텐츠 API 응답
 */
export type RecommendedContentsResponse = {
  contents: RecommendedContent[];
  hasScoreData: boolean;
};

// ============================================================================
// 2단계 콘텐츠 선택 시스템 - 슬롯 관련 타입 (v2.0)
// ============================================================================

/**
 * 자습 목적 태그
 */
export type SelfStudyPurpose =
  | "homework"      // 숙제
  | "review"        // 복습/오답노트
  | "preview"       // 예습
  | "memorization"  // 암기
  | "practice";     // 문제풀이

/**
 * 슬롯 시간 제약 타입
 */
export type SlotTimeConstraint = {
  /** 고정/유동 */
  type: "fixed" | "flexible";
  /** 선호 시간대 */
  preferred_time_range?: {
    start_hour: number;  // 0-23
    end_hour: number;    // 0-23
  } | null;
  /** 선호 시간대 (간편 선택) */
  preferred_period?: "morning" | "afternoon" | "evening" | null;
  /** 분할 배치 가능 여부 */
  can_split?: boolean;
};

/**
 * 슬롯 연계 타입 (연계 슬롯용)
 */
export type SlotLinkType = "after" | "before";

/**
 * 슬롯 템플릿 (템플릿에 저장)
 * camp_templates.slot_templates JSONB 필드에 저장되는 구조
 */
export type SlotTemplate = {
  /** 슬롯 인덱스 (0-8, 최대 9개) */
  slot_index: number;
  /** 슬롯 타입 (아직 선택 안 함일 수 있음) */
  slot_type: SlotType | null;
  /** 교과 그룹명 (예: "국어", "수학") */
  subject_category: string;
  /** 과목 ID (선택적, 예: "수학Ⅰ") */
  subject_id?: string | null;
  /** 개정교육과정 ID */
  curriculum_revision_id?: string | null;
  /** 필수 슬롯 여부 */
  is_required?: boolean;
  /** 잠금 슬롯 여부 (학생이 삭제 불가) */
  is_locked?: boolean;
  /** 추천 슬롯(Ghost Slot) 여부 */
  is_ghost?: boolean;
  /** 추천 슬롯 메시지 */
  ghost_message?: string;
  /** 기본 검색어 (동적 기본값) */
  default_search_term?: string;

  // === 배정 방식 (전략/취약 과목) ===
  /** 과목 배정 유형 (전략과목/취약과목) */
  subject_type?: "strategy" | "weakness" | null;
  /** 전략과목일 경우 주당 배정 일수 (2, 3, 4) */
  weekly_days?: number | null;
};

/**
 * 콘텐츠 슬롯 (플랜 그룹에 저장)
 * plan_groups.content_slots JSONB 필드에 저장되는 구조
 */
export type ContentSlot = SlotTemplate & {
  /** 슬롯 고유 ID (UUID) */
  id?: string;

  // === 콘텐츠 연결 필드 ===
  /** 실제 콘텐츠 ID */
  content_id?: string | null;
  /** 과목명 (선택된 과목의 이름) */
  subject?: string | null;
  /** 시작 범위 (페이지/회차) */
  start_range?: number;
  /** 종료 범위 (페이지/회차) */
  end_range?: number;
  /** 시작 상세 ID (단원/챕터) */
  start_detail_id?: string | null;
  /** 종료 상세 ID (단원/챕터) */
  end_detail_id?: string | null;
  /** 콘텐츠 제목 */
  title?: string | null;
  /** 마스터 콘텐츠 ID */
  master_content_id?: string | null;
  /** 슬롯 메모 */
  memo?: string | null;
  /** 추천 콘텐츠 여부 */
  is_auto_recommended?: boolean;
  /** 추천 소스 */
  recommendation_source?: "auto" | "admin" | "template" | null;

  // === 자습 타입 확장 ===
  /** 자습 목적 (slot_type이 self_study일 때) */
  self_study_purpose?: SelfStudyPurpose | null;
  /** 자습 설명 */
  self_study_description?: string;

  // === 시간 제약 ===
  /** 시간 제약 조건 */
  time_constraint?: SlotTimeConstraint | null;

  // === 슬롯 관계 (연계/배타) ===
  /** 연계될 슬롯 ID */
  linked_slot_id?: string | null;
  /** 연계 방향 */
  link_type?: SlotLinkType | null;
  /** 같은 날 배치 피할 슬롯 ID 목록 */
  exclusive_with?: string[];

  // === 상태 필드 ===
  /** 메타데이터 로딩 중 플래그 (UI용) */
  isLoadingMetadata?: boolean;
  /** 메타데이터 로드 실패 시 에러 메시지 (UI용) */
  metadataError?: string;
};

/**
 * 슬롯 완성 상태
 */
export type SlotCompletionStatus =
  | "empty"           // 빈 슬롯
  | "type_selected"   // 타입만 선택됨
  | "content_linked"; // 콘텐츠 연결 완료

/**
 * 슬롯 완성 상태 판별 함수
 */
export function getSlotCompletionStatus(slot: ContentSlot): SlotCompletionStatus {
  if (!slot.slot_type && !slot.subject_category) {
    return "empty";
  }
  if (!slot.content_id) {
    return "type_selected";
  }
  return "content_linked";
}

/**
 * 슬롯 검증 결과
 */
export type SlotValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * 슬롯 구성 검증 함수
 */
export function validateSlotConfiguration(slots: ContentSlot[]): SlotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 최대 9개 제한
  if (slots.length > 9) {
    errors.push("슬롯은 최대 9개까지 가능합니다.");
  }

  // 교과-과목 필수 검증
  slots.forEach((slot, index) => {
    if (!slot.subject_category) {
      errors.push(`슬롯 ${index + 1}: 교과를 선택해주세요.`);
    }
  });

  // 중복 슬롯 검증 (같은 교과-과목-타입 조합)
  const slotKeys = slots.map(s =>
    `${s.slot_type}-${s.subject_category}-${s.subject_id || ''}`
  );
  const duplicates = slotKeys.filter((key, index) =>
    slotKeys.indexOf(key) !== index
  );
  if (duplicates.length > 0) {
    warnings.push("동일한 교과-과목 조합의 슬롯이 중복됩니다.");
  }

  // 슬롯 관계 검증 추가
  const relationshipValidation = validateSlotRelationships(slots);
  errors.push(...relationshipValidation.errors);
  warnings.push(...relationshipValidation.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 슬롯 관계 검증 함수
 *
 * 연계 슬롯(linked_slot_id)과 배타적 슬롯(exclusive_with) 관계를 검증합니다.
 *
 * 검증 항목:
 * 1. 자기 자신 참조 (A → A)
 * 2. 존재하지 않는 슬롯 참조
 * 3. 순환 참조 (A → B → A)
 * 4. 배타적 슬롯 자기 참조
 */
export function validateSlotRelationships(slots: ContentSlot[]): SlotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 유효한 슬롯 ID 집합
  const validSlotIds = new Set<string>();
  const slotIndexById = new Map<string, number>();

  slots.forEach((slot) => {
    if (slot.id) {
      validSlotIds.add(slot.id);
      slotIndexById.set(slot.id, slot.slot_index);
    }
  });

  // 각 슬롯별 검증
  slots.forEach((slot, index) => {
    const slotNum = index + 1;

    // === 연계 슬롯 검증 ===
    if (slot.linked_slot_id) {
      // 1. 자기 자신 참조
      if (slot.id && slot.linked_slot_id === slot.id) {
        errors.push(`슬롯 ${slotNum}: 자기 자신을 연결할 수 없습니다.`);
      }
      // 2. 존재하지 않는 슬롯 참조
      else if (!validSlotIds.has(slot.linked_slot_id)) {
        warnings.push(`슬롯 ${slotNum}: 연결된 슬롯이 존재하지 않습니다.`);
      }
    }

    // === 배타적 슬롯 검증 ===
    if (slot.exclusive_with && slot.exclusive_with.length > 0) {
      for (const excludedId of slot.exclusive_with) {
        // 1. 자기 자신 참조
        if (slot.id && excludedId === slot.id) {
          errors.push(`슬롯 ${slotNum}: 배타적 관계에 자기 자신을 포함할 수 없습니다.`);
        }
        // 2. 존재하지 않는 슬롯 참조
        else if (!validSlotIds.has(excludedId)) {
          warnings.push(`슬롯 ${slotNum}: 배타적 관계의 슬롯이 존재하지 않습니다.`);
        }
      }
    }
  });

  // === 순환 참조 검증 ===
  const circularResult = detectCircularReferences(slots);
  if (circularResult.hasCircular) {
    errors.push(`순환 참조가 발견되었습니다: ${circularResult.path.map((id) => {
      const idx = slotIndexById.get(id);
      return idx !== undefined ? `슬롯 ${idx + 1}` : id;
    }).join(" → ")}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 순환 참조 탐지 함수 (DFS 기반)
 *
 * @param slots - 콘텐츠 슬롯 배열
 * @returns 순환 참조 여부 및 경로
 */
function detectCircularReferences(slots: ContentSlot[]): {
  hasCircular: boolean;
  path: string[];
} {
  // linked_slot_id로 그래프 구성
  const graph = new Map<string, string>();

  slots.forEach((slot) => {
    if (slot.id && slot.linked_slot_id) {
      graph.set(slot.id, slot.linked_slot_id);
    }
  });

  // DFS로 순환 탐지
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) {
      // 순환 발견 - 경로 구성
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart !== -1) {
        path.push(nodeId); // 순환 완성
      }
      return true;
    }

    if (visited.has(nodeId)) {
      return false;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const nextNode = graph.get(nodeId);
    if (nextNode && dfs(nextNode)) {
      return true;
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  // 모든 노드에서 DFS 시작
  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId)) {
        return { hasCircular: true, path };
      }
    }
  }

  return { hasCircular: false, path: [] };
}

/**
 * 콘텐츠 연결 검증 함수
 */
export function validateContentLinking(slots: ContentSlot[]): SlotValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  slots.forEach((slot, index) => {
    // 자습 타입이 아닌 경우에만 콘텐츠 연결 필수
    if (slot.slot_type !== "self_study" && slot.slot_type !== "test") {
      if (!slot.content_id) {
        errors.push(`슬롯 ${index + 1}: 콘텐츠를 선택해주세요.`);
      }

      // 범위 설정 필수
      if (slot.content_id && (slot.start_range === undefined || slot.end_range === undefined)) {
        errors.push(`슬롯 ${index + 1}: 학습 범위를 설정해주세요.`);
      }

      // 범위 유효성 검증
      if (slot.start_range !== undefined && slot.end_range !== undefined &&
          slot.start_range >= slot.end_range) {
        errors.push(`슬롯 ${index + 1}: 시작 범위는 종료 범위보다 작아야 합니다.`);
      }
    }

    // 자습 타입인 경우 목적 검증
    if (slot.slot_type === "self_study" && !slot.self_study_purpose) {
      warnings.push(`슬롯 ${index + 1}: 자습 목적을 선택하면 스케줄링이 더 정확해집니다.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * 과목 밸런스 계산 결과
 */
export type SubjectBalance = {
  subject_category: string;
  slot_count: number;
  percentage: number;
  is_warning: boolean;  // 70% 초과 시 경고
};

/**
 * 과목 밸런스 계산 함수
 */
export function calculateSubjectBalance(slots: ContentSlot[]): SubjectBalance[] {
  const totalSlots = slots.length;
  if (totalSlots === 0) return [];

  const subjectCounts = new Map<string, number>();

  slots.forEach(slot => {
    if (slot.subject_category) {
      const count = subjectCounts.get(slot.subject_category) || 0;
      subjectCounts.set(slot.subject_category, count + 1);
    }
  });

  return Array.from(subjectCounts.entries()).map(([subject, count]) => ({
    subject_category: subject,
    slot_count: count,
    percentage: Math.round((count / totalSlots) * 100),
    is_warning: (count / totalSlots) > 0.7,
  }));
}

/**
 * 모드 전환 검증 결과
 */
export type ModeSwitchValidation = {
  allowed: boolean;
  warning?: string;
};

/**
 * 모드 전환 검증 함수 (슬롯 모드 ↔ 레거시 모드)
 */
export function validateModeSwitch(
  currentMode: "slot" | "legacy",
  targetMode: "slot" | "legacy",
  hasSlotData: boolean
): ModeSwitchValidation {
  if (currentMode === "slot" && targetMode === "legacy" && hasSlotData) {
    return {
      allowed: true,
      warning: "슬롯 모드에서 작성한 데이터가 레거시 형식으로 변환됩니다. 일부 정보가 손실될 수 있습니다.",
    };
  }
  return { allowed: true };
}

/**
 * 슬롯 → 기존 콘텐츠 형식 변환 (Dual Write용)
 */
export function convertSlotsToContents(slots: ContentSlot[]): SelectedContent[] {
  return slots
    .filter(slot => slot.content_id && slot.slot_type !== "self_study" && slot.slot_type !== "test")
    .map(slot => ({
      content_type: (slot.slot_type === "book" || slot.slot_type === "lecture" || slot.slot_type === "custom")
        ? slot.slot_type
        : "book", // 기본값
      content_id: slot.content_id!,
      start_range: slot.start_range ?? 0,
      end_range: slot.end_range ?? 0,
      // null 값 보존: null은 명시적으로 "값 없음"을 의미, undefined는 "필드 없음"
      start_detail_id: slot.start_detail_id,
      end_detail_id: slot.end_detail_id,
      title: slot.title ?? undefined,
      subject_category: slot.subject_category ?? undefined,
      master_content_id: slot.master_content_id,
      is_auto_recommended: slot.is_auto_recommended,
      recommendation_source: slot.recommendation_source,
    }));
}

/**
 * 기존 콘텐츠 형식 → 슬롯 변환
 */
export function convertContentsToSlots(contents: SelectedContent[]): ContentSlot[] {
  return contents.map((content, index) => ({
    slot_index: index,
    slot_type: content.content_type,
    subject_category: content.subject_category || "",
    content_id: content.content_id,
    start_range: content.start_range,
    end_range: content.end_range,
    start_detail_id: content.start_detail_id,
    end_detail_id: content.end_detail_id,
    title: content.title,
    master_content_id: content.master_content_id,
    is_auto_recommended: content.is_auto_recommended,
    recommendation_source: content.recommendation_source,
  }));
}

/**
 * 빈 슬롯 생성 함수
 */
export function createEmptySlot(index: number): ContentSlot {
  return {
    slot_index: index,
    slot_type: null,
    subject_category: "",
  };
}

/**
 * 슬롯 배열에서 다음 가용 인덱스 찾기
 */
export function getNextSlotIndex(slots: ContentSlot[]): number {
  if (slots.length === 0) return 0;
  const maxIndex = Math.max(...slots.map(s => s.slot_index));
  return maxIndex + 1;
}

// ============================================================================
// 슬롯 템플릿 프리셋 타입 (v2.1)
// ============================================================================

/**
 * 슬롯 템플릿 프리셋
 * slot_template_presets 테이블에 저장되는 구조
 */
export type SlotTemplatePreset = {
  /** 프리셋 ID */
  id: string;
  /** 테넌트 ID */
  tenant_id: string;
  /** 프리셋 이름 */
  name: string;
  /** 프리셋 설명 */
  description?: string | null;
  /** 슬롯 템플릿 배열 */
  slot_templates: SlotTemplate[];
  /** 기본 프리셋 여부 */
  is_default: boolean;
  /** 생성자 ID */
  created_by?: string | null;
  /** 생성 일시 */
  created_at?: string | null;
  /** 수정 일시 */
  updated_at?: string | null;
};

/**
 * 슬롯 템플릿 프리셋 생성 데이터
 */
export type SlotTemplatePresetInsert = Omit<
  SlotTemplatePreset,
  "id" | "created_at" | "updated_at"
>;

/**
 * 슬롯 템플릿 프리셋 업데이트 데이터
 */
export type SlotTemplatePresetUpdate = Partial<
  Omit<SlotTemplatePreset, "id" | "tenant_id" | "created_at">
>;

// ============================================================================
// 콘텐츠 자동 매칭 타입 및 함수
// ============================================================================

/**
 * 자동 매칭에 사용되는 콘텐츠 정보
 */
export type MatchableContent = {
  id: string;
  title: string;
  subtitle?: string | null;
  content_type: "book" | "lecture" | "custom";
  subject_category?: string | null;
  subject?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
  master_content_id?: string | null;
};

/**
 * 자동 매칭 결과
 */
export type AutoMatchResult = {
  /** 매칭된 슬롯 배열 */
  slots: ContentSlot[];
  /** 매칭 통계 */
  stats: {
    /** 총 슬롯 수 */
    totalSlots: number;
    /** 매칭된 슬롯 수 */
    matchedSlots: number;
    /** 이미 연결된 슬롯 수 (변경 안 함) */
    alreadyLinkedSlots: number;
    /** 매칭 불가 슬롯 수 */
    unmatchedSlots: number;
  };
  /** 매칭 로그 (디버깅용) */
  logs: string[];
};

/**
 * 슬롯에 콘텐츠를 자동으로 매칭합니다.
 *
 * 매칭 우선순위:
 * 1. subject_category가 정확히 일치하는 콘텐츠
 * 2. subject가 subject_category에 포함되는 콘텐츠
 * 3. slot_type이 일치하는 콘텐츠 중 첫 번째
 *
 * @param slots - 매칭할 슬롯 배열
 * @param availableContents - 사용 가능한 콘텐츠 (교재, 강의, 커스텀)
 * @param options - 옵션
 * @returns 매칭 결과
 */
export function autoMatchSlotsToContents(
  slots: ContentSlot[],
  availableContents: {
    books: MatchableContent[];
    lectures: MatchableContent[];
    custom: MatchableContent[];
  },
  options: {
    /** 이미 연결된 슬롯도 덮어쓸지 여부 (기본: false) */
    overwriteExisting?: boolean;
    /** 기본 학습 범위 (페이지/회차) */
    defaultRange?: { start: number; end: number };
  } = {}
): AutoMatchResult {
  const { overwriteExisting = false, defaultRange = { start: 1, end: 10 } } = options;
  const logs: string[] = [];
  const usedContentIds = new Set<string>();

  // 이미 연결된 콘텐츠 ID 수집 (중복 방지)
  slots.forEach((slot) => {
    if (slot.content_id) {
      usedContentIds.add(slot.content_id);
    }
  });

  let matchedCount = 0;
  let alreadyLinkedCount = 0;
  let unmatchedCount = 0;

  const matchedSlots = slots.map((slot, index) => {
    // 자습/테스트 슬롯은 매칭 불필요
    if (slot.slot_type === "self_study" || slot.slot_type === "test") {
      logs.push(`슬롯 ${index + 1}: ${slot.slot_type} 타입 - 매칭 불필요`);
      return slot;
    }

    // 슬롯 타입이 없으면 매칭 불가
    if (!slot.slot_type) {
      logs.push(`슬롯 ${index + 1}: 슬롯 타입 미설정 - 매칭 스킵`);
      unmatchedCount++;
      return slot;
    }

    // 이미 연결된 경우
    if (slot.content_id && !overwriteExisting) {
      logs.push(`슬롯 ${index + 1}: 이미 연결됨 (${slot.title || slot.content_id})`);
      alreadyLinkedCount++;
      return slot;
    }

    // 슬롯 타입에 맞는 콘텐츠 소스 선택
    let contentSource: MatchableContent[] = [];
    if (slot.slot_type === "book") {
      contentSource = availableContents.books;
    } else if (slot.slot_type === "lecture") {
      contentSource = availableContents.lectures;
    } else if (slot.slot_type === "custom") {
      contentSource = availableContents.custom;
    }

    // 사용되지 않은 콘텐츠만 필터링
    const unusedContents = contentSource.filter((c) => !usedContentIds.has(c.id));

    if (unusedContents.length === 0) {
      logs.push(`슬롯 ${index + 1}: 사용 가능한 ${slot.slot_type} 콘텐츠 없음`);
      unmatchedCount++;
      return slot;
    }

    // 매칭 시도
    let matchedContent: MatchableContent | undefined;

    // 1순위: subject_category 정확히 일치
    if (slot.subject_category) {
      matchedContent = unusedContents.find(
        (c) => c.subject_category === slot.subject_category
      );

      // 2순위: subject가 subject_category에 포함
      if (!matchedContent) {
        matchedContent = unusedContents.find(
          (c) => c.subject && slot.subject_category &&
                 c.subject.includes(slot.subject_category)
        );
      }

      // 3순위: subject_category가 subject에 포함
      if (!matchedContent) {
        matchedContent = unusedContents.find(
          (c) => c.subject && slot.subject_category &&
                 slot.subject_category.includes(c.subject)
        );
      }
    }

    // 4순위: 아무 콘텐츠나 (같은 타입)
    if (!matchedContent) {
      matchedContent = unusedContents[0];
    }

    if (matchedContent) {
      usedContentIds.add(matchedContent.id);
      matchedCount++;

      // 기본 범위 계산
      let endRange = defaultRange.end;
      if (slot.slot_type === "book" && matchedContent.total_pages) {
        endRange = Math.min(defaultRange.end, matchedContent.total_pages);
      } else if (slot.slot_type === "lecture" && matchedContent.total_episodes) {
        endRange = Math.min(defaultRange.end, matchedContent.total_episodes);
      }

      logs.push(
        `슬롯 ${index + 1} (${slot.subject_category || "미지정"}): ` +
        `"${matchedContent.title}" 매칭 완료`
      );

      return {
        ...slot,
        content_id: matchedContent.id,
        title: matchedContent.title,
        master_content_id: matchedContent.master_content_id,
        start_range: defaultRange.start,
        end_range: endRange,
        is_auto_recommended: true,
        recommendation_source: "auto" as const,
      };
    }

    logs.push(`슬롯 ${index + 1}: 매칭 실패`);
    unmatchedCount++;
    return slot;
  });

  return {
    slots: matchedSlots,
    stats: {
      totalSlots: slots.length,
      matchedSlots: matchedCount,
      alreadyLinkedSlots: alreadyLinkedCount,
      unmatchedSlots: unmatchedCount,
    },
    logs,
  };
}

/**
 * 슬롯과 콘텐츠 간의 매칭 점수를 계산합니다.
 * (향후 더 정교한 매칭 알고리즘을 위한 헬퍼 함수)
 */
export function calculateMatchScore(
  slot: ContentSlot,
  content: MatchableContent
): number {
  let score = 0;

  // 슬롯 타입과 콘텐츠 타입 일치 (필수)
  if (slot.slot_type !== content.content_type) {
    return -1; // 타입 불일치는 매칭 불가
  }

  // subject_category 정확히 일치: +100점
  if (slot.subject_category && content.subject_category === slot.subject_category) {
    score += 100;
  }

  // subject가 subject_category 포함: +50점
  if (slot.subject_category && content.subject?.includes(slot.subject_category)) {
    score += 50;
  }

  // subject_category가 subject 포함: +30점
  if (slot.subject_category && content.subject && slot.subject_category.includes(content.subject)) {
    score += 30;
  }

  // 기본 점수 (타입만 일치)
  score += 10;

  return score;
}

