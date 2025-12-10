/**
 * Step 1: 콘텐츠 선택 컴포넌트
 * 
 * 재조정 대상 콘텐츠를 선택하고 날짜 범위를 선택합니다.
 */

"use client";

import { useState, useMemo } from "react";
import { isReschedulable, isCompletedPlan } from "@/lib/utils/planStatusUtils";
import type { PlanContent, PlanGroup } from "@/lib/types/plan";
import { DateRangeSelector } from "./DateRangeSelector";
import { SmartDateRangeSuggestions } from "./SmartDateRangeSuggestions";

type DateRange = {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
};

type ContentSelectStepProps = {
  group: PlanGroup;
  contents: PlanContent[];
  existingPlans: Array<{
    id: string;
    status: string | null;
    is_active: boolean | null;
    content_id: string;
    plan_date: string; // YYYY-MM-DD
  }>;
  onComplete: (
    selectedContentIds: Set<string>,
    dateRange: DateRange | null
  ) => void;
};

export function ContentSelectStep({
  group,
  contents,
  existingPlans,
  onComplete,
}: ContentSelectStepProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleMode, setRescheduleMode] = useState<"full" | "range">("full");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: null,
    to: null,
  });

  // 콘텐츠별 플랜 상태 계산
  const contentStatusMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        reschedulable: number;
        completed: number;
        status: "available" | "partial" | "unavailable";
      }
    >();

    contents.forEach((content) => {
      const plans = existingPlans.filter(
        (p) => p.content_id === content.content_id
      );

      const reschedulable = plans.filter((p) =>
        isReschedulable({
          status: (p.status as any) || "pending",
          is_active: p.is_active ?? true,
        })
      ).length;

      const completed = plans.filter((p) =>
        isCompletedPlan({
          status: (p.status as any) || "pending",
        })
      ).length;

      let status: "available" | "partial" | "unavailable" = "unavailable";
      if (reschedulable > 0) {
        status = reschedulable === plans.length ? "available" : "partial";
      }

      map.set(content.id || content.content_id, {
        total: plans.length,
        reschedulable,
        completed,
        status,
      });
    });

    return map;
  }, [contents, existingPlans]);

  const handleToggle = (contentId: string) => {
    const status = contentStatusMap.get(contentId);
    if (!status || status.status === "unavailable") {
      return; // 선택 불가
    }

    const newSet = new Set(selectedIds);
    if (newSet.has(contentId)) {
      newSet.delete(contentId);
    } else {
      newSet.add(contentId);
    }
    setSelectedIds(newSet);
  };

  const handleNext = () => {
    if (selectedIds.size === 0) {
      alert("최소 1개 이상의 콘텐츠를 선택해주세요.");
      return;
    }

    if (rescheduleMode === "range") {
      if (!dateRange.from || !dateRange.to) {
        alert("날짜 범위를 선택해주세요.");
        return;
      }
    }

    onComplete(
      selectedIds,
      rescheduleMode === "range" ? dateRange : null
    );
  };

  const availableCount = Array.from(contentStatusMap.values()).filter(
    (s) => s.status !== "unavailable"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">콘텐츠 선택</h2>
        <p className="mt-1 text-sm text-gray-600">
          재조정할 콘텐츠를 선택해주세요. 완료된 플랜은 자동으로 제외됩니다.
        </p>
      </div>

      {availableCount === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm text-gray-600">
            재조정 가능한 콘텐츠가 없습니다.
            <br />
            모든 플랜이 완료되었거나 이미 비활성화되었습니다.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {contents.map((content) => {
              const contentId = content.id || content.content_id;
              const status = contentStatusMap.get(contentId);
              const isSelected = selectedIds.has(contentId);
              const isDisabled = !status || status.status === "unavailable";

              return (
                <label
                  key={contentId}
                  className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : isDisabled
                      ? "border-gray-200 bg-gray-50 opacity-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(contentId)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {content.content_type === "book"
                          ? "📚 교재"
                          : content.content_type === "lecture"
                          ? "🎥 강의"
                          : "📝 커스텀"}
                      </span>
                      <span className="text-sm text-gray-600">
                        {content.start_range} ~ {content.end_range}
                      </span>
                    </div>
                    {status && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span
                          className={`rounded px-2 py-0.5 ${
                            status.status === "available"
                              ? "bg-green-100 text-green-700"
                              : status.status === "partial"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {status.status === "available"
                            ? "재조정 가능"
                            : status.status === "partial"
                            ? "부분 재조정"
                            : "재조정 불가"}
                        </span>
                        <span>
                          총 {status.total}개 / 재조정 가능 {status.reschedulable}
                          개 / 완료 {status.completed}개
                        </span>
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* 재생성 범위 선택 */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              재생성 범위 선택
            </h3>
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50">
                <input
                  type="radio"
                  name="rescheduleMode"
                  value="full"
                  checked={rescheduleMode === "full"}
                  onChange={() => setRescheduleMode("full")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">전체 재생성</div>
                  <div className="text-xs text-gray-600">
                    모든 플랜을 재생성합니다 (완료된 플랜 제외)
                  </div>
                </div>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50">
                <input
                  type="radio"
                  name="rescheduleMode"
                  value="range"
                  checked={rescheduleMode === "range"}
                  onChange={() => setRescheduleMode("range")}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">날짜 범위 선택</div>
                  <div className="text-xs text-gray-600">
                    특정 날짜 범위의 플랜만 재생성합니다
                  </div>
                </div>
              </label>
            </div>

            {/* 날짜 범위 선택 UI */}
            {rescheduleMode === "range" && (
              <div className="mt-4 flex flex-col gap-4">
                {/* 스마트 추천 */}
                {selectedIds.size > 0 && (
                  <SmartDateRangeSuggestions
                    group={group}
                    contents={contents}
                    selectedContentIds={selectedIds}
                    existingPlans={existingPlans}
                    onSelectRange={(range) => {
                      setDateRange(range);
                    }}
                  />
                )}

                {/* 날짜 범위 선택 캘린더 */}
                <DateRangeSelector
                  groupPeriodStart={group.period_start}
                  groupPeriodEnd={group.period_end}
                  existingPlans={existingPlans}
                  onRangeChange={setDateRange}
                  initialRange={dateRange}
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={handleNext}
              disabled={
                selectedIds.size === 0 ||
                (rescheduleMode === "range" && (!dateRange.from || !dateRange.to))
              }
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
            >
              다음 ({selectedIds.size}개 선택됨)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

