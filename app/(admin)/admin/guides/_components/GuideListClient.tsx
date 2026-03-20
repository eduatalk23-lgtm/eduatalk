"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  cmsGuideListQueryOptions,
  explorationGuideKeys,
} from "@/lib/query-options/explorationGuide";
import type { GuideListFilter, GuideType, GuideStatus } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
  GUIDE_TYPES,
  GUIDE_STATUSES,
} from "@/lib/domains/guide/types";
import { GuideListTable } from "./GuideListTable";

const PAGE_SIZE = 20;

export function GuideListClient() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<GuideListFilter>({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [searchInput, setSearchInput] = useState("");

  const { data, isLoading } = useQuery(cmsGuideListQueryOptions(filters));

  const guides = data?.success ? data.data?.data ?? [] : [];
  const totalCount = data?.success ? data.data?.count ?? 0 : 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleSearch = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      searchQuery: searchInput || undefined,
      page: 1,
    }));
  }, [searchInput]);

  const handleFilterChange = useCallback(
    (key: keyof GuideListFilter, value: string | undefined) => {
      setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
    },
    [],
  );

  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        {/* 검색 */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="제목 또는 도서명 검색..."
              className={cn(
                "w-full pl-9 pr-3 py-2 rounded-lg border text-sm",
                "border-secondary-200 dark:border-secondary-700",
                "bg-white dark:bg-secondary-900",
                "text-[var(--text-primary)] placeholder:text-secondary-400",
                "focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500",
              )}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            검색
          </button>
        </div>

        {/* 타입 필터 */}
        <select
          value={filters.guideType ?? ""}
          onChange={(e) => handleFilterChange("guideType", e.target.value as GuideType)}
          className={cn(
            "px-3 py-2 rounded-lg border text-sm",
            "border-secondary-200 dark:border-secondary-700",
            "bg-white dark:bg-secondary-900 text-[var(--text-primary)]",
          )}
        >
          <option value="">전체 유형</option>
          {GUIDE_TYPES.map((t) => (
            <option key={t} value={t}>
              {GUIDE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        {/* 상태 필터 */}
        <select
          value={filters.status ?? ""}
          onChange={(e) => handleFilterChange("status", e.target.value as GuideStatus)}
          className={cn(
            "px-3 py-2 rounded-lg border text-sm",
            "border-secondary-200 dark:border-secondary-700",
            "bg-white dark:bg-secondary-900 text-[var(--text-primary)]",
          )}
        >
          <option value="">전체 상태</option>
          {GUIDE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GUIDE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* 새 가이드 */}
        <Link
          href="/admin/guides/new"
          className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          새 가이드
        </Link>
      </div>

      {/* 결과 수 */}
      <div className="text-sm text-[var(--text-secondary)]">
        총 <span className="font-semibold text-[var(--text-primary)]">{totalCount.toLocaleString()}</span>건
        {filters.searchQuery && (
          <span className="ml-1">
            · &quot;{filters.searchQuery}&quot; 검색 결과
          </span>
        )}
      </div>

      {/* 테이블 */}
      <GuideListTable
        guides={guides}
        isLoading={isLoading}
        onRowClick={(id) => router.push(`/admin/guides/${id}`)}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handlePageChange((filters.page ?? 1) - 1)}
            disabled={(filters.page ?? 1) <= 1}
            className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-[var(--text-secondary)]">
            {filters.page ?? 1} / {totalPages}
          </span>
          <button
            onClick={() => handlePageChange((filters.page ?? 1) + 1)}
            disabled={(filters.page ?? 1) >= totalPages}
            className="p-2 rounded-lg border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
