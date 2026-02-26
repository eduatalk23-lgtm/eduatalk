"use client";

import { useState, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Calendar,
  Clock,
  BookOpen,
  Headphones,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { MiniCalendar } from "./MiniCalendar";
import { WeeklySummary } from "./WeeklySummary";
import { WeeklyOptimizationInsights } from "./WeeklyOptimizationInsights";
import { formatDateString } from "@/lib/date/calendarUtils";
import { cn } from "@/lib/cn";
import type { PlanWithContent } from "../_types/plan";

type CalendarSidebarProps = {
  plans: PlanWithContent[];
  minDate: string;
  maxDate: string;
  initialDate: string;
  selectedTimeRange?: { start: string; end: string } | null;
  onQuickPlanCreate?: () => void;
  studentId?: string | null;
};

/**
 * 캘린더 사이드바
 *
 * 미니 캘린더, 주간 요약, 빠른 플랜 생성을 포함하는 사이드바입니다.
 */
export const CalendarSidebar = memo(function CalendarSidebar({
  plans,
  minDate,
  maxDate,
  initialDate,
  selectedTimeRange,
  onQuickPlanCreate,
  studentId,
}: CalendarSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [contentType, setContentType] = useState<"book" | "lecture" | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);

  // URL에서 현재 날짜 읽기
  const urlDate = searchParams.get("date");
  const currentDateStr = urlDate || initialDate;
  const currentDate = new Date(currentDateStr + "T00:00:00");

  // 날짜 선택 핸들러
  const handleDateSelect = useCallback(
    (date: Date) => {
      const dateStr = formatDateString(date);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", dateStr);
      params.set("view", "day"); // 날짜 선택 시 일별 보기로 전환
      router.push(`?${params.toString()}`);
      setShowQuickCreate(true); // 날짜 선택 시 빠른 생성 패널 열기
    },
    [router, searchParams]
  );

  // 빠른 생성 페이지로 이동
  const handleGoToQuickCreate = useCallback(() => {
    const params = new URLSearchParams();
    params.set("date", currentDateStr);
    if (contentType) {
      params.set("type", contentType);
    }
    router.push(`/plan/quick-create?${params.toString()}`);
  }, [currentDateStr, contentType, router]);

  // 전체 위저드로 이동
  const handleGoToWizard = useCallback(() => {
    const params = new URLSearchParams();
    params.set("startDate", currentDateStr);
    router.push(`/plan/new-group?${params.toString()}`);
  }, [currentDateStr, router]);

  return (
    <div className="flex flex-col gap-4">
      {/* 미니 캘린더 */}
      <MiniCalendar
        currentDate={currentDate}
        onDateSelect={handleDateSelect}
        plans={plans}
        minDate={minDate}
        maxDate={maxDate}
      />

      {/* 빠른 플랜 생성 패널 */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowQuickCreate(!showQuickCreate)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">빠른 플랜 생성</h3>
          </div>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-gray-400 dark:text-gray-500 transition-transform",
              showQuickCreate && "rotate-90"
            )}
          />
        </button>

        {showQuickCreate && (
          <div className="mt-4 space-y-4">
            {/* 선택된 날짜 정보 */}
            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 p-3">
              <div className="flex items-center gap-2 text-sm text-indigo-700 dark:text-indigo-300">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">
                  {currentDate.toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}
                </span>
              </div>
              {selectedTimeRange && (
                <div className="mt-1 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                  <Clock className="h-4 w-4" />
                  <span>
                    {selectedTimeRange.start} - {selectedTimeRange.end}
                  </span>
                </div>
              )}
            </div>

            {/* 콘텐츠 타입 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                콘텐츠 타입
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setContentType("book")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                    contentType === "book"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <BookOpen className="h-5 w-5" />
                  <span className="text-xs font-medium">교재</span>
                </button>
                <button
                  type="button"
                  onClick={() => setContentType("lecture")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-all",
                    contentType === "lecture"
                      ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300"
                      : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <Headphones className="h-5 w-5" />
                  <span className="text-xs font-medium">강의</span>
                </button>
              </div>
            </div>

            {/* 액션 버튼들 */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoToQuickCreate}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                빠른 생성
              </button>
              <button
                type="button"
                onClick={handleGoToWizard}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 dark:border-gray-600 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500 transition-all"
              >
                <span>전체 위저드로 이동</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 주간 요약 */}
      <WeeklySummary plans={plans} currentDate={currentDate} />

      {/* 주간 최적화 인사이트 */}
      {studentId && (
        <WeeklyOptimizationInsights studentId={studentId} />
      )}

      {/* 도움말 */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-500 dark:text-gray-400">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">팁</p>
        <ul className="space-y-0.5">
          <li>• 날짜를 클릭하여 해당 일의 플랜 확인</li>
          <li>• 캘린더에서 드래그하여 시간 범위 선택</li>
        </ul>
      </div>
    </div>
  );
});
