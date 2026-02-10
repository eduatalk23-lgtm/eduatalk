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
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/domains/crm/constants";

type TaskSearchFilterProps = {
  statusFilter: string;
  priorityFilter: string;
  assignedToFilter: string;
  isOverdueFilter: boolean;
  adminUsers: { id: string; name: string }[];
};

export function TaskSearchFilter({
  statusFilter,
  priorityFilter,
  assignedToFilter,
  isOverdueFilter,
  adminUsers,
}: TaskSearchFilterProps) {
  const hasActiveFilters =
    statusFilter || priorityFilter || assignedToFilter || isOverdueFilter;

  const inputClass = cn(
    "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  return (
    <form
      method="get"
      className="flex flex-col gap-4 md:flex-row md:items-end md:flex-wrap"
    >
      <div className="flex flex-col gap-1">
        <label className={cn("text-sm font-medium", textSecondary)}>상태</label>
        <select name="status" defaultValue={statusFilter} className={inputClass}>
          <option value="">전체</option>
          {Object.entries(TASK_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={cn("text-sm font-medium", textSecondary)}>
          우선순위
        </label>
        <select
          name="priority"
          defaultValue={priorityFilter}
          className={inputClass}
        >
          <option value="">전체</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className={cn("text-sm font-medium", textSecondary)}>
          담당자
        </label>
        <select
          name="assigned_to"
          defaultValue={assignedToFilter}
          className={inputClass}
        >
          <option value="">전체</option>
          {adminUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <label
          className={cn(
            "flex items-center gap-2 rounded-lg border px-4 py-2 transition",
            borderInput,
            bgSurface,
            bgHover
          )}
        >
          <input
            type="checkbox"
            name="is_overdue"
            value="true"
            defaultChecked={isOverdueFilter}
            className={cn(
              "rounded text-indigo-600 focus:ring-indigo-500",
              borderInput
            )}
          />
          <span className={cn("text-sm", textSecondary)}>기한초과만</span>
        </label>
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
          href="/admin/crm/tasks"
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
    </form>
  );
}
