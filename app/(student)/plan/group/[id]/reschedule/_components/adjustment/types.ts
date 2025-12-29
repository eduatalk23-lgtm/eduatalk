/**
 * AdjustmentStep 서브 컴포넌트용 타입 정의
 *
 * @module adjustment/types
 */

import type { PlanContent } from "@/lib/types/plan";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";

export type DateRange = {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
};

export type RangeInputs = Map<string, { start: string; end: string }>;

export type ReplacedContentInfo = Map<
  string,
  { title: string; total_page_or_time: number | null }
>;

export type ContentAdjustmentCardProps = {
  content: PlanContent;
  contentId: string;
  adjustment: AdjustmentInput | undefined;
  currentRange: { start: number; end: number };
  rangeInputs: RangeInputs;
  validationErrors: Map<string, string>;
  replacedContentInfo: ReplacedContentInfo;
  onRangeInputChange: (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => void;
  onRangeBlur: (contentId: string, field: "start" | "end") => void;
  onReplacedRangeInputChange: (
    contentId: string,
    field: "start" | "end",
    value: string
  ) => void;
  onReplacedRangeBlur: (contentId: string, field: "start" | "end") => void;
  onReplaceClick: (contentId: string) => void;
  onCancelReplace: (contentId: string) => void;
};

export type BatchModeBannerProps = {
  contentCount: number;
  onEnableBatchMode: () => void;
};

export type BatchModeToggleProps = {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

export type PlacementRangeSectionProps = {
  placementMode: "auto" | "manual";
  onPlacementModeChange: (mode: "auto" | "manual") => void;
  placementDateRange: DateRange;
  onPlacementDateRangeChange: (range: DateRange) => void;
  tomorrowStr: string;
  groupPeriodEnd: string;
  existingPlans?: Array<{
    id: string;
    plan_date: string;
    status: string | null;
    is_active: boolean | null;
  }>;
};

export type AdjustmentSummaryProps = {
  adjustments: Map<string, AdjustmentInput>;
  contents: PlanContent[];
};

export type { PlanContent, AdjustmentInput };
