/**
 * Step4RecommendedContents 타입 정의
 */

import { WizardData } from "../PlanGroupWizard";

// ============================================================================
// 콘텐츠 관련 타입
// ============================================================================

export type BookDetail = {
  id: string;
  page_number: number;
  major_unit: string | null;
  minor_unit: string | null;
};

export type LectureEpisode = {
  id: string;
  episode_number: number;
  episode_title: string | null;
};

export type ContentDetail = BookDetail | LectureEpisode;

export type RecommendedContent = {
  id: string;
  contentType: "book" | "lecture";
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

// ============================================================================
// Props 타입
// ============================================================================

export type Step4RecommendedContentsProps = {
  data: WizardData;
  onUpdate: (
    updates: Partial<WizardData> | ((prev: WizardData) => Partial<WizardData>)
  ) => void;
  isEditMode?: boolean;
  isCampMode?: boolean;
  studentId?: string; // 관리자 모드에서 다른 학생의 추천 콘텐츠 조회 시 사용
};

// ============================================================================
// Hook 반환 타입
// ============================================================================

export type UseRecommendationsReturn = {
  recommendedContents: RecommendedContent[];
  allRecommendedContents: RecommendedContent[];
  loading: boolean;
  hasRequestedRecommendations: boolean;
  hasScoreData: boolean;
  fetchRecommendations: () => Promise<void>;
  fetchRecommendationsWithSubjects: (
    subjects: string[],
    counts: Map<string, number>,
    autoAssign: boolean
  ) => Promise<void>;
  setRecommendedContents: React.Dispatch<React.SetStateAction<RecommendedContent[]>>;
  setAllRecommendedContents: React.Dispatch<React.SetStateAction<RecommendedContent[]>>;
};

export type UseContentSelectionReturn = {
  selectedContentIds: Set<string>;
  toggleContentSelection: (contentId: string) => void;
  addSelectedContents: () => Promise<void>;
  removeContent: (index: number) => void;
  setSelectedContentIds: React.Dispatch<React.SetStateAction<Set<string>>>;
};

export type UseRangeEditorReturn = {
  editingRangeIndex: number | null;
  editingRange: { start: string; end: string } | null;
  contentDetails: Map<
    number,
    { details: (BookDetail | LectureEpisode)[]; type: "book" | "lecture" }
  >;
  startDetailId: Map<number, string>;
  endDetailId: Map<number, string>;
  contentTotals: Map<number, number>;
  loadingDetails: Set<number>;
  startEditingRange: (index: number) => void;
  saveEditingRange: () => void;
  cancelEditingRange: () => void;
  setStartRange: (index: number, detailId: string) => void;
  setEndRange: (index: number, detailId: string) => void;
  setEditingRange: React.Dispatch<React.SetStateAction<{ start: string; end: string } | null>>;
};

export type UseRequiredSubjectsReturn = {
  requiredSubjects: Array<{
    subject_category: string;
    subject?: string;
    min_count: number;
  }>;
  requiredSubjectCategories: string[];
  missingRequiredSubjects: Array<{
    name: string;
    current: number;
    required: number;
  }>;
  progressRequiredSubjects: Array<{
    subject: string;
    selected: boolean;
  }>;
  selectedSubjectCategories: Set<string>;
  contentCountBySubject: Map<string, number>;
};

// ============================================================================
// Component Props 타입
// ============================================================================

export type RequiredSubjectsSectionProps = {
  data: WizardData;
  availableSubjects: string[];
  detailSubjects: Map<string, string[]>;
  loadingDetailSubjects: Set<string>;
  onUpdate: (updates: Partial<WizardData>) => void;
  onLoadDetailSubjects: (category: string, curriculumRevisionId?: string) => void;
  onAddRequiredSubject: () => void;
  onUpdateRequiredSubject: (
    index: number,
    updated: Partial<{
      subject_category: string;
      subject?: string;
      min_count: number;
    }>
  ) => void;
  onRemoveRequiredSubject: (index: number) => void;
  onConstraintHandlingChange?: (handling: "strict" | "warning" | "auto_fix") => void;
  isTemplateMode?: boolean;
  isCampMode?: boolean;
  studentId?: string;
};

export type RecommendationRequestFormProps = {
  selectedSubjects: Set<string>;
  recommendationCounts: Map<string, number>;
  autoAssignContents: boolean;
  availableSubjects: string[];
  data: WizardData;
  onSubjectToggle: (subject: string) => void;
  onCountChange: (subject: string, count: number) => void;
  onAutoAssignChange: (value: boolean) => void;
  onSubmit: (
    subjects: string[],
    counts: Map<string, number>,
    autoAssign: boolean
  ) => Promise<void>;
};

export type RecommendedContentsListProps = {
  recommendedContents: RecommendedContent[];
  allRecommendedContents: RecommendedContent[];
  selectedContentIds: Set<string>;
  requiredSubjects: Array<{
    subject_category: string;
    subject?: string;
    min_count: number;
  }>;
  data: WizardData;
  selectedSubjects: Set<string>;
  recommendationCounts: Map<string, number>;
  loading: boolean;
  onToggleSelection: (contentId: string) => void;
  onRefresh: (
    subjects: string[],
    counts: Map<string, number>,
    autoAssign: boolean
  ) => Promise<void>;
};

export type AddedContentsListProps = {
  contents: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    start_detail_id?: string | null;
    end_detail_id?: string | null;
  }>;
  allRecommendedContents: RecommendedContent[];
  editingRangeIndex: number | null;
  contentDetails: Map<
    number,
    { details: ContentDetail[]; type: "book" | "lecture" }
  >;
  startDetailId: Map<number, string>;
  endDetailId: Map<number, string>;
  loadingDetails: Set<number>;
  onStartEditing: (index: number) => void;
  onSaveRange: (index: number) => void;
  onCancelEditing: () => void;
  onRemove: (index: number) => void;
  onStartDetailChange: (index: number, detailId: string) => void;
  onEndDetailChange: (index: number, detailId: string) => void;
};

// ============================================================================
// 내부 타입
// ============================================================================

export type RequiredSubject = {
  subject_category: string;
  subject?: string;
  min_count: number;
};

export type ContentWithMetadata = {
  content_id: string;
  content_type: "book" | "lecture";
  title?: string;
  subject_category?: string | null;
  master_content_id?: string | null;
};

