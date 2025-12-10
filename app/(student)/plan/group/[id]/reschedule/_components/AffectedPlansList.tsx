/**
 * 영향받는 플랜 목록 컴포넌트
 * 
 * 재조정으로 영향받는 플랜 목록을 표시합니다.
 */

"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReschedulePreviewResult } from "@/app/(student)/actions/plan-groups/reschedule";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";

type AffectedPlansListProps = {
  preview: ReschedulePreviewResult;
  adjustments: AdjustmentInput[];
  dateRange?: { from: string; to: string } | null;
};

type PlanGroupByDate = {
  date: string;
  beforeCount: number;
  afterCount: number;
  change: number;
};

export function AffectedPlansList({
  preview,
  adjustments,
  dateRange,
}: AffectedPlansListProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"date" | "change">("date");
  const [filter, setFilter] = useState<"all" | "increase" | "decrease">("all");

  // 날짜별 그룹화
  const plansByDate = useMemo(() => {
    const dateMap = new Map<string, PlanGroupByDate>();

    // 영향받는 날짜별로 데이터 초기화
    preview.affected_dates.forEach((date) => {
      if (dateRange && (date < dateRange.from || date > dateRange.to)) {
        return; // 날짜 범위 필터링
      }

      const avgPlansPerDate = preview.affected_dates.length > 0
        ? Math.round(preview.plans_before_count / preview.affected_dates.length)
        : 0;
      const newAvgPlansPerDate = preview.affected_dates.length > 0
        ? Math.round(preview.plans_after_count / preview.affected_dates.length)
        : 0;

      dateMap.set(date, {
        date,
        beforeCount: avgPlansPerDate,
        afterCount: newAvgPlansPerDate,
        change: newAvgPlansPerDate - avgPlansPerDate,
      });
    });

    return Array.from(dateMap.values());
  }, [preview, dateRange]);

  // 정렬 및 필터링
  const filteredAndSorted = useMemo(() => {
    let filtered = plansByDate;

    // 필터링
    if (filter === "increase") {
      filtered = filtered.filter((item) => item.change > 0);
    } else if (filter === "decrease") {
      filtered = filtered.filter((item) => item.change < 0);
    }

    // 정렬
    if (sortBy === "date") {
      filtered.sort((a, b) => a.date.localeCompare(b.date));
    } else {
      filtered.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    }

    return filtered;
  }, [plansByDate, sortBy, filter]);

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (filteredAndSorted.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          영향받는 플랜이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">영향받는 플랜 목록</h3>
        <div className="flex items-center gap-3">
          {/* 필터 */}
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "all" | "increase" | "decrease")
            }
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="increase">증가</option>
            <option value="decrease">감소</option>
          </select>

          {/* 정렬 */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "change")}
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">날짜순</option>
            <option value="change">변화순</option>
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {filteredAndSorted.map((item) => {
          const isExpanded = expandedDates.has(item.date);
          const weekday = ["일", "월", "화", "수", "목", "금", "토"][
            new Date(item.date).getDay()
          ];

          return (
            <div
              key={item.date}
              className="rounded-lg border border-gray-200 bg-white transition hover:border-gray-300 hover:shadow-sm"
            >
              <button
                type="button"
                onClick={() => toggleDate(item.date)}
                className="w-full px-4 py-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900">
                        {format(new Date(item.date), "yyyy년 M월 d일")} ({weekday})
                      </div>
                      <div className="mt-1 flex items-center gap-4 text-xs text-gray-600">
                        <span>
                          기존: {item.beforeCount}개
                        </span>
                        <span className="text-blue-600">
                          변경 후: {item.afterCount}개
                        </span>
                        <span
                          className={
                            item.change >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {item.change >= 0 ? "+" : ""}
                          {item.change}개
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                  <div className="flex flex-col gap-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>기존 플랜 수:</span>
                      <span className="font-medium text-gray-900">
                        {item.beforeCount}개
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>변경 후 플랜 수:</span>
                      <span className="font-medium text-blue-600">
                        {item.afterCount}개
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>변화:</span>
                      <span
                        className={`font-medium ${
                          item.change >= 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {item.change >= 0 ? "+" : ""}
                        {item.change}개
                      </span>
                    </div>
                    {/* TODO: 실제 플랜 목록이 있으면 여기에 상세 정보 표시 */}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 요약 */}
      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">총 영향받는 날짜:</span>
          <span className="font-medium text-gray-900">
            {filteredAndSorted.length}일
          </span>
        </div>
      </div>
    </div>
  );
}

