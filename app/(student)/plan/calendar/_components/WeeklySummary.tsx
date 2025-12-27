"use client";

import { useMemo } from "react";
import {
  Clock,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  BookOpen,
  Video,
  FileText,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDateString } from "@/lib/date/calendarUtils";
import type { PlanWithContent } from "../_types/plan";

type WeeklySummaryProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  className?: string;
};

// 주간 시작일 (월요일) 가져오기
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 주간 날짜 배열 생성
function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

const CONTENT_TYPE_CONFIG = {
  book: { label: "교재", icon: BookOpen, color: "text-blue-600 dark:text-blue-400" },
  lecture: { label: "강의", icon: Video, color: "text-purple-600 dark:text-purple-400" },
  custom: { label: "기타", icon: FileText, color: "text-gray-600 dark:text-gray-400" },
};

/**
 * 주간 요약 사이드바
 *
 * 현재 주의 플랜 요약 정보를 표시합니다.
 */
export function WeeklySummary({ plans, currentDate, className }: WeeklySummaryProps) {
  const weekStart = useMemo(() => getWeekStart(currentDate), [currentDate]);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  // 주간 플랜 필터링
  const weekPlans = useMemo(() => {
    const weekStartStr = formatDateString(weekStart);
    const weekEndStr = formatDateString(weekDates[6]);
    return plans.filter((plan) => plan.plan_date >= weekStartStr && plan.plan_date <= weekEndStr);
  }, [plans, weekStart, weekDates]);

  // 날짜별 플랜 그룹화
  const plansByDate = useMemo(() => {
    const map = new Map<string, PlanWithContent[]>();
    weekPlans.forEach((plan) => {
      const dateStr = plan.plan_date;
      if (!map.has(dateStr)) {
        map.set(dateStr, []);
      }
      map.get(dateStr)!.push(plan);
    });
    return map;
  }, [weekPlans]);

  // 통계 계산
  const stats = useMemo(() => {
    const total = weekPlans.length;
    const completed = weekPlans.filter((p) => p.status === "completed").length;
    const inProgress = weekPlans.filter((p) => p.status === "in_progress").length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 총 학습 시간 (초 -> 분)
    const totalMinutes = weekPlans.reduce((sum, p) => sum + (p.total_duration_seconds || 0), 0) / 60;

    // 콘텐츠 유형별 분류
    const byContentType = weekPlans.reduce(
      (acc, p) => {
        const type = (p.content_type as keyof typeof CONTENT_TYPE_CONFIG) || "custom";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      total,
      completed,
      inProgress,
      completionRate,
      totalMinutes,
      byContentType,
    };
  }, [weekPlans]);

  // 주간 포맷팅
  const weekLabel = useMemo(() => {
    const startMonth = weekStart.getMonth() + 1;
    const startDay = weekStart.getDate();
    const endMonth = weekDates[6].getMonth() + 1;
    const endDay = weekDates[6].getDate();

    if (startMonth === endMonth) {
      return `${startMonth}월 ${startDay}일 - ${endDay}일`;
    }
    return `${startMonth}/${startDay} - ${endMonth}/${endDay}`;
  }, [weekStart, weekDates]);

  const todayStr = formatDateString(new Date());

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">주간 요약</h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">{weekLabel}</span>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-900/20">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">완료율</span>
          </div>
          <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats.completionRate}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {stats.completed}/{stats.total} 완료
          </div>
        </div>

        <div className="rounded-lg bg-green-50 p-3 dark:bg-green-900/20">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">학습 시간</span>
          </div>
          <div className="text-xl font-bold text-green-600 dark:text-green-400">
            {Math.round(stats.totalMinutes)}분
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {Math.round(stats.totalMinutes / 60 * 10) / 10}시간
          </div>
        </div>
      </div>

      {/* 일별 진행 상황 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">일별 진행</span>
        </div>
        <div className="flex gap-1">
          {weekDates.map((date, index) => {
            const dateStr = formatDateString(date);
            const dayPlans = plansByDate.get(dateStr) || [];
            const completed = dayPlans.filter((p) => p.status === "completed").length;
            const total = dayPlans.length;
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;

            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "text-xs",
                    isToday ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400"
                  )}
                >
                  {WEEKDAY_LABELS[index]}
                </span>
                <div
                  className={cn(
                    "w-full h-8 rounded flex items-center justify-center text-xs font-medium",
                    total === 0
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                      : completed === total
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : isPast
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  )}
                >
                  {total > 0 ? `${completed}/${total}` : "-"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 콘텐츠 유형별 분포 */}
      {Object.keys(stats.byContentType).length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">유형별 분포</span>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.byContentType).map(([type, count]) => {
              const config = CONTENT_TYPE_CONFIG[type as keyof typeof CONTENT_TYPE_CONFIG] || CONTENT_TYPE_CONFIG.custom;
              const Icon = config.icon;
              const percentage = Math.round((count / stats.total) * 100);

              return (
                <div key={type} className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{config.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700">
                    <div
                      className={cn("h-2 rounded-full", type === "book" ? "bg-blue-500" : type === "lecture" ? "bg-purple-500" : "bg-gray-500")}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{count}개</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {weekPlans.length === 0 && (
        <div className="text-center py-4">
          <Calendar className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">이번 주 플랜이 없습니다</p>
        </div>
      )}
    </div>
  );
}
