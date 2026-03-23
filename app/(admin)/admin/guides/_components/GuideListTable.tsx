"use client";

import { cn } from "@/lib/cn";
import type { ExplorationGuide } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
  GUIDE_SOURCE_TYPE_LABELS,
  QUALITY_TIER_LABELS,
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

const SOURCE_COLORS: Record<string, string> = {
  imported: "text-secondary-600 dark:text-secondary-400",
  manual: "text-blue-600 dark:text-blue-400",
  manual_edit: "text-blue-600 dark:text-blue-400",
  ai_keyword: "text-purple-600 dark:text-purple-400",
  ai_pdf_extract: "text-purple-600 dark:text-purple-400",
  ai_url_extract: "text-purple-600 dark:text-purple-400",
  ai_clone_variant: "text-purple-600 dark:text-purple-400",
  ai_improve: "text-purple-600 dark:text-purple-400",
  ai_hybrid: "text-purple-600 dark:text-purple-400",
  revert: "text-secondary-500 dark:text-secondary-400",
};

const QUALITY_COLORS: Record<string, string> = {
  expert_authored: "text-emerald-700 dark:text-emerald-400 font-semibold",
  expert_reviewed: "text-emerald-600 dark:text-emerald-400",
  ai_reviewed_approved: "text-blue-600 dark:text-blue-400",
  ai_draft: "text-yellow-600 dark:text-yellow-400",
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
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-20">
              상태
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-24 hidden md:table-cell">
              소스
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-24 hidden md:table-cell">
              품질
            </th>
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)] w-24 hidden lg:table-cell">
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
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                  {[
                    guide.curriculum_year,
                    guide.subject_area,
                    guide.subject_select,
                    guide.book_title,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
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
              <td className="px-4 py-3 hidden md:table-cell">
                <span
                  className={cn(
                    "text-xs",
                    SOURCE_COLORS[guide.source_type] ?? "",
                  )}
                >
                  {GUIDE_SOURCE_TYPE_LABELS[guide.source_type] ?? guide.source_type}
                </span>
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                {guide.quality_tier ? (
                  <span
                    className={cn(
                      "text-xs",
                      QUALITY_COLORS[guide.quality_tier] ?? "",
                    )}
                  >
                    {QUALITY_TIER_LABELS[guide.quality_tier]}
                  </span>
                ) : (
                  <span className="text-xs text-secondary-400">—</span>
                )}
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
