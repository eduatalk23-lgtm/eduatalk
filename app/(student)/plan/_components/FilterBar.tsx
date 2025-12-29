"use client";

import {
  FilterBar as SharedFilterBar,
  planPurposeFilter,
  sortOrderFilter,
  planGroupStatusFilter,
  progressFilter,
  dateRangeFilter,
} from "../_shared/FilterBar";

type FilterBarProps = {
  currentPlanPurpose?: string;
  currentSortOrder?: string;
  currentStatus?: string;
  currentProgress?: string;
  currentDateRange?: string;
  /** 고급 필터 표시 여부 */
  showAdvancedFilters?: boolean;
};

export function FilterBar({
  currentPlanPurpose,
  currentSortOrder = "desc",
  currentStatus,
  currentProgress,
  currentDateRange,
  showAdvancedFilters = true,
}: FilterBarProps) {
  // 기본 필터
  const baseFilters = [planPurposeFilter, sortOrderFilter];

  // 고급 필터
  const advancedFilters = showAdvancedFilters
    ? [planGroupStatusFilter, progressFilter, dateRangeFilter]
    : [];

  return (
    <SharedFilterBar
      filters={[...baseFilters, ...advancedFilters]}
      basePath="/plan"
    />
  );
}
