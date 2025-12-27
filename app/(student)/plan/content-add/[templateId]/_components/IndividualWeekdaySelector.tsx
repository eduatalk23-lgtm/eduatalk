"use client";

import { useState } from "react";
import { Calendar, Clock, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

type IndividualScheduleSettings = {
  studyDays?: number[];
  dailyMinutes?: number;
  reviewEnabled?: boolean;
  reviewCycleInDays?: number;
};

type IndividualWeekdaySelectorProps = {
  /** 템플릿 기본 요일 (비교 표시용) */
  templateWeekdays: number[];
  /** 현재 설정된 값 */
  value: IndividualScheduleSettings | undefined;
  /** 값 변경 핸들러 */
  onChange: (value: IndividualScheduleSettings | undefined) => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 학습 유형 (전략/취약) */
  studyType?: "strategy" | "weakness";
  /** 전략과목 주당 일수 */
  strategyDaysPerWeek?: number;
};

export function IndividualWeekdaySelector({
  templateWeekdays,
  value,
  onChange,
  disabled = false,
  studyType = "weakness",
  strategyDaysPerWeek = 3,
}: IndividualWeekdaySelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [useCustomSchedule, setUseCustomSchedule] = useState(Boolean(value?.studyDays));

  // 현재 사용 중인 요일 (커스텀 또는 템플릿 기본값)
  const currentWeekdays = value?.studyDays ?? templateWeekdays;

  // 템플릿 기본값 사용 시 전략과목 요일 계산
  const effectiveTemplateWeekdays =
    studyType === "strategy"
      ? templateWeekdays.slice(0, strategyDaysPerWeek)
      : templateWeekdays;

  const handleToggleCustom = (enabled: boolean) => {
    setUseCustomSchedule(enabled);
    if (!enabled) {
      // 템플릿 기본값으로 복원
      onChange(undefined);
    } else {
      // 커스텀 스케줄 시작 (현재 템플릿 값을 기본으로)
      onChange({
        ...value,
        studyDays: effectiveTemplateWeekdays,
      });
    }
  };

  const handleWeekdayToggle = (day: number) => {
    if (!useCustomSchedule || disabled) return;

    const currentDays = value?.studyDays ?? effectiveTemplateWeekdays;
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort((a, b) => a - b);

    // 최소 1일은 선택해야 함
    if (newDays.length === 0) return;

    onChange({
      ...value,
      studyDays: newDays,
    });
  };

  const handleDailyMinutesChange = (minutes: number) => {
    onChange({
      ...value,
      dailyMinutes: minutes,
    });
  };

  const handleReviewToggle = (enabled: boolean) => {
    onChange({
      ...value,
      reviewEnabled: enabled,
      reviewCycleInDays: enabled ? (value?.reviewCycleInDays ?? 7) : undefined,
    });
  };

  const handleReviewCycleChange = (days: number) => {
    onChange({
      ...value,
      reviewCycleInDays: days,
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* 헤더 (접기/펼치기) */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between p-4 text-left"
        disabled={disabled}
      >
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              콘텐츠별 독립 스케줄
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {useCustomSchedule
                ? `커스텀 요일: ${currentWeekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}`
                : `템플릿 기본값 사용: ${effectiveTemplateWeekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")}`}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {/* 확장된 설정 패널 */}
      {isExpanded && (
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          {/* 커스텀 스케줄 토글 */}
          <div className="mb-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useCustomSchedule}
                onChange={(e) => handleToggleCustom(e.target.checked)}
                disabled={disabled}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                이 콘텐츠에 독립적인 스케줄 사용
              </span>
            </label>
            <p className="ml-6 mt-1 text-xs text-gray-500">
              선택하지 않으면 템플릿의 기본 설정을 따릅니다.
            </p>
          </div>

          {/* 요일 선택 */}
          <div
            className={cn(
              "space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900/50",
              !useCustomSchedule && "opacity-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                학습 요일
              </span>
              <span className="text-xs text-gray-500">
                {currentWeekdays.length}일 선택됨
              </span>
            </div>

            <div className="flex gap-1.5">
              {WEEKDAY_LABELS.map((label, idx) => {
                const isSelected = currentWeekdays.includes(idx);
                const isTemplateDay = effectiveTemplateWeekdays.includes(idx);

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleWeekdayToggle(idx)}
                    disabled={!useCustomSchedule || disabled}
                    className={cn(
                      "flex h-10 w-10 flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors",
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isTemplateDay
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
                      useCustomSchedule &&
                        !disabled &&
                        "hover:bg-blue-500 hover:text-white",
                      (!useCustomSchedule || disabled) && "cursor-not-allowed"
                    )}
                  >
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {/* 템플릿 요일과 다른 경우 표시 */}
            {useCustomSchedule &&
              JSON.stringify(currentWeekdays) !==
                JSON.stringify(effectiveTemplateWeekdays) && (
                <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <RefreshCw className="h-3 w-3" />
                  템플릿 기본값과 다른 요일이 설정되었습니다.
                </p>
              )}
          </div>

          {/* 일일 학습 시간 */}
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                일일 학습 시간 (분)
              </label>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={180}
                step={5}
                value={value?.dailyMinutes ?? 30}
                onChange={(e) => handleDailyMinutesChange(Number(e.target.value))}
                disabled={!useCustomSchedule || disabled}
                className={cn(
                  "w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm",
                  "dark:border-gray-600 dark:bg-gray-700",
                  (!useCustomSchedule || disabled) && "opacity-50"
                )}
              />
              <span className="text-sm text-gray-500">분</span>
              <div className="flex gap-1">
                {[30, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleDailyMinutesChange(mins)}
                    disabled={!useCustomSchedule || disabled}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      value?.dailyMinutes === mins
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400",
                      (!useCustomSchedule || disabled) && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {mins}분
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 복습 설정 */}
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={value?.reviewEnabled ?? false}
                onChange={(e) => handleReviewToggle(e.target.checked)}
                disabled={!useCustomSchedule || disabled}
                className={cn(
                  "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500",
                  (!useCustomSchedule || disabled) && "opacity-50"
                )}
              />
              <span
                className={cn(
                  "text-sm text-gray-700 dark:text-gray-300",
                  (!useCustomSchedule || disabled) && "opacity-50"
                )}
              >
                주기적 복습 활성화
              </span>
            </label>

            {value?.reviewEnabled && (
              <div className="ml-6 mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  매
                </span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={value.reviewCycleInDays ?? 7}
                  onChange={(e) => handleReviewCycleChange(Number(e.target.value))}
                  disabled={!useCustomSchedule || disabled}
                  className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  일마다 복습 플랜 생성
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
