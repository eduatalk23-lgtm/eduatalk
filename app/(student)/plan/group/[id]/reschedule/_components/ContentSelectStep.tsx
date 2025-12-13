/**
 * Step 1: 콘텐츠 선택 컴포넌트
 *
 * 재조정 대상 콘텐츠를 선택하고 날짜 범위를 선택합니다.
 */

"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { isReschedulable, isCompletedPlan } from "@/lib/utils/planStatusUtils";
import type { PlanContent, PlanGroup } from "@/lib/types/plan";
import { DateRangeSelector } from "./DateRangeSelector";
import { SmartDateRangeSuggestions } from "./SmartDateRangeSuggestions";
import { getTodayDateString, getNextDayString, isDateBefore } from "@/lib/reschedule/periodCalculator";

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
    rescheduleDateRange: DateRange | null,
    includeToday: boolean
  ) => void;
  initialDateRange?: { from: string; to: string } | null;
};

export function ContentSelectStep({
  group,
  contents,
  existingPlans,
  onComplete,
  initialDateRange,
}: ContentSelectStepProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleMode, setRescheduleMode] = useState<"full" | "range">(
    initialDateRange ? "range" : "full"
  );
  const [rescheduleDateRange, setRescheduleDateRange] = useState<DateRange>(
    initialDateRange
      ? {
          from: initialDateRange.from,
          to: initialDateRange.to,
        }
      : {
          from: null,
          to: null,
        }
  );
  const [dateRangeExpanded, setDateRangeExpanded] = useState(false);
  const [includeToday, setIncludeToday] = useState(false);

  // 클라이언트에서 간단히 계산 (서버 로직과 동일하게)
  const calculateAdjustedRange = (
    dateRange: DateRange,
    today: string,
    groupEnd: string,
    includeTodayValue: boolean
  ): DateRange | null => {
    if (!dateRange.from || !dateRange.to) {
      return null;
    }
    const startDate = includeTodayValue ? today : getNextDayString(today);
    const adjustedStart = isDateBefore(dateRange.from, startDate) 
      ? startDate 
      : dateRange.from;
    const adjustedEnd = isDateBefore(groupEnd, dateRange.to) 
      ? groupEnd 
      : dateRange.to;
    return { from: adjustedStart, to: adjustedEnd };
  };

  // 콘텐츠별 플랜 상태 계산 및 영향 범위 계산
  const contentStatusMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        reschedulable: number;
        completed: number;
        status: "available" | "partial" | "unavailable";
        affectedDates: string[];
        affectedDaysCount: number;
        unavailableReason?: string;
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
      );

      const completed = plans.filter((p) =>
        isCompletedPlan({
          status: (p.status as any) || "pending",
        })
      ).length;

      let status: "available" | "partial" | "unavailable" = "unavailable";
      let unavailableReason: string | undefined;

      if (reschedulable.length > 0) {
        status =
          reschedulable.length === plans.length ? "available" : "partial";
        // 영향받는 날짜 계산
        const affectedDates = new Set<string>();
        reschedulable.forEach((plan) => {
          affectedDates.add(plan.plan_date);
        });
        map.set(content.id || content.content_id, {
          total: plans.length,
          reschedulable: reschedulable.length,
          completed,
          status,
          affectedDates: Array.from(affectedDates).sort(),
          affectedDaysCount: affectedDates.size,
        });
      } else {
        // 재조정 불가 이유 설정
        if (plans.length === 0) {
          unavailableReason = "플랜이 없습니다";
        } else if (completed === plans.length) {
          unavailableReason = "모든 플랜이 완료되어 재조정할 수 없습니다";
        } else {
          unavailableReason = "재조정 가능한 플랜이 없습니다";
        }
        map.set(content.id || content.content_id, {
          total: plans.length,
          reschedulable: 0,
          completed,
          status,
          affectedDates: [],
          affectedDaysCount: 0,
          unavailableReason,
        });
      }
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
      if (!rescheduleDateRange.from || !rescheduleDateRange.to) {
        alert("날짜 범위를 선택해주세요.");
        return;
      }
    }

    onComplete(selectedIds, rescheduleMode === "range" ? rescheduleDateRange : null, includeToday);
  };

  const availableCount = Array.from(contentStatusMap.values()).filter(
    (s) => s.status !== "unavailable"
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold text-gray-900">콘텐츠 선택</h2>
        <p className="text-sm text-gray-600">
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
                  aria-label={`${
                    content.content_type === "book"
                      ? "교재"
                      : content.content_type === "lecture"
                      ? "강의"
                      : "커스텀"
                  } 콘텐츠 선택`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(contentId)}
                    disabled={isDisabled}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    aria-label={`${
                      content.content_type === "book"
                        ? "교재"
                        : content.content_type === "lecture"
                        ? "강의"
                        : "커스텀"
                    } 콘텐츠 ${isSelected ? "선택 해제" : "선택"}`}
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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
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
                            총 {status.total}개 / 재조정 가능{" "}
                            {status.reschedulable}개 / 완료 {status.completed}개
                          </span>
                        </div>
                        {status.status === "unavailable" &&
                          status.unavailableReason && (
                            <div className="text-xs text-red-600">
                              ⚠️ {status.unavailableReason}
                            </div>
                          )}
                        {isSelected && status.affectedDaysCount > 0 && (
                          <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs">
                            <div className="font-medium text-blue-900">
                              💡 영향 범위 미리보기
                            </div>
                            <div className="text-blue-700">
                              이 콘텐츠는 {status.affectedDaysCount}일간의
                              플랜에 영향을 줍니다
                            </div>
                            {status.affectedDates.length > 0 &&
                              status.affectedDates.length <= 5 && (
                                <div className="text-blue-600">
                                  영향받는 날짜:{" "}
                                  {status.affectedDates.join(", ")}
                                </div>
                              )}
                            {status.affectedDates.length > 5 && (
                              <div className="text-blue-600">
                                영향받는 날짜:{" "}
                                {status.affectedDates.slice(0, 3).join(", ")} 외{" "}
                                {status.affectedDates.length - 3}일
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* 선택한 날짜 범위 요약 (날짜 범위 모드일 때만 표시) */}
          {rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
            <div className="sticky top-0 z-10 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-blue-900">
                    선택한 날짜 범위
                  </div>
                  <div className="mt-1 text-sm text-blue-700">
                    {rescheduleDateRange.from} ~ {rescheduleDateRange.to}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleDateRange({ from: null, to: null });
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
                >
                  초기화
                </button>
              </div>
            </div>
          )}

          {/* 재조정할 플랜 범위 선택 */}
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">
              재조정할 플랜 범위 선택
            </h3>
            <div className="flex flex-col gap-3">
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
                aria-label="전체 재생성 모드 선택"
              >
                <input
                  type="radio"
                  name="rescheduleMode"
                  value="full"
                  checked={rescheduleMode === "full"}
                  onChange={() => {
                    setRescheduleMode("full");
                    setDateRangeExpanded(false);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  aria-label="전체 재생성"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">전체 기간</div>
                  <div className="text-xs text-gray-600">
                    모든 기간의 플랜을 재조정합니다 (완료된 플랜 제외)
                  </div>
                </div>
              </label>
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
                aria-label="날짜 범위 선택 모드 선택"
              >
                <input
                  type="radio"
                  name="rescheduleMode"
                  value="range"
                  checked={rescheduleMode === "range"}
                  onChange={() => {
                    setRescheduleMode("range");
                    setDateRangeExpanded(true);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                  aria-label="날짜 범위 선택"
                />
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    날짜 범위 선택
                  </div>
                  <div className="text-xs text-gray-600">
                    어떤 날짜의 기존 플랜을 재조정할지 선택합니다 (과거 날짜 포함 가능)
                  </div>
                </div>
              </label>
            </div>

            {/* 날짜 범위 선택 UI (접이식 패널) */}
            {rescheduleMode === "range" && (
              <div>
                <button
                  type="button"
                  onClick={() => setDateRangeExpanded(!dateRangeExpanded)}
                  className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3 transition hover:bg-gray-100"
                  aria-expanded={dateRangeExpanded}
                  aria-controls="date-range-panel"
                >
                  <span className="text-sm font-medium text-gray-900">
                    날짜 범위 선택
                  </span>
                  {dateRangeExpanded ? (
                    <ChevronUp
                      className="h-5 w-5 text-gray-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronDown
                      className="h-5 w-5 text-gray-600"
                      aria-hidden="true"
                    />
                  )}
                </button>

                {dateRangeExpanded && (
                  <div
                    id="date-range-panel"
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
                    role="region"
                    aria-label="날짜 범위 선택 패널"
                  >
                    {/* 스마트 추천 */}
                    {selectedIds.size > 0 && (
                      <SmartDateRangeSuggestions
                        group={group}
                        contents={contents}
                        selectedContentIds={selectedIds}
                        existingPlans={existingPlans}
                        onSelectRange={(range) => {
                          setRescheduleDateRange(range);
                        }}
                      />
                    )}

                    {/* 날짜 범위 선택 캘린더 */}
                    <DateRangeSelector
                      groupPeriodStart={group.period_start}
                      groupPeriodEnd={group.period_end}
                      existingPlans={existingPlans}
                      onRangeChange={setRescheduleDateRange}
                      initialRange={rescheduleDateRange}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 자동 조정 안내 */}
            {rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
              <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600">💡</span>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="text-sm font-medium text-blue-900">
                      자동 조정 안내
                    </div>
                    <div className="text-xs text-blue-700">
                      {(() => {
                        const today = getTodayDateString();
                        const tomorrow = getNextDayString(today);
                        const isPastDate = isDateBefore(rescheduleDateRange.from!, tomorrow);
                        
                        if (isPastDate) {
                          return `과거 날짜를 선택하셨습니다. 재조정 플랜은 자동으로 ${tomorrow}부터 시작됩니다.`;
                        }
                        return "선택한 날짜 범위에 따라 재조정이 진행됩니다.";
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 실제 조정된 범위 미리보기 */}
            {rescheduleMode === "range" && rescheduleDateRange.from && rescheduleDateRange.to && (
              <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs text-gray-600">
                  <div className="font-medium text-gray-700">실제 재조정 범위</div>
                  <div className="text-gray-600">
                    {(() => {
                      const today = getTodayDateString();
                      const adjustedRange = calculateAdjustedRange(
                        rescheduleDateRange,
                        today,
                        group.period_end,
                        includeToday
                      );
                      if (adjustedRange && adjustedRange.from && adjustedRange.to) {
                        return `${adjustedRange.from} ~ ${adjustedRange.to}`;
                      }
                      return "계산 중...";
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* 오늘 날짜 포함 옵션 */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={includeToday}
                  onChange={(e) => setIncludeToday(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  aria-label="오늘 날짜 포함"
                />
                <div className="flex flex-1 flex-col gap-1">
                  <div className="font-medium text-gray-900">오늘 날짜 포함</div>
                  <div className="text-xs text-gray-600">
                    오늘 날짜의 플랜도 재조정 대상에 포함됩니다. 이미 진행 중이거나 완료된 플랜은 제외됩니다.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* 선택한 콘텐츠 요약 카드 */}
          {selectedIds.size > 0 && (
            <div className="sticky bottom-0 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-blue-900">
                    선택한 콘텐츠 요약
                  </div>
                  <div className="mt-1 text-sm text-blue-700">
                    {selectedIds.size}개의 콘텐츠가 선택되었습니다
                  </div>
                  <div className="mt-1 text-xs text-blue-600">
                    총 영향받는 날짜:{" "}
                    {(() => {
                      const allDates = new Set<string>();
                      selectedIds.forEach((id) => {
                        const status = contentStatusMap.get(id);
                        if (status) {
                          status.affectedDates.forEach((date) =>
                            allDates.add(date)
                          );
                        }
                      });
                      return allDates.size;
                    })()}
                    일
                  </div>
                </div>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                >
                  모두 해제
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={handleNext}
              disabled={
                selectedIds.size === 0 ||
                (rescheduleMode === "range" &&
                  (!rescheduleDateRange.from || !rescheduleDateRange.to))
              }
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500"
              aria-label={`다음 단계로 이동 (${selectedIds.size}개 콘텐츠 선택됨)`}
            >
              다음 ({selectedIds.size}개 선택됨)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
