"use client";

import { cn } from "@/lib/cn";
import type { ExplorationGuide } from "@/lib/domains/guide/types";
import {
  GUIDE_TYPE_LABELS,
  GUIDE_STATUS_LABELS,
  GUIDE_SOURCE_TYPE_LABELS,
  QUALITY_TIER_LABELS,
  DIFFICULTY_LABELS,
} from "@/lib/domains/guide/types";

interface GuideListTableProps {
  guides: ExplorationGuide[];
  isLoading: boolean;
  onRowClick: (id: string) => void;
  showAllVersions?: boolean;
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

const DIFFICULTY_COLORS: Record<string, string> = {
  basic: "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300",
  intermediate: "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300",
  advanced: "bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300",
};

export function GuideListTable({
  guides,
  isLoading,
  onRowClick,
  showAllVersions,
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
          <tr className="bg-secondary-50 dark:bg-secondary-800/50 text-left whitespace-nowrap">
            <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">
              제목
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20">
              유형
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20">
              상태
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden sm:table-cell">
              소스
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden sm:table-cell">
              품질
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-16 hidden md:table-cell">
              난이도
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-28 hidden md:table-cell">
              AI 모델
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-12 hidden md:table-cell text-center">
              버전
            </th>
            <th className="px-3 py-3 font-medium text-[var(--text-secondary)] w-20 hidden lg:table-cell">
              생성일
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
          {guides.map((guide) => {
            const curriculumPath = [
              guide.subject_area,
              guide.subject_select,
              guide.unit_major,
              guide.unit_minor,
            ]
              .filter(Boolean)
              .join(" > ");

            return (
              <tr
                key={guide.id}
                onClick={() => onRowClick(guide.id)}
                className="cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800/30 transition-colors"
              >
                {/* 제목 + 교육과정 체계 + 버전 메시지/생성자 */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <p className={cn(
                      "font-medium line-clamp-1",
                      !guide.is_latest && showAllVersions
                        ? "text-[var(--text-secondary)]"
                        : "text-[var(--text-heading)]",
                    )}>
                      {guide.title}
                    </p>
                    {showAllVersions && !guide.is_latest && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-secondary-100 dark:bg-secondary-800 text-[var(--text-secondary)]">
                        이전
                      </span>
                    )}
                  </div>
                  {curriculumPath ? (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5 line-clamp-1">
                      {curriculumPath}
                    </p>
                  ) : guide.book_title ? (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                      {guide.book_title}
                    </p>
                  ) : null}
                  {showAllVersions && (guide.version_message || guide.creator_name) && (
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 line-clamp-1">
                      {guide.version_message && <span>{guide.version_message}</span>}
                      {guide.version_message && guide.creator_name && <span> · </span>}
                      {guide.creator_name && <span>{guide.creator_name}</span>}
                    </p>
                  )}
                </td>

                {/* 유형 */}
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                      TYPE_COLORS[guide.guide_type] ?? "",
                    )}
                  >
                    {GUIDE_TYPE_LABELS[guide.guide_type]}
                  </span>
                </td>

                {/* 상태 */}
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                      STATUS_COLORS[guide.status] ?? "",
                    )}
                  >
                    {GUIDE_STATUS_LABELS[guide.status]}
                  </span>
                </td>

                {/* 소스 */}
                <td className="px-3 py-3 hidden sm:table-cell">
                  <span
                    className={cn(
                      "text-xs whitespace-nowrap",
                      SOURCE_COLORS[guide.source_type] ?? "",
                    )}
                  >
                    {GUIDE_SOURCE_TYPE_LABELS[guide.source_type] ?? guide.source_type}
                  </span>
                </td>

                {/* 품질 (등급 + 점수) */}
                <td className="px-3 py-3 hidden sm:table-cell">
                  {guide.quality_tier ? (
                    <div>
                      <span
                        className={cn(
                          "text-xs whitespace-nowrap",
                          QUALITY_COLORS[guide.quality_tier] ?? "",
                        )}
                      >
                        {QUALITY_TIER_LABELS[guide.quality_tier]}
                      </span>
                      {guide.quality_score != null && (
                        <span className="block text-[10px] text-[var(--text-secondary)]">
                          {guide.quality_score}점
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-secondary-400">—</span>
                  )}
                </td>

                {/* 난이도 */}
                <td className="px-3 py-3 hidden md:table-cell">
                  {guide.difficulty_level ? (
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap",
                        DIFFICULTY_COLORS[guide.difficulty_level] ?? "",
                      )}
                    >
                      {DIFFICULTY_LABELS[guide.difficulty_level as keyof typeof DIFFICULTY_LABELS]}
                    </span>
                  ) : (
                    <span className="text-xs text-secondary-400">—</span>
                  )}
                </td>

                {/* AI 모델 */}
                <td className="px-3 py-3 hidden md:table-cell whitespace-nowrap">
                  {guide.ai_model_version ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                      AI
                      <span className="text-[10px] opacity-70">
                        {guide.ai_model_version}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-secondary-400">—</span>
                  )}
                </td>

                {/* 버전 */}
                <td className="px-3 py-3 hidden md:table-cell text-center">
                  <span className="text-xs text-[var(--text-secondary)]">
                    v{guide.version}
                  </span>
                </td>

                {/* 생성일 */}
                <td className="px-3 py-3 hidden lg:table-cell text-xs text-[var(--text-secondary)] whitespace-nowrap">
                  {new Date(guide.created_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
