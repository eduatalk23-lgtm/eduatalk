"use client";

import { cn } from "@/lib/cn";
import type { ExplorationGuide } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
} from "@/lib/domains/guide/types";

interface GuideListTableProps {
  guides: ExplorationGuide[];
  isLoading: boolean;
  onRowClick: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  ai_reviewing: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review_failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  pending_approval: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

const TYPE_COLORS: Record<string, string> = {
  reading: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  topic_exploration: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  subject_performance: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  experiment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  program: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
};

export function GuideListTable({
  guides,
  isLoading,
  onRowClick,
}: GuideListTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-16 rounded-lg bg-secondary-100 dark:bg-secondary-800 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-[var(--text-secondary)] border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-lg">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-secondary-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary-50 dark:bg-secondary-800/50 text-left">
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">
              제목
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-24">
              유형
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-24">
              상태
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-20">
              형식
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-28 hidden md:table-cell">
              도서명
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-28 hidden lg:table-cell">
              생성일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
          {guides.map((guide) => (
            <tr
              key={guide.id}
              onClick={() => onRowClick(guide.id)}
              className="cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800/30 transition-colors"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-[var(--text-heading)] line-clamp-1">
                  {guide.title}
                </p>
                {guide.curriculum_year && (
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {guide.curriculum_year} · {guide.subject_select}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                    TYPE_COLORS[guide.guide_type] ?? "",
                  )}
                >
                  {GUIDE_TYPE_LABELS[guide.guide_type]}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                    STATUS_COLORS[guide.status] ?? "",
                  )}
                >
                  {GUIDE_STATUS_LABELS[guide.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                {guide.content_format}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <p className="text-xs text-[var(--text-secondary)] line-clamp-1">
                  {guide.book_title || "-"}
                </p>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell text-xs text-[var(--text-secondary)]">
                {new Date(guide.created_at).toLocaleDateString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
