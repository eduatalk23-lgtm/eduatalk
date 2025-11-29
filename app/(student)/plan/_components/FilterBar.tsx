"use client";

import { FilterBar as SharedFilterBar, planPurposeFilter, sortOrderFilter } from "../_shared/FilterBar";

type FilterBarProps = {
  currentPlanPurpose?: string;
  currentSortOrder?: string;
};

export function FilterBar({ currentPlanPurpose, currentSortOrder = "desc" }: FilterBarProps) {
  return (
    <SharedFilterBar
      filters={[planPurposeFilter, sortOrderFilter]}
      basePath="/plan"
    />
  );
}

