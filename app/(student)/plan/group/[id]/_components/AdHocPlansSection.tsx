"use client";

import {
  Zap,
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  Calendar,
} from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { cn } from "@/lib/cn";

type AdHocPlan = {
  id: string;
  plan_date: string;
  title: string;
  description: string | null;
  content_type: string | null;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
  color: string | null;
  icon: string | null;
  container_type: string | null;
  created_at: string;
};

type AdHocPlansSectionProps = {
  plans: AdHocPlan[];
};

const statusConfig: Record<string, {
  icon: typeof Circle;
  label: string;
  color: string;
  bgColor: string;
}> = {
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/**
 * 플랜 그룹에 연결된 빠른 추가 플랜 목록 섹션
 */
export function AdHocPlansSection({ plans }: AdHocPlansSectionProps) {
  if (plans.length === 0) {
    return null; // 빠른 추가 플랜이 없으면 섹션 자체를 숨김
  }

  // 날짜별로 그룹화
  const plansByDate = new Map<string, AdHocPlan[]>();
  plans.forEach((plan) => {
    const existing = plansByDate.get(plan.plan_date) || [];
    existing.push(plan);
    plansByDate.set(plan.plan_date, existing);
  });

  const groupedPlans = Array.from(plansByDate.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  // 통계 계산
  const completedCount = plans.filter((p) => p.status === "completed").length;
  const totalMinutes = plans.reduce((sum, p) => {
    return sum + (p.actual_minutes || p.estimated_minutes || 0);
  }, 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* 헤더 */}
      <div className="border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-100 dark:bg-green-900/50">
              <Zap className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              빠른 추가 플랜
            </h2>
            <Badge variant="success" size="sm">
              {plans.length}개
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {completedCount}/{plans.length} 완료
            </span>
            {totalMinutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(totalMinutes)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 플랜 목록 */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {groupedPlans.map(([date, datePlans]) => (
          <div key={date}>
            <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                {formatDate(date)}
              </span>
            </div>
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {datePlans.map((plan) => {
                const status = statusConfig[plan.status] || statusConfig.pending;
                const StatusIcon = status.icon;

                return (
                  <div
                    key={plan.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className={cn("p-1.5 rounded-lg", status.bgColor)}>
                      <StatusIcon className={cn("h-4 w-4", status.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                          {plan.title}
                        </h4>
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
                          {status.label}
                        </Badge>
                      </div>
                      {plan.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    {(plan.estimated_minutes || plan.actual_minutes) && (
                      <div className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        {plan.actual_minutes ? (
                          <span className="text-green-600 dark:text-green-400">
                            {formatDuration(plan.actual_minutes)}
                          </span>
                        ) : (
                          <span>예상 {formatDuration(plan.estimated_minutes!)}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
