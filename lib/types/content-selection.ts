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
    schedule_summary?: any;
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

