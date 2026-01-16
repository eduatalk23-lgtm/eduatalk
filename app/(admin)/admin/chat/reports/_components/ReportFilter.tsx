"use client";

/**
 * 신고 필터 컴포넌트
 */

import type { ReportStatus, ReportReason } from "@/lib/domains/chat/types";
import { cn } from "@/lib/cn";

interface ReportFilterProps {
  statusFilter: ReportStatus | "all";
  reasonFilter: ReportReason | "all";
  onStatusChange: (status: ReportStatus | "all") => void;
  onReasonChange: (reason: ReportReason | "all") => void;
  onReset: () => void;
}

const STATUS_OPTIONS: Array<{ value: ReportStatus | "all"; label: string }> = [
  { value: "all", label: "전체 상태" },
  { value: "pending", label: "대기중" },
  { value: "reviewed", label: "검토중" },
  { value: "resolved", label: "승인됨" },
  { value: "dismissed", label: "기각됨" },
];

const REASON_OPTIONS: Array<{ value: ReportReason | "all"; label: string }> = [
  { value: "all", label: "전체 사유" },
  { value: "spam", label: "스팸" },
  { value: "harassment", label: "괴롭힘" },
  { value: "inappropriate", label: "부적절한 내용" },
  { value: "hate_speech", label: "혐오 발언" },
  { value: "other", label: "기타" },
];

export function ReportFilter({
  statusFilter,
  reasonFilter,
  onStatusChange,
  onReasonChange,
  onReset,
}: ReportFilterProps) {
  const hasActiveFilter = statusFilter !== "all" || reasonFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-bg-secondary rounded-lg">
      {/* 상태 필터 */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="status-filter"
          className="text-sm text-text-secondary whitespace-nowrap"
        >
          상태
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) =>
            onStatusChange(e.target.value as ReportStatus | "all")
          }
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg border border-border",
            "bg-bg-primary text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary/20"
          )}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 사유 필터 */}
      <div className="flex items-center gap-2">
        <label
          htmlFor="reason-filter"
          className="text-sm text-text-secondary whitespace-nowrap"
        >
          사유
        </label>
        <select
          id="reason-filter"
          value={reasonFilter}
          onChange={(e) =>
            onReasonChange(e.target.value as ReportReason | "all")
          }
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg border border-border",
            "bg-bg-primary text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-primary/20"
          )}
        >
          {REASON_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 필터 초기화 */}
      {hasActiveFilter && (
        <button
          type="button"
          onClick={onReset}
          className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
}
