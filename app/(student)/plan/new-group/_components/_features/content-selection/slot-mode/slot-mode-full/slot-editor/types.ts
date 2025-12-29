/**
 * SlotEditorPanel 서브 컴포넌트용 타입 정의
 *
 * @module slot-editor/types
 */

import type { ContentSlot, SlotType } from "@/lib/types/content-selection";
import type { MasterContentResult } from "@/lib/hooks/useMasterContentSearch";

export type EditorTab = "detail" | "content" | "range";

export type SubjectInfo = {
  id: string;
  name: string;
};

export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string;
  content_type: "book" | "lecture" | "custom";
  subject_category?: string;
  subject?: string;
  total_pages?: number;
  total_episodes?: number;
  master_content_id?: string;
};

export type SourceTab = "student" | "recommended" | "master";

export type RecommendedContentItem = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject?: string | null;
  subject_category?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
  recommendationReason?: string | null;
};

export type RangeModalContent = {
  id: string;
  type: "book" | "lecture";
  title: string;
  masterContentId?: string;
  content: ContentItem | MasterContentResult | RecommendedContentItem;
  isMasterContent: boolean;
};

// SlotDetailTab Props
export type SlotDetailTabProps = {
  slot: ContentSlot;
  subjects: SubjectInfo[];
  isLoadingSubjects: boolean;
  subjectCategories: string[];
  editable: boolean;
  onTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectCategoryChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectIdChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSubjectTypeChange: (type: "strategy" | "weakness") => void;
  onWeeklyDaysChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
};

// ContentLinkingTab Props
export type ContentLinkingTabProps = {
  slot: ContentSlot;
  filteredContents: ContentItem[];
  sourceTab: SourceTab;
  searchQuery: string;
  recommendedContents: RecommendedContentItem[];
  isLoadingRecommendations: boolean;
  masterSearch: {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    results: MasterContentResult[];
    isSearching: boolean;
    hasSearched: boolean;
  };
  editable: boolean;
  studentId?: string;
  onSourceTabChange: (tab: SourceTab) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectContent: (content: ContentItem) => void;
  onSelectRecommendedOrMaster: (content: RecommendedContentItem | MasterContentResult) => void;
  onMasterSearch: () => void;
  onUnlinkContent: () => void;
};

// RangeTab Props
export type RangeTabProps = {
  slot: ContentSlot;
  editable: boolean;
  studentId?: string;
  onOpenRangeModal: () => void;
};

// ContentListItem Props
export type ContentListItemProps = {
  content: ContentItem;
  isLinked: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

// RecommendedContentListItem Props
export type RecommendedContentListItemProps = {
  content: RecommendedContentItem;
  onSelect: () => void;
  disabled?: boolean;
};

// MasterContentListItem Props
export type MasterContentListItemProps = {
  content: MasterContentResult;
  onSelect: () => void;
  disabled?: boolean;
};
