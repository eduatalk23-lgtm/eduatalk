"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textPrimary,
  textSecondary,
  inlineButtonPrimary,
} from "@/lib/utils/darkMode";
import {
  PIPELINE_STATUS_LABELS,
  LEAD_SOURCE_LABELS,
} from "@/lib/domains/crm/constants";

type LeadSearchFilterProps = {
  searchQuery: string;
  statusFilter: string;
  sourceFilter: string;
  qualityFilter: string;
  assignedToFilter: string;
  dateFrom: string;
  dateTo: string;
  adminUsers: { id: string; name: string }[];
};

export function LeadSearchFilter({
  searchQuery,
  statusFilter,
  sourceFilter,
  qualityFilter,
  assignedToFilter,
  dateFrom,
  dateTo,
  adminUsers,
}: LeadSearchFilterProps) {
  const hasActiveFilters =
    searchQuery || statusFilter || sourceFilter || qualityFilter || assignedToFilter || dateFrom || dateTo;

  const inputClass = cn(
    "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  return (
    <form method="get" className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className={cn("text-sm font-medium", textSecondary)}>검색</label>
          <input
            type="text"
            name="search"
            placeholder="이름 / 전화번호..."
            defaultValue={searchQuery}
            className={cn(inputClass, "w-full")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>상태</label>
          <select name="status" defaultValue={statusFilter} className={inputClass}>
            <option value="">전체</option>
            {Object.entries(PIPELINE_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>유입경로</label>
          <select name="source" defaultValue={sourceFilter} className={inputClass}>
            <option value="">전체</option>
            {Object.entries(LEAD_SOURCE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>품질</label>
          <select name="quality" defaultValue={qualityFilter} className={inputClass}>
            <option value="">전체</option>
            <option value="hot">HOT</option>
            <option value="warm">WARM</option>
            <option value="cold">COLD</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>담당자</label>
          <select name="assigned_to" defaultValue={assignedToFilter} className={inputClass}>
            <option value="">전체</option>
            {adminUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>시작일</label>
          <input
            type="date"
            name="date_from"
            defaultValue={dateFrom}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>종료일</label>
          <input
            type="date"
            name="date_to"
            defaultValue={dateTo}
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className={cn(
            "rounded-lg px-6 py-2 text-sm font-semibold text-white transition",
            inlineButtonPrimary()
          )}
        >
          검색
        </button>

        {hasActiveFilters && (
          <Link
            href="/admin/crm/leads"
            className={cn(
              "rounded-lg border px-6 py-2 text-sm font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover
            )}
          >
            초기화
          </Link>
        )}
      </div>
    </form>
  );
}
