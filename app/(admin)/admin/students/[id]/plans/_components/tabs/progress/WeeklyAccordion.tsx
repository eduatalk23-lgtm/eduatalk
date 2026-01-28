"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { ProgressWeek } from "./progressTypes";
import { ProgressPlanRow } from "./ProgressPlanRow";

interface WeeklyAccordionProps {
  weeks: ProgressWeek[];
  currentDate: string; // 오늘 날짜 (YYYY-MM-DD)
  onStatusChange: (planId: string, newStatus: string) => void;
}

export function WeeklyAccordion({
  weeks,
  currentDate,
  onStatusChange,
}: WeeklyAccordionProps) {
  // 현재 주차를 찾아서 기본 열림 상태로 설정
  const currentWeekIndex = weeks.findIndex(
    (w) => currentDate >= w.startDate && currentDate <= w.endDate
  );

  const [openWeeks, setOpenWeeks] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (currentWeekIndex >= 0) {
      initial.add(currentWeekIndex);
    } else if (weeks.length > 0) {
      // 현재 주차가 없으면 마지막 주차 열기
      initial.add(weeks.length - 1);
    }
    return initial;
  });

  function toggleWeek(index: number) {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  if (weeks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-secondary-400">
        플랜이 없습니다.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {weeks.map((week, idx) => {
        const isOpen = openWeeks.has(idx);
        const hasPlans = week.totalCount > 0;
        const rate =
          week.totalCount > 0
            ? Math.round((week.completedCount / week.totalCount) * 100)
            : 0;

        return (
          <div
            key={week.weekNumber}
            className="overflow-hidden rounded-lg border border-secondary-200 bg-white"
          >
            {/* 주차 헤더 */}
            <button
              type="button"
              onClick={() => toggleWeek(idx)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-secondary-50"
            >
              <span className="text-sm font-semibold text-secondary-800">
                {week.weekNumber === 0
                  ? "미배정"
                  : `${week.weekNumber}주차`}{" "}
                <span className="font-normal text-secondary-500">
                  ({week.startDate} ~ {week.endDate})
                </span>
              </span>
              <span className="flex items-center gap-2">
                {hasPlans && (
                  <span
                    className={cn(
                      "text-xs font-medium",
                      rate === 100
                        ? "text-green-600"
                        : rate > 0
                          ? "text-primary-600"
                          : "text-secondary-400"
                    )}
                  >
                    {week.completedCount}/{week.totalCount} ({rate}%)
                  </span>
                )}
                <svg
                  className={cn(
                    "h-4 w-4 text-secondary-400 transition-transform",
                    isOpen && "rotate-180"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </span>
            </button>

            {/* 날짜별 플랜 목록 */}
            {isOpen && (
              <div className="border-t border-secondary-100 px-4 pb-3 pt-2">
                {!hasPlans ? (
                  <p className="py-2 text-sm text-secondary-400">
                    이 주차에 플랜이 없습니다.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {week.days.map((day) => (
                      <div key={day.date}>
                        <div className="mb-1 flex items-center gap-2">
                          <span className="text-xs font-medium text-secondary-600">
                            {day.date} ({day.dayOfWeek})
                          </span>
                          {day.dayType && (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                day.dayType === "복습일"
                                  ? "bg-purple-100 text-purple-600"
                                  : day.dayType === "학습일"
                                    ? "bg-blue-100 text-blue-600"
                                    : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {day.dayType}
                            </span>
                          )}
                          <span className="text-xs text-secondary-400">
                            {day.completedCount}/{day.totalCount}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          {day.plans.map((plan) => (
                            <ProgressPlanRow
                              key={plan.id}
                              plan={plan}
                              onStatusChange={onStatusChange}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
