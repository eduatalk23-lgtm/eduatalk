/**
 * 변경 전/후 비교 컴포넌트
 * 
 * 재조정 전후의 플랜을 나란히 비교하여 표시합니다.
 */

"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import type { ReschedulePreviewResult } from "@/app/(student)/actions/plan-groups/reschedule";
import type { AdjustmentInput } from "@/lib/reschedule/scheduleEngine";

type BeforeAfterComparisonProps = {
  preview: ReschedulePreviewResult;
  adjustments: AdjustmentInput[];
  dateRange?: { from: string; to: string } | null;
};

type ComparisonItem = {
  date: string;
  before: {
    count: number;
    totalHours: number;
  };
  after: {
    count: number;
    totalHours: number;
  };
  change: {
    count: number;
    hours: number;
  };
};

export function BeforeAfterComparison({
  preview,
  adjustments,
  dateRange,
}: BeforeAfterComparisonProps) {
  // 날짜별 비교 데이터 생성 (실제 플랜 데이터 사용)
  const comparisonData = useMemo(() => {
    const dateMap = new Map<string, ComparisonItem>();

    // 모든 날짜 수집 (기존 플랜과 새 플랜 모두)
    const allDates = new Set<string>();
    preview.plans_before.forEach((plan) => allDates.add(plan.plan_date));
    preview.plans_after.forEach((plan) => allDates.add(plan.plan_date));

    // 날짜별로 데이터 초기화
    allDates.forEach((date) => {
      dateMap.set(date, {
        date,
        before: {
          count: 0,
          totalHours: 0,
        },
        after: {
          count: 0,
          totalHours: 0,
        },
        change: {
          count: 0,
          hours: 0,
        },
      });
    });

    // 기존 플랜 데이터로 날짜별 통계 계산
    preview.plans_before.forEach((plan) => {
      const item = dateMap.get(plan.plan_date);
      if (item) {
        item.before.count++;
        if (plan.start_time && plan.end_time) {
          const [startHour, startMin] = plan.start_time.split(":").map(Number);
          const [endHour, endMin] = plan.end_time.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          item.before.totalHours += (endMinutes - startMinutes) / 60;
        }
      }
    });

    // 새 플랜 데이터로 날짜별 통계 계산
    preview.plans_after.forEach((plan) => {
      const item = dateMap.get(plan.plan_date);
      if (item) {
        item.after.count++;
        if (plan.start_time && plan.end_time) {
          const [startHour, startMin] = plan.start_time.split(":").map(Number);
          const [endHour, endMin] = plan.end_time.split(":").map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          item.after.totalHours += (endMinutes - startMinutes) / 60;
        }
      }
    });

    // 변화 계산 및 시간 반올림
    dateMap.forEach((item) => {
      item.before.totalHours = Math.round(item.before.totalHours * 10) / 10;
      item.after.totalHours = Math.round(item.after.totalHours * 10) / 10;
      item.change.count = item.after.count - item.before.count;
      item.change.hours = Math.round((item.after.totalHours - item.before.totalHours) * 10) / 10;
    });

    return Array.from(dateMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }, [preview]);

  // 날짜 범위 필터링
  const filteredData = useMemo(() => {
    if (!dateRange) {
      return comparisonData;
    }
    return comparisonData.filter(
      (item) =>
        item.date >= dateRange.from && item.date <= dateRange.to
    );
  }, [comparisonData, dateRange]);

  if (filteredData.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-600">
          비교할 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="font-semibold text-gray-900">변경 전/후 비교</h3>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs text-gray-600">기존 플랜</p>
          <p className="text-2xl font-bold text-gray-900">
            {preview.plans_before_count}개
          </p>
          <p className="text-sm text-gray-600">
            {preview.estimated_hours}시간
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs text-blue-700">새 플랜</p>
          <p className="text-2xl font-bold text-blue-600">
            {preview.plans_after_count}개
          </p>
          <p className="text-sm text-blue-700">
            {preview.estimated_hours}시간
          </p>
        </div>
        <div
          className={`flex flex-col gap-1 rounded-lg border p-4 ${
            preview.plans_after_count - preview.plans_before_count >= 0
              ? "border-green-200 bg-green-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <p className="text-xs text-gray-600">변화</p>
          <p
            className={`text-2xl font-bold ${
              preview.plans_after_count - preview.plans_before_count >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {preview.plans_after_count - preview.plans_before_count >= 0
              ? "+"
              : ""}
            {preview.plans_after_count - preview.plans_before_count}개
          </p>
          <p className="text-sm text-gray-600">변화 없음</p>
        </div>
      </div>

      {/* 날짜별 상세 비교 */}
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-3 text-left font-semibold text-gray-900 sm:px-4">
                날짜
              </th>
              <th className="px-2 py-3 text-center font-semibold text-gray-900 sm:px-4">
                기존
              </th>
              <th className="px-2 py-3 text-center font-semibold text-gray-900 sm:px-4">
                변경 후
              </th>
              <th className="px-2 py-3 text-center font-semibold text-gray-900 sm:px-4">
                변화
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((item) => (
              <tr
                key={item.date}
                className="border-b border-gray-100 transition hover:bg-gray-50"
              >
                <td className="px-2 py-3 font-medium text-gray-900 sm:px-4">
                  <div className="text-xs sm:text-sm">
                    {format(new Date(item.date), "yyyy년 M월 d일 (E)", {
                      locale: undefined,
                    }).replace(
                      /\([^)]*\)/,
                      `(${["일", "월", "화", "수", "목", "금", "토"][new Date(item.date).getDay()]})`
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 text-center text-gray-700 sm:px-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs sm:text-sm">{item.before.count}개</span>
                    <span className="text-xs text-gray-500">
                      {item.before.totalHours}시간
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center text-blue-700 sm:px-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-xs sm:text-sm">{item.after.count}개</span>
                    <span className="text-xs text-blue-600">
                      {item.after.totalHours}시간
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3 text-center sm:px-4">
                  <div className="flex flex-col">
                    <span
                      className={`font-medium ${
                        item.change.count >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {item.change.count >= 0 ? "+" : ""}
                      {item.change.count}개
                    </span>
                    <span className="text-xs text-gray-500">
                      {item.change.hours >= 0 ? "+" : ""}
                      {item.change.hours}시간
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 조정 내역 요약 */}
      {adjustments.length > 0 && (
        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 text-sm font-semibold text-gray-900">
            조정 내역
          </h4>
          <div className="flex flex-col gap-1 text-xs text-gray-600">
            {adjustments.map((adj, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="font-medium">
                  {adj.change_type === "range"
                    ? "범위 수정"
                    : adj.change_type === "replace"
                    ? "콘텐츠 교체"
                    : "전체 재생성"}
                </span>
                <span className="text-gray-500">
                  {adj.before.range.start}~{adj.before.range.end} →{" "}
                  {adj.after.range.start}~{adj.after.range.end}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

