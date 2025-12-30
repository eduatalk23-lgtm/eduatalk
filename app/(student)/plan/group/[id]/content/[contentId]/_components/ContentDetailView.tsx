"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  BookOpen,
  Video,
  FileText,
  Clock,
  CheckCircle2,
  Circle,
  PlayCircle,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import type { PlanContent } from "@/lib/types/plan";

type Plan = {
  id: string;
  plan_date: string;
  block_index: number;
  planned_start_page_or_time: number;
  planned_end_page_or_time: number;
  completed_amount: number | null;
  progress: number | null;
  content_title: string | null;
  content_subject: string | null;
  total_duration_seconds: number | null;
  status: "pending" | "in_progress" | "completed";
};

type Stats = {
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  pendingPlans: number;
  totalDurationSeconds: number;
  averageProgress: number;
};

type ContentDetailViewProps = {
  content: PlanContent;
  contentTitle: string;
  plans: Plan[];
  stats: Stats;
  planGroupId: string;
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

const statusConfig = {
  pending: {
    icon: Circle,
    label: "대기",
    color: "text-gray-500",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  in_progress: {
    icon: PlayCircle,
    label: "진행중",
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  completed: {
    icon: CheckCircle2,
    label: "완료",
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function ContentDetailView({
  content,
  contentTitle,
  plans,
  stats,
  planGroupId,
}: ContentDetailViewProps) {
  const typeConfig = contentTypeConfig[content.content_type as keyof typeof contentTypeConfig] || contentTypeConfig.custom;
  const TypeIcon = typeConfig.icon;

  // 날짜별로 플랜 그룹화
  const plansByDate = useMemo(() => {
    const grouped = new Map<string, Plan[]>();
    plans.forEach((plan) => {
      const existing = grouped.get(plan.plan_date) || [];
      existing.push(plan);
      grouped.set(plan.plan_date, existing);
    });
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [plans]);

  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4">
        <Link
          href={`/plan/group/${planGroupId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          플랜 그룹으로 돌아가기
        </Link>

        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-xl", typeConfig.bgColor)}>
            <TypeIcon className={cn("h-8 w-8", typeConfig.color)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="info" size="sm">
                {typeConfig.label}
              </Badge>
              {plans[0]?.content_subject && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {plans[0].content_subject}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">
              {contentTitle}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {content.start_range} ~ {content.end_range} {typeConfig.unit}
            </p>
          </div>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">전체 플랜</div>
          <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.totalPlans}개
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">완료</div>
          <div className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.completedPlans}개
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">평균 진행률</div>
          <div className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.averageProgress}%
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">총 학습 시간</div>
          <div className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">
            {formatDuration(stats.totalDurationSeconds)}
          </div>
        </div>
      </div>

      {/* 진행률 바 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            전체 진행률
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {stats.completedPlans}/{stats.totalPlans} 완료
          </span>
        </div>
        <ProgressBar
          value={stats.totalPlans > 0 ? Math.round((stats.completedPlans / stats.totalPlans) * 100) : 0}
          size="md"
          variant={stats.completedPlans === stats.totalPlans && stats.totalPlans > 0 ? "success" : "default"}
        />
      </div>

      {/* 플랜 목록 (날짜별) */}
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          학습 일정
        </h2>

        {plansByDate.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-8 text-center">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600 dark:text-gray-400">
              아직 생성된 플랜이 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {plansByDate.map(([date, datePlans]) => (
              <div
                key={date}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
              >
                <div className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-4 py-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {formatDate(date)}
                  </span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {datePlans.map((plan) => {
                    const statusCfg = statusConfig[plan.status];
                    const StatusIcon = statusCfg.icon;

                    return (
                      <div
                        key={plan.id}
                        className="flex items-center gap-4 px-4 py-3"
                      >
                        <div className={cn("p-1.5 rounded-lg", statusCfg.bgColor)}>
                          <StatusIcon className={cn("h-4 w-4", statusCfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {plan.planned_start_page_or_time} ~ {plan.planned_end_page_or_time} {typeConfig.unit}
                            </span>
                            <Badge
                              variant={
                                plan.status === "completed"
                                  ? "success"
                                  : plan.status === "in_progress"
                                  ? "info"
                                  : "default"
                              }
                              size="sm"
                            >
                              {statusCfg.label}
                            </Badge>
                          </div>
                          {plan.total_duration_seconds && plan.total_duration_seconds > 0 && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
                              <Clock className="h-3 w-3" />
                              {formatDuration(plan.total_duration_seconds)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-16">
                            <ProgressBar
                              value={plan.progress ?? 0}
                              size="sm"
                              variant={
                                plan.status === "completed"
                                  ? "success"
                                  : plan.status === "in_progress"
                                  ? "default"
                                  : "warning"
                              }
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-10 text-right">
                            {plan.progress ?? 0}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
