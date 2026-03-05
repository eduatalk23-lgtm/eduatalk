"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Clock,
  FileUp,
  AlertTriangle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { StatCard } from "@/components/molecules/StatCard";
import {
  FILE_CATEGORY_LABELS,
  type FileRequestStatus,
  type FileRequestWithStudent,
} from "@/lib/domains/drive/types";
import { textPrimary, textSecondary, textMuted, bgSurface, borderDefault } from "@/lib/utils/darkMode";

const STATUS_LABELS: Record<FileRequestStatus, string> = {
  pending: "대기중",
  overdue: "기한초과",
  submitted: "제출됨",
  approved: "승인됨",
  rejected: "반려됨",
};

const STATUS_COLORS: Record<FileRequestStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

interface Props {
  requests: FileRequestWithStudent[];
  hasMore: boolean;
  kpi: { pending: number; submitted: number; overdue: number };
  currentStatus?: FileRequestStatus;
  currentSearch: string;
  currentPage: number;
}

export function FileRequestDashboardClient({
  requests,
  hasMore,
  kpi,
  currentStatus,
  currentSearch,
  currentPage,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch);

  function pushParams(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      status: currentStatus,
      search: currentSearch,
      page: String(currentPage),
      ...params,
    };
    // Reset page when filter changes
    if (params.status !== undefined || params.search !== undefined) {
      delete merged.page;
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && v !== "") sp.set(k, v);
    }
    router.push(`/admin/files?${sp.toString()}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ search: search || undefined });
  }

  const statusTabs: Array<{ value: FileRequestStatus | undefined; label: string }> = [
    { value: undefined, label: "전체" },
    { value: "pending", label: "대기중" },
    { value: "submitted", label: "제출됨" },
    { value: "rejected", label: "반려됨" },
    { value: "approved", label: "승인됨" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="대기중"
          value={kpi.pending}
          color="amber"
          icon={<Clock className="w-4 h-4" />}
        />
        <StatCard
          label="제출됨"
          value={kpi.submitted}
          color="blue"
          icon={<FileUp className="w-4 h-4" />}
        />
        <StatCard
          label="기한초과"
          value={kpi.overdue}
          color="red"
          icon={<AlertTriangle className="w-4 h-4" />}
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusTabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => pushParams({ status: tab.value })}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full border transition-colors",
              currentStatus === tab.value
                ? "bg-indigo-600 text-white border-indigo-600"
                : cn("border-gray-300 dark:border-gray-600", textSecondary, "hover:bg-gray-100 dark:hover:bg-gray-700")
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", textMuted)} />
          <input
            type="text"
            placeholder="학생 이름 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              "w-full pl-9 pr-3 py-2 text-sm rounded-lg border",
              borderDefault,
              bgSurface,
              textPrimary,
              "placeholder:text-gray-400"
            )}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
        >
          검색
        </button>
      </form>

      {/* Request Cards */}
      {requests.length === 0 ? (
        <div className={cn("text-center py-12", textMuted)}>
          <p className="text-sm">요청이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <button
              key={req.id}
              onClick={() =>
                router.push(
                  `/admin/students/${req.student_id}?tab=files`
                )
              }
              className={cn(
                "flex items-center gap-4 rounded-lg border p-4 text-left transition hover:shadow-sm",
                bgSurface,
                borderDefault,
                "hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("font-medium text-sm", textPrimary)}>
                    {req.student_name}
                  </span>
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded-full",
                      STATUS_COLORS[req.status]
                    )}
                  >
                    {STATUS_LABELS[req.status]}
                  </span>
                  <span className={cn("text-xs", textMuted)}>
                    {FILE_CATEGORY_LABELS[req.category]}
                  </span>
                </div>
                <p className={cn("text-sm truncate", textSecondary)}>
                  {req.title}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {req.deadline && (
                  <span className={cn("text-xs", textMuted)}>
                    기한: {new Date(req.deadline).toLocaleDateString("ko-KR")}
                  </span>
                )}
                <span className={cn("text-xs", textMuted)}>
                  {new Date(req.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(currentPage > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => pushParams({ page: String(currentPage - 1) })}
            disabled={currentPage <= 1}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors",
              borderDefault,
              currentPage <= 1
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>
          <span className={cn("text-sm", textMuted)}>
            {currentPage} 페이지
          </span>
          <button
            onClick={() => pushParams({ page: String(currentPage + 1) })}
            disabled={!hasMore}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors",
              borderDefault,
              !hasMore
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-gray-100 dark:hover:bg-gray-700"
            )}
          >
            다음
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
