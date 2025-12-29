/**
 * MasterContentsPanel 서브 컴포넌트용 타입 정의
 *
 * @module master-contents/types
 */

import type { ContentMaster } from "@/lib/types/plan";
import type { SelectedContent, ContentRange } from "@/lib/types/content-selection";

export type ContentTypeFilter = "book" | "lecture" | "all";

export type ContentTypeSelectorProps = {
  value: ContentTypeFilter;
  onChange: (value: ContentTypeFilter) => void;
  disabled?: boolean;
};

export type SearchFiltersProps = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  curriculumRevisionId: string;
  onCurriculumRevisionChange: (value: string) => void;
  subjectGroupId: string;
  onSubjectGroupChange: (value: string) => void;
  subjectId: string;
  onSubjectChange: (value: string) => void;
  curriculumRevisions: Array<{ id: string; name: string }>;
  subjectGroups: Array<{ id: string; name: string }>;
  currentSubjects: Array<{ id: string; name: string }>;
  loadingGroups: boolean;
  loadingSubjects: boolean;
  disabled?: boolean;
  isSearching?: boolean;
  onSearch: () => void;
  searchDisabled: boolean;
};

export type SearchResultItemProps = {
  result: ContentMaster;
  onSelect: (content: ContentMaster) => void;
  disabled: boolean;
  alreadyAdded: boolean;
};

export type SearchResultsListProps = {
  results: ContentMaster[];
  isSearching: boolean;
  onSelect: (content: ContentMaster) => void;
  maxReached: boolean;
  selectedMasterIds: Set<string>;
  editable: boolean;
};

export type AddedMasterContentsListProps = {
  contents: SelectedContent[];
  onRemove: (contentId: string) => void;
  onEditRange: (content: SelectedContent) => void;
  editable: boolean;
};

export type { ContentMaster, SelectedContent, ContentRange };
