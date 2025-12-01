/**
 * Phase 3: 콘텐츠 선택 타입 정의
 * 
 * Step3Contents + Step4RecommendedContents 통합을 위한
 * 공통 타입 및 인터페이스 정의
 */

// ============================================================================
// 기본 타입
// ============================================================================

export type ContentType = "book" | "lecture";

export type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타";

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
};

/**
 * 콘텐츠 메타데이터
 */
export type ContentMetadata = {
  subject?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
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
 * 추천 콘텐츠
 */
export type RecommendedContent = {
  id: string;
  contentType: ContentType;
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
    semester?: string | null;
    difficulty?: string | null;
    publisher?: string | null;
    platform?: string | null;
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
    type: ContentType;
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
};

/**
 * ContentRangeInput Props
 */
export type ContentRangeInputProps = {
  // 콘텐츠 타입
  type: ContentType;
  
  // 상세 정보
  details: ContentDetail[];
  
  // 현재 선택
  startDetailId?: string | null;
  endDetailId?: string | null;
  
  // 변경 핸들러
  onStartChange: (detailId: string) => void;
  onEndChange: (detailId: string) => void;
  
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
    books: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    lectures: Array<{ id: string; title: string; subtitle?: string | null; master_content_id?: string | null }>;
    custom: Array<{ id: string; title: string; subtitle?: string | null }>;
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
};

/**
 * Step3ContentSelection Props (메인 컴포넌트)
 */
export type Step3ContentSelectionProps = {
  // WizardData
  data: {
    student_contents: SelectedContent[];
    recommended_contents: SelectedContent[];
    schedule_summary?: any;
  };
  onUpdate: (updates: Partial<Step3ContentSelectionProps["data"]>) => void;
  
  // 콘텐츠 목록
  contents: StudentContentsPanelProps["contents"];
  
  // 추천 관련
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
  
  // Draft 저장
  onSaveDraft?: () => Promise<void> | void;
  isSavingDraft?: boolean;
  
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

