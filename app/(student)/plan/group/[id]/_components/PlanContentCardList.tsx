"use client";

import Link from "next/link";
import { BookOpen, Video, FileText, ChevronRight, Clock } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";

type ContentCardData = {
  id: string;
  contentId: string;
  contentType: "book" | "lecture" | "custom";
  title: string;
  subtitle: string | null;
  startRange: number;
  endRange: number;
  totalPlans: number;
  completedPlans: number;
  progress: number;
  totalDurationSeconds: number;
};

type PlanContentCardListProps = {
  groupId: string;
  contents: ContentCardData[];
};

const contentTypeConfig = {
  book: {
    icon: BookOpen,
    label: "교재",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    unit: "페이지",
  },
  lecture: {
    icon: Video,
    label: "강의",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    unit: "분",
  },
  custom: {
    icon: FileText,
    label: "커스텀",
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
    unit: "",
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/**
 * 플랜 그룹의 콘텐츠 목록을 카드 형태로 표시
 * 각 카드는 콘텐츠 상세 페이지로 링크됨
 */
export function PlanContentCardList({ groupId, contents }: PlanContentCardListProps) {
  if (contents.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-6 text-center">
        <BookOpen className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          등록된 콘텐츠가 없습니다.
        </p>
      </div>
    );
  }

  // 통합 통계 계산
  const aggregated = {
    totalContents: contents.length,
    totalPlans: contents.reduce((sum, c) => sum + c.totalPlans, 0),
    completedPlans: contents.reduce((sum, c) => sum + c.completedPlans, 0),
    totalDurationSeconds: contents.reduce((sum, c) => sum + c.totalDurationSeconds, 0),
  };
  const overallProgress = aggregated.totalPlans > 0
    ? Math.round((aggregated.completedPlans / aggregated.totalPlans) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          콘텐츠 목록
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {contents.length}개
        </span>
      </div>

      {/* 통합 진행률 요약 */}
      {aggregated.totalPlans > 0 && (
        <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                전체: <strong className="text-gray-900 dark:text-gray-100">{aggregated.completedPlans}/{aggregated.totalPlans}개</strong> 완료
              </span>
              {aggregated.totalDurationSeconds > 0 && (
                <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(aggregated.totalDurationSeconds)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex-1">
                <ProgressBar
                  value={overallProgress}
                  size="sm"
                  variant={
                    overallProgress >= 100
                      ? "success"
                      : overallProgress > 0
                      ? "default"
                      : "warning"
                  }
                />
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 w-10 text-right">
                {overallProgress}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {contents.map((content) => {
          const config = contentTypeConfig[content.contentType] || contentTypeConfig.custom;
          const Icon = config.icon;

          return (
            <Link
              key={content.id}
              href={`/plan/group/${groupId}/content/${content.id}`}
              className={cn(
                "group relative rounded-xl border bg-white dark:bg-gray-800 p-4 transition-all",
                "border-gray-200 dark:border-gray-700",
                "hover:border-gray-300 dark:hover:border-gray-600",
                "hover:shadow-md hover:-translate-y-0.5"
              )}
            >
              <div className="flex flex-col gap-3">
                {/* 헤더 */}
                <div className="flex items-start gap-3">
                  <div className={cn("p-2 rounded-lg flex-shrink-0", config.bgColor)}>
                    <Icon className={cn("h-5 w-5", config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Badge variant="default" size="sm" className="mb-1">
                      {config.label}
                    </Badge>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {content.title}
                    </h3>
                    {content.subtitle && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {content.subtitle}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors flex-shrink-0" />
                </div>

                {/* 범위 */}
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {content.startRange} ~ {content.endRange} {config.unit}
                </div>

                {/* 진행률 */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar
                      value={content.progress}
                      size="sm"
                      variant={
                        content.progress >= 100
                          ? "success"
                          : content.progress > 0
                          ? "default"
                          : "warning"
                      }
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                    {content.progress}%
                  </span>
                </div>

                {/* 플랜 통계 */}
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-2">
                  <span>
                    {content.completedPlans}/{content.totalPlans}개 완료
                  </span>
                  {content.totalDurationSeconds > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(content.totalDurationSeconds)}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
