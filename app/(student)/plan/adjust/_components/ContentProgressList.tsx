"use client";

import { Pause, Play, Settings } from "lucide-react";
import type { DashboardContent } from "@/lib/domains/plan/actions/adjustDashboard";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type ContentProgressListProps = {
  contents: DashboardContent[];
  onContentClick?: (content: DashboardContent) => void;
  onPauseToggle?: (contentId: string, isPaused: boolean) => void;
  selectedContentId?: string | null;
};

export function ContentProgressList({
  contents,
  onContentClick,
  onPauseToggle,
  selectedContentId,
}: ContentProgressListProps) {
  if (contents.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          등록된 콘텐츠가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
        콘텐츠별 진행률
      </h3>

      <div className="space-y-2">
        {contents.map((content) => (
          <div
            key={content.id}
            onClick={() => onContentClick?.(content)}
            className={cn(
              "cursor-pointer rounded-lg border p-3 transition-all hover:shadow-md",
              selectedContentId === content.contentId
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800",
              content.isPaused && "opacity-60"
            )}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: content.color }}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {content.contentTitle}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {onPauseToggle && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPauseToggle(content.contentId, !content.isPaused);
                    }}
                    className={cn(
                      "rounded p-1 transition-colors",
                      content.isPaused
                        ? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                        : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    )}
                    title={content.isPaused ? "재개하기" : "일시정지"}
                  >
                    {content.isPaused ? (
                      <Play className="h-4 w-4" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    // TODO: 설정 모달 열기
                  }}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* 과목 */}
            {content.subject && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {content.subject}
              </div>
            )}

            {/* 진행률 바 */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">
                  {content.completedPlans}/{content.totalPlans} 완료
                </span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {content.progressPercent}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${content.progressPercent}%`,
                    backgroundColor: content.color,
                  }}
                />
              </div>
            </div>

            {/* 학습 요일 */}
            <div className="mt-2 flex items-center gap-1">
              {WEEKDAY_LABELS.map((label, idx) => {
                const isStudyDay = content.weekdays.includes(idx);
                return (
                  <span
                    key={idx}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded text-[10px]",
                      isStudyDay
                        ? "bg-blue-100 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                    )}
                  >
                    {label}
                  </span>
                );
              })}
            </div>

            {/* 일시정지 상태 */}
            {content.isPaused && (
              <div className="mt-2 rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                ⏸️ 일시정지됨
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
