/**
 * 스마트 날짜 범위 추천 컴포넌트
 * 
 * 재조정 대상 콘텐츠의 영향받는 날짜를 자동으로 감지하고 추천 날짜 범위를 제공합니다.
 */

"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import { generateDateRangeSuggestions, type SuggestedDateRange } from "@/lib/reschedule/dateRangeAnalyzer";
import type { PlanGroup, PlanContent } from "@/lib/types/plan";

type SmartDateRangeSuggestionsProps = {
  group: PlanGroup;
  contents: PlanContent[];
  selectedContentIds: Set<string>;
  existingPlans: Array<{
    id: string;
    plan_date: string;
    status: string | null;
    is_active: boolean | null;
    content_id: string;
  }>;
  onSelectRange: (range: { from: string; to: string }) => void;
};

export function SmartDateRangeSuggestions({
  group,
  contents,
  selectedContentIds,
  existingPlans,
  onSelectRange,
}: SmartDateRangeSuggestionsProps) {
  // 추천 날짜 범위 생성
  const suggestions = useMemo(() => {
    if (selectedContentIds.size === 0) {
      return [];
    }

    return generateDateRangeSuggestions(
      selectedContentIds,
      contents,
      existingPlans.map((p) => ({
        id: p.id,
        plan_date: p.plan_date,
        status: p.status,
        is_active: p.is_active,
        content_id: p.content_id,
      })),
      group.period_start,
      group.period_end
    );
  }, [selectedContentIds, contents, existingPlans, group.period_start, group.period_end]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-blue-900">
          💡 추천 날짜 범위
        </h4>
        <p className="mt-1 text-xs text-blue-700">
          선택한 콘텐츠의 영향받는 날짜를 분석하여 추천합니다.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <button
            key={`${suggestion.range.from}-${suggestion.range.to}-${index}`}
            type="button"
            onClick={() => onSelectRange(suggestion.range)}
            className="flex items-center justify-between rounded-lg border border-blue-300 bg-white p-3 text-left transition hover:bg-blue-50 hover:shadow-sm"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {suggestion.range.from === suggestion.range.to
                    ? format(new Date(suggestion.range.from), "yyyy년 M월 d일")
                    : `${format(new Date(suggestion.range.from), "M월 d일")} ~ ${format(new Date(suggestion.range.to), "M월 d일")}`}
                </span>
                {index === 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    추천
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">{suggestion.reason}</p>
              <p className="mt-1 text-xs text-gray-500">
                영향받는 플랜: {suggestion.affectedPlansCount}개
              </p>
            </div>
            <div className="ml-3">
              <svg
                className="h-5 w-5 text-blue-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {suggestions.length > 3 && (
        <p className="mt-2 text-xs text-blue-600">
          + {suggestions.length - 3}개의 추가 추천이 있습니다
        </p>
      )}
    </div>
  );
}

