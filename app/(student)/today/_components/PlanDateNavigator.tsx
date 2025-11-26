"use client";

import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import {
  formatKoreanDateWithDay,
  getRelativeDateLabel,
  getTodayISODate,
} from "../_utils/dateDisplay";
import { cn } from "@/lib/cn";

type PlanDateNavigatorProps = {
  planDate: string;
  isToday: boolean;
  isLoading: boolean;
  isNavigating: boolean;
  onMoveDay: (delta: number) => void;
  onResetToToday: () => void;
};

export function PlanDateNavigator({
  planDate,
  isToday,
  isLoading,
  isNavigating,
  onMoveDay,
  onResetToToday,
}: PlanDateNavigatorProps) {
  const hasDate = Boolean(planDate);
  const formattedDate = hasDate
    ? formatKoreanDateWithDay(planDate)
    : "날짜 정보를 불러오고 있습니다";
  const relativeLabelRaw = hasDate
    ? getRelativeDateLabel(planDate, getTodayISODate())
    : "";
  const relativeLabel =
    relativeLabelRaw && relativeLabelRaw !== "-" ? relativeLabelRaw : "선택한 날짜";
  const disableNav = !hasDate || isLoading || isNavigating;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-gray-500">
              {relativeLabel}
            </span>
            <span className="text-lg font-semibold text-gray-900">
              {formattedDate}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMoveDay(-1)}
            disabled={disableNav}
            aria-label="이전 날짜로 이동"
            className={cn(
              "flex items-center gap-1 rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition",
              disableNav ? "opacity-60" : "hover:bg-gray-50"
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            이전
          </button>
          <button
            type="button"
            onClick={() => onMoveDay(1)}
            disabled={disableNav}
            aria-label="다음 날짜로 이동"
            className={cn(
              "flex items-center gap-1 rounded-full border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition",
              disableNav ? "opacity-60" : "hover:bg-gray-50"
            )}
          >
            다음
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {!isToday && hasDate && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onResetToToday}
            disabled={isLoading || isNavigating}
            aria-label="오늘 날짜로 돌아가기"
            className={cn(
              "flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition",
              isLoading || isNavigating
                ? "opacity-60"
                : "hover:bg-indigo-100"
            )}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            오늘로 이동
          </button>
        </div>
      )}
    </div>
  );
}

