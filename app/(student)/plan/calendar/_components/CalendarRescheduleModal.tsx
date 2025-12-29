/**
 * 캘린더 기반 재조정 모달
 *
 * 캘린더에서 직접 날짜 범위를 선택하고 플랜을 재조정합니다.
 * 기존 재조정 위저드의 간소화된 버전입니다.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Calendar,
  ArrowRight,
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { format, parseISO, isSameDay, isAfter, isBefore, eachDayOfInterval } from "date-fns";
import { ko } from "date-fns/locale";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import type { PlanWithContent } from "../_types/plan";
import { isCompletedPlan } from "@/lib/utils/planStatusUtils";
import type { PlanStatus } from "@/lib/types/plan";

type DateRange = {
  from: string | null; // YYYY-MM-DD
  to: string | null; // YYYY-MM-DD
};

type CalendarRescheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  plans: PlanWithContent[];
  initialDateRange?: DateRange;
  groupId?: string;
  onRescheduleComplete?: () => void;
};

type Step = "select-range" | "select-plans" | "preview" | "confirm";

export function CalendarRescheduleModal({
  isOpen,
  onClose,
  plans,
  initialDateRange,
  groupId,
  onRescheduleComplete,
}: CalendarRescheduleModalProps) {
  const router = useRouter();
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<Step>("select-range");
  const [dateRange, setDateRange] = useState<DateRange>(
    initialDateRange || { from: null, to: null }
  );
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [targetDateRange, setTargetDateRange] = useState<DateRange>({
    from: null,
    to: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);

  // 선택 가능한 플랜 필터링 (선택 범위 내, 완료되지 않은 플랜)
  const selectablePlans = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return [];

    const fromDate = parseISO(dateRange.from);
    const toDate = parseISO(dateRange.to);

    return plans.filter((plan) => {
      const planDate = parseISO(plan.plan_date);
      const inRange =
        (isAfter(planDate, fromDate) || isSameDay(planDate, fromDate)) &&
        (isBefore(planDate, toDate) || isSameDay(planDate, toDate));

      // 완료된 플랜은 제외
      const isCompleted = isCompletedPlan({ status: plan.status as PlanStatus });

      return inRange && !isCompleted;
    });
  }, [plans, dateRange]);

  // 완료된 플랜 수
  const completedPlansCount = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 0;

    const fromDate = parseISO(dateRange.from);
    const toDate = parseISO(dateRange.to);

    return plans.filter((plan) => {
      const planDate = parseISO(plan.plan_date);
      const inRange =
        (isAfter(planDate, fromDate) || isSameDay(planDate, fromDate)) &&
        (isBefore(planDate, toDate) || isSameDay(planDate, toDate));

      const isCompleted = isCompletedPlan({ status: plan.status as PlanStatus });

      return inRange && isCompleted;
    }).length;
  }, [plans, dateRange]);

  // 날짜 선택 핸들러
  const handleDateClick = useCallback(
    (dateStr: string) => {
      if (selectingStart || !dateRange.from) {
        setDateRange({ from: dateStr, to: null });
        setSelectingStart(false);
      } else {
        const fromDate = parseISO(dateRange.from);
        const clickedDate = parseISO(dateStr);

        if (isBefore(clickedDate, fromDate)) {
          setDateRange({ from: dateStr, to: null });
          setSelectingStart(false);
        } else {
          setDateRange({ from: dateRange.from, to: dateStr });
          setSelectingStart(true);
        }
      }
    },
    [dateRange.from, selectingStart]
  );

  // 플랜 선택 토글
  const togglePlanSelection = useCallback((planId: string) => {
    setSelectedPlanIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(planId)) {
        newSet.delete(planId);
      } else {
        newSet.add(planId);
      }
      return newSet;
    });
  }, []);

  // 전체 선택/해제
  const toggleAllPlans = useCallback(() => {
    if (selectedPlanIds.size === selectablePlans.length) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(selectablePlans.map((p) => p.id)));
    }
  }, [selectedPlanIds.size, selectablePlans]);

  // 단계 이동
  const goToNextStep = useCallback(() => {
    switch (currentStep) {
      case "select-range":
        if (dateRange.from && dateRange.to) {
          // 기본으로 모든 플랜 선택
          setSelectedPlanIds(new Set(selectablePlans.map((p) => p.id)));
          setCurrentStep("select-plans");
        }
        break;
      case "select-plans":
        if (selectedPlanIds.size > 0) {
          setCurrentStep("preview");
        }
        break;
      case "preview":
        setCurrentStep("confirm");
        break;
    }
  }, [currentStep, dateRange, selectablePlans, selectedPlanIds.size]);

  const goToPrevStep = useCallback(() => {
    switch (currentStep) {
      case "select-plans":
        setCurrentStep("select-range");
        break;
      case "preview":
        setCurrentStep("select-plans");
        break;
      case "confirm":
        setCurrentStep("preview");
        break;
    }
  }, [currentStep]);

  // 재조정 실행
  const handleReschedule = useCallback(async () => {
    if (!groupId) {
      // 상세 페이지로 이동하여 전체 위저드 사용
      const planGroupId = selectablePlans.find(
        (p) => selectedPlanIds.has(p.id)
      )?.plan_group_id;
      if (planGroupId) {
        router.push(
          `/plan/group/${planGroupId}/reschedule?from=${dateRange.from}&to=${dateRange.to}`
        );
        onClose();
      }
      return;
    }

    setIsProcessing(true);
    try {
      // 여기서 실제 재조정 API를 호출할 수 있습니다
      // 현재는 상세 재조정 페이지로 이동
      router.push(
        `/plan/group/${groupId}/reschedule?from=${dateRange.from}&to=${dateRange.to}`
      );
      onClose();
      onRescheduleComplete?.();
    } catch (error) {
      toast.showError(
        error instanceof Error ? error.message : "재조정 중 오류가 발생했습니다."
      );
    } finally {
      setIsProcessing(false);
    }
  }, [
    groupId,
    selectablePlans,
    selectedPlanIds,
    dateRange,
    router,
    onClose,
    onRescheduleComplete,
    toast,
  ]);

  // 초기화
  const handleReset = useCallback(() => {
    setDateRange({ from: null, to: null });
    setSelectedPlanIds(new Set());
    setTargetDateRange({ from: null, to: null });
    setCurrentStep("select-range");
    setSelectingStart(true);
  }, []);

  if (!isOpen) return null;

  // 미니 캘린더 렌더링
  const renderMiniCalendar = () => {
    const today = new Date();
    const currentMonth = dateRange.from
      ? parseISO(dateRange.from)
      : today;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const days: (Date | null)[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">
            {format(currentMonth, "yyyy년 M월", { locale: ko })}
          </h4>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded p-1 hover:bg-gray-100"
              onClick={() => {
                const prev = new Date(year, month - 1, 1);
                setDateRange((r) => ({
                  ...r,
                  from: format(prev, "yyyy-MM-dd"),
                }));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded p-1 hover:bg-gray-100"
              onClick={() => {
                const next = new Date(year, month + 1, 1);
                setDateRange((r) => ({
                  ...r,
                  from: format(next, "yyyy-MM-dd"),
                }));
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekdays.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-xs font-medium text-gray-500"
            >
              {day}
            </div>
          ))}
          {days.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="h-8" />;
            }

            const dateStr = format(date, "yyyy-MM-dd");
            const isToday = isSameDay(date, today);
            const isSelected =
              dateRange.from === dateStr || dateRange.to === dateStr;
            const isInRange =
              dateRange.from &&
              dateRange.to &&
              isAfter(date, parseISO(dateRange.from)) &&
              isBefore(date, parseISO(dateRange.to));

            // 해당 날짜의 플랜 수
            const dayPlans = plans.filter((p) => p.plan_date === dateStr);
            const hasPlan = dayPlans.length > 0;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => handleDateClick(dateStr)}
                className={cn(
                  "relative h-8 rounded text-sm font-medium transition",
                  isSelected
                    ? "bg-blue-600 text-white"
                    : isInRange
                    ? "bg-blue-100 text-blue-700"
                    : isToday
                    ? "bg-gray-100 font-bold"
                    : "hover:bg-gray-50",
                  hasPlan && !isSelected && !isInRange && "ring-1 ring-blue-300"
                )}
              >
                {date.getDate()}
                {hasPlan && (
                  <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* 선택된 범위 표시 */}
        {dateRange.from && (
          <div className="mt-4 rounded-lg bg-blue-50 p-3">
            <p className="text-sm font-medium text-blue-900">
              {dateRange.from}
              {dateRange.to ? ` ~ ${dateRange.to}` : " (종료일 선택 중...)"}
            </p>
          </div>
        )}
      </div>
    );
  };

  // 플랜 선택 리스트 렌더링
  const renderPlansList = () => (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {selectedPlanIds.size}/{selectablePlans.length}개 선택됨
        </span>
        <button
          type="button"
          onClick={toggleAllPlans}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {selectedPlanIds.size === selectablePlans.length
            ? "전체 해제"
            : "전체 선택"}
        </button>
      </div>

      {completedPlansCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <span>
            완료된 플랜 {completedPlansCount}개는 재조정에서 제외됩니다.
          </span>
        </div>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {selectablePlans.map((plan) => (
          <label
            key={plan.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition",
              selectedPlanIds.has(plan.id)
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <input
              type="checkbox"
              checked={selectedPlanIds.has(plan.id)}
              onChange={() => togglePlanSelection(plan.id)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {plan.contentTitle || "콘텐츠 없음"}
              </p>
              <p className="text-xs text-gray-500">
                {format(parseISO(plan.plan_date), "M월 d일 (E)", { locale: ko })}
                {plan.start_time && ` ${plan.start_time}`}
              </p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );

  // 미리보기 렌더링
  const renderPreview = () => {
    const selectedPlans = selectablePlans.filter((p) =>
      selectedPlanIds.has(p.id)
    );

    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-2 font-medium text-gray-900">재조정 요약</h4>
          <ul className="space-y-1 text-sm text-gray-600">
            <li>• 선택 범위: {dateRange.from} ~ {dateRange.to}</li>
            <li>• 재조정 대상: {selectedPlans.length}개 플랜</li>
            {completedPlansCount > 0 && (
              <li className="text-amber-600">
                • 제외됨 (완료): {completedPlansCount}개
              </li>
            )}
          </ul>
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto">
          {selectedPlans.map((plan) => (
            <div
              key={plan.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
            >
              <Calendar className="h-4 w-4 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {plan.contentTitle || "콘텐츠 없음"}
                </p>
                <p className="text-xs text-gray-500">
                  {format(parseISO(plan.plan_date), "M월 d일", { locale: ko })}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-blue-600">재조정 예정</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-xl bg-white shadow-xl">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              일정 재조정
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-gray-100"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* 진행 표시 */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="flex items-center justify-center gap-2">
            {(["select-range", "select-plans", "preview"] as Step[]).map(
              (step, index) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                      currentStep === step
                        ? "bg-blue-600 text-white"
                        : index <
                          ["select-range", "select-plans", "preview"].indexOf(
                            currentStep
                          )
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {index <
                    ["select-range", "select-plans", "preview"].indexOf(
                      currentStep
                    ) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      currentStep === step
                        ? "font-medium text-gray-900"
                        : "text-gray-500"
                    )}
                  >
                    {step === "select-range"
                      ? "범위 선택"
                      : step === "select-plans"
                      ? "플랜 선택"
                      : "미리보기"}
                  </span>
                  {index < 2 && (
                    <div className="h-px w-8 bg-gray-200" />
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* 본문 */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
          {currentStep === "select-range" && (
            <div>
              <p className="mb-4 text-sm text-gray-600">
                재조정할 날짜 범위를 선택하세요. 시작일을 먼저 클릭한 후 종료일을
                클릭합니다.
              </p>
              {renderMiniCalendar()}
            </div>
          )}

          {currentStep === "select-plans" && (
            <div>
              <p className="mb-4 text-sm text-gray-600">
                재조정할 플랜을 선택하세요. 완료된 플랜은 자동으로 제외됩니다.
              </p>
              {selectablePlans.length > 0 ? (
                renderPlansList()
              ) : (
                <div className="rounded-lg bg-gray-50 p-6 text-center">
                  <p className="text-sm text-gray-500">
                    선택된 범위에 재조정 가능한 플랜이 없습니다.
                  </p>
                </div>
              )}
            </div>
          )}

          {currentStep === "preview" && (
            <div>
              <p className="mb-4 text-sm text-gray-600">
                아래 내용을 확인하고 재조정을 진행하세요.
              </p>
              {renderPreview()}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={
              currentStep === "select-range" ? handleReset : goToPrevStep
            }
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            {currentStep === "select-range" ? "초기화" : "이전"}
          </button>

          <button
            type="button"
            onClick={
              currentStep === "preview" ? handleReschedule : goToNextStep
            }
            disabled={
              (currentStep === "select-range" &&
                (!dateRange.from || !dateRange.to)) ||
              (currentStep === "select-plans" && selectedPlanIds.size === 0) ||
              isProcessing
            }
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition",
              (currentStep === "select-range" &&
                (!dateRange.from || !dateRange.to)) ||
                (currentStep === "select-plans" && selectedPlanIds.size === 0) ||
                isProcessing
                ? "cursor-not-allowed bg-gray-200 text-gray-500"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            {isProcessing ? (
              "처리 중..."
            ) : currentStep === "preview" ? (
              <>
                재조정 진행
                <ArrowRight className="h-4 w-4" />
              </>
            ) : (
              "다음"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
