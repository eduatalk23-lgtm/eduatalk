"use client";

/**
 * 관리자 타임라인/간트 뷰
 *
 * 플랜 기간을 시각적 타임라인으로 표시합니다.
 * 플랜 막대에 호버 시 상세 정보 툴팁을 표시합니다.
 * 드래그앤드롭으로 플랜 날짜 변경 지원
 */

import { useMemo } from "react";
import {
  eachDayOfInterval,
  format,
  parseISO,
  differenceInDays,
} from "date-fns";
import { ko } from "date-fns/locale";

import { cn } from "@/lib/cn";
import DraggableGanttPlanBar from "./DraggableGanttPlanBar";
import DroppableGanttDateColumn from "./DroppableGanttDateColumn";
import type { AdminGanttViewProps, CalendarPlan } from "./_types/adminCalendar";

// 날짜 셀 너비 (px)
const DAY_WIDTH = 40;


export default function AdminGanttView({
  dateRange,
  rows,
  exclusionsByDate,
  onPlanClick,
}: AdminGanttViewProps) {
  // 날짜 범위 내 모든 날짜
  const dates = useMemo(() => {
    try {
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);
      return eachDayOfInterval({ start, end });
    } catch {
      return [];
    }
  }, [dateRange]);

  // 플랜 막대 위치 계산
  const getPlanBarStyle = (plan: CalendarPlan) => {
    if (!plan.plan_date) return null;

    try {
      const startDate = parseISO(dateRange.start);
      const planDate = parseISO(plan.plan_date);
      const dayOffset = differenceInDays(planDate, startDate);

      // 단일 날짜 플랜은 1일 너비
      const width = DAY_WIDTH;
      const left = dayOffset * DAY_WIDTH;

      return {
        left: `${left}px`,
        width: `${width}px`,
      };
    } catch {
      return null;
    }
  };

  if (dates.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        날짜 범위를 선택해주세요
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 날짜 헤더 */}
      <div className="flex border-b bg-gray-50 sticky top-0 z-10">
        {/* 행 라벨 영역 */}
        <div className="w-48 flex-shrink-0 px-3 py-2 border-r bg-gray-100 font-medium text-sm">
          콘텐츠
        </div>

        {/* 날짜 헤더 스크롤 영역 */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex" style={{ width: dates.length * DAY_WIDTH }}>
            {dates.map((date) => {
              const dateStr = format(date, "yyyy-MM-dd");
              const isExclusion = !!exclusionsByDate[dateStr];
              const dayOfWeek = date.getDay();

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "flex flex-col items-center justify-center border-r text-xs",
                    isExclusion && "bg-gray-200",
                    dayOfWeek === 0 && "text-red-500",
                    dayOfWeek === 6 && "text-blue-500"
                  )}
                  style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                >
                  <span className="text-gray-500">
                    {format(date, "E", { locale: ko })}
                  </span>
                  <span className="font-medium">{format(date, "d")}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 간트 차트 본문 */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="mb-2">표시할 플랜이 없습니다</p>
              <p className="text-sm">플랜을 추가하면 타임라인에 표시됩니다</p>
            </div>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex border-b hover:bg-gray-50">
              {/* 행 라벨 */}
              <div className="w-48 flex-shrink-0 px-3 py-3 border-r bg-white">
                <div className="text-sm font-medium truncate">{row.label}</div>
                <div className="text-xs text-gray-500">
                  {row.plans.length}개 플랜
                </div>
              </div>

              {/* 타임라인 영역 */}
              <div className="flex-1 overflow-x-auto">
                <div
                  className="relative h-full min-h-[60px]"
                  style={{ width: dates.length * DAY_WIDTH }}
                >
                  {/* 드롭 가능한 날짜 열 (각 날짜가 드롭 타겟) */}
                  {dates.map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isExclusion = !!exclusionsByDate[dateStr];
                    const dayOffset = differenceInDays(
                      date,
                      parseISO(dateRange.start)
                    );

                    return (
                      <DroppableGanttDateColumn
                        key={`drop-${dateStr}`}
                        dateStr={dateStr}
                        dayOffset={dayOffset}
                        isExclusion={isExclusion}
                      />
                    );
                  })}

                  {/* 드래그 가능한 플랜 막대 */}
                  {row.plans.map((plan, index) => {
                    const barStyle = getPlanBarStyle(plan);
                    if (!barStyle) return null;

                    return (
                      <DraggableGanttPlanBar
                        key={plan.id}
                        plan={plan}
                        style={{
                          ...barStyle,
                          top: 8 + index * 28,
                        }}
                        onClick={onPlanClick}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-gray-50 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>완료</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>진행 중</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>대기</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-200" />
          <span>제외일</span>
        </div>
      </div>
    </div>
  );
}
