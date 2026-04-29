import type { BypassCandidateStatus } from "@/lib/domains/bypass-major/types";

// ─── 상태 뱃지 색상 ─────────────────────────────────

export const STATUS_COLORS: Record<BypassCandidateStatus, string> = {
  candidate: "bg-bg-tertiary text-text-secondary dark:bg-gray-800 dark:text-text-tertiary",
  shortlisted:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  rejected: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

export const SOURCE_COLORS: Record<string, string> = {
  pre_mapped:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  similarity:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  manual:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
};

export const PLACEMENT_LABELS: Record<string, string> = {
  safe: "안정",
  possible: "적정",
  bold: "소신",
  unstable: "불안정",
  danger: "위험",
};

export const PLACEMENT_COLORS: Record<string, string> = {
  safe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  possible: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  bold: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  unstable:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  danger: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

export const PLACE_SOURCE_LABEL: Record<string, string> = {
  mock: "모의",
  gpa: "내신",
  none: "",
};
