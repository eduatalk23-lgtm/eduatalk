"use client";

import React, { useState, useCallback } from "react";
import { Repeat, Plus, X, Calendar, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { useToast } from "@/components/ui/ToastProvider";
import {
  createRecurringExclusion,
  type RecurringExclusion,
} from "@/lib/domains/plan/actions/plan-groups/exclusions";
import { DateInput } from "../../../common/DateInput";

type Pattern = "weekly" | "biweekly" | "monthly";
type ExclusionType = "휴가" | "개인사정" | "휴일지정" | "기타";

interface RecurringExclusionFormProps {
  periodStart: string;
  periodEnd: string;
  onSuccess?: (exclusion: RecurringExclusion) => void;
  onCancel?: () => void;
  className?: string;
  disabled?: boolean;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_FULL_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

const patterns: Array<{ value: Pattern; label: string; description: string }> = [
  { value: "weekly", label: "매주", description: "매주 특정 요일마다 반복" },
  { value: "biweekly", label: "격주", description: "2주에 한 번 특정 요일마다 반복" },
  { value: "monthly", label: "매월", description: "매월 특정 날짜에 반복" },
];

const exclusionTypes: Array<{ value: ExclusionType; label: string }> = [
  { value: "휴가", label: "휴가" },
  { value: "개인사정", label: "개인사정" },
  { value: "휴일지정", label: "휴일지정" },
  { value: "기타", label: "기타" },
];

/**
 * 반복 제외일 추가 폼
 * - 패턴 선택 (매주/격주/매월)
 * - 요일 또는 날짜 선택
 * - 유효 기간 설정
 */
export function RecurringExclusionForm({
  periodStart,
  periodEnd,
  onSuccess,
  onCancel,
  className,
  disabled = false,
}: RecurringExclusionFormProps) {
  const toast = useToast();

  // 폼 상태
  const [pattern, setPattern] = useState<Pattern>("weekly");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [exclusionType, setExclusionType] = useState<ExclusionType>("휴일지정");
  const [reason, setReason] = useState("");
  const [startDate, setStartDate] = useState(periodStart);
  const [endDate, setEndDate] = useState(periodEnd);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 요일 토글
  const toggleDay = useCallback((day: number) => {
    if (disabled) return;
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  }, [disabled]);

  // 빠른 패턴 선택
  const selectPattern = useCallback((days: number[]) => {
    if (disabled) return;
    setSelectedDays(days);
  }, [disabled]);

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (disabled) return;

    // 검증
    if (pattern === "weekly" || pattern === "biweekly") {
      if (selectedDays.length === 0) {
        toast.showError("요일을 선택해주세요.");
        return;
      }
    }

    if (!startDate) {
      toast.showError("시작일을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createRecurringExclusion({
        pattern,
        dayOfWeek: pattern !== "monthly" ? selectedDays : undefined,
        dayOfMonth: pattern === "monthly" ? dayOfMonth : undefined,
        exclusionType,
        reason: reason.trim() || undefined,
        startDate,
        endDate: endDate || undefined,
      });

      if (result.success && result.data) {
        toast.showSuccess("반복 제외일이 추가되었습니다.");
        onSuccess?.(result.data);

        // 폼 초기화
        setSelectedDays([]);
        setReason("");
      } else {
        toast.showError(result.error || "반복 제외일 추가에 실패했습니다.");
      }
    } catch (error) {
      console.error("반복 제외일 추가 실패:", error);
      toast.showError("반복 제외일 추가에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 패턴 설명 생성
  const getPatternDescription = () => {
    if (pattern === "monthly") {
      return `매월 ${dayOfMonth}일`;
    }

    if (selectedDays.length === 0) {
      return "요일을 선택해주세요";
    }

    const dayNames = selectedDays.map((d) => WEEKDAY_LABELS[d]).join(", ");
    return pattern === "weekly" ? `매주 ${dayNames}` : `격주 ${dayNames}`;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("rounded-xl border border-gray-200 bg-white p-5", className)}
    >
      <div className="mb-4 flex items-center gap-2">
        <Repeat className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-gray-900">반복 제외일 추가</h3>
      </div>

      <div className="space-y-4">
        {/* 패턴 선택 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">
            반복 패턴
          </label>
          <div className="flex gap-2">
            {patterns.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => !disabled && setPattern(p.value)}
                disabled={disabled}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  pattern === p.value
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {patterns.find((p) => p.value === pattern)?.description}
          </p>
        </div>

        {/* 요일 선택 (weekly/biweekly) */}
        {(pattern === "weekly" || pattern === "biweekly") && (
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              요일 선택
            </label>

            {/* 빠른 선택 버튼 */}
            <div className="mb-2 flex flex-wrap gap-1.5">
              <span className="text-xs text-gray-500">빠른 선택:</span>
              <button
                type="button"
                onClick={() => selectPattern([1, 3, 5])}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                  selectedDays.join(",") === "1,3,5"
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                월/수/금
              </button>
              <button
                type="button"
                onClick={() => selectPattern([2, 4])}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                  selectedDays.join(",") === "2,4"
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                화/목
              </button>
              <button
                type="button"
                onClick={() => selectPattern([0, 6])}
                disabled={disabled}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-xs font-medium transition-colors",
                  selectedDays.join(",") === "0,6"
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                주말
              </button>
            </div>

            {/* 개별 요일 선택 */}
            <div className="flex gap-1.5">
              {WEEKDAY_FULL_LABELS.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleDay(index)}
                  disabled={disabled}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors",
                    selectedDays.includes(index)
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                    index === 0 && !selectedDays.includes(index) && "text-red-500",
                    index === 6 && !selectedDays.includes(index) && "text-blue-500",
                    disabled && "cursor-not-allowed opacity-50"
                  )}
                >
                  {WEEKDAY_LABELS[index]}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 날짜 선택 (monthly) */}
        {pattern === "monthly" && (
          <div>
            <label className="mb-2 block text-xs font-medium text-gray-700">
              매월 날짜
            </label>
            <div className="flex items-center gap-2">
              <select
                value={dayOfMonth}
                onChange={(e) => !disabled && setDayOfMonth(parseInt(e.target.value, 10))}
                disabled={disabled}
                className={cn(
                  "w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none",
                  disabled && "cursor-not-allowed bg-gray-100 opacity-50"
                )}
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}일
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500">
                (31일이 없는 달은 마지막 날로 적용)
              </span>
            </div>
          </div>
        )}

        {/* 제외 유형 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">
            제외 유형
          </label>
          <div className="flex flex-wrap gap-2">
            {exclusionTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => !disabled && setExclusionType(type.value)}
                disabled={disabled}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  exclusionType === type.value
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300",
                  disabled && "cursor-not-allowed opacity-50"
                )}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        {/* 사유 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">
            사유 (선택)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => !disabled && setReason(e.target.value)}
            disabled={disabled}
            placeholder="예: 영어 학원"
            className={cn(
              "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none",
              disabled && "cursor-not-allowed bg-gray-100 opacity-50"
            )}
          />
        </div>

        {/* 유효 기간 */}
        <div>
          <label className="mb-2 block text-xs font-medium text-gray-700">
            유효 기간
          </label>
          <div className="grid grid-cols-2 gap-3">
            <DateInput
              id="recurring-start-date"
              label="시작일"
              labelClassName="text-xs"
              value={startDate}
              onChange={(val) => !disabled && setStartDate(val)}
              min={periodStart}
              max={periodEnd}
              disabled={disabled}
            />
            <DateInput
              id="recurring-end-date"
              label="종료일"
              labelClassName="text-xs"
              value={endDate}
              onChange={(val) => !disabled && setEndDate(val)}
              min={periodStart}
              max={periodEnd}
              disabled={disabled}
            />
          </div>
        </div>

        {/* 미리보기 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="flex items-start gap-2">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <div>
              <div className="text-xs font-medium text-blue-800">
                반복 패턴 미리보기
              </div>
              <div className="mt-0.5 text-xs text-blue-700">
                {getPatternDescription()} · {exclusionType}
                {reason && ` · ${reason}`}
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={disabled || isSubmitting}
              className={cn(
                "flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50",
                (disabled || isSubmitting) && "cursor-not-allowed opacity-50"
              )}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={
              disabled ||
              isSubmitting ||
              ((pattern === "weekly" || pattern === "biweekly") && selectedDays.length === 0)
            }
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90",
              (disabled || isSubmitting) && "cursor-not-allowed opacity-50"
            )}
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                추가 중...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                반복 제외일 추가
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * 반복 제외일 목록 항목
 */
interface RecurringExclusionItemProps {
  exclusion: RecurringExclusion;
  onDelete?: (id: string) => void;
  disabled?: boolean;
}

export function RecurringExclusionItem({
  exclusion,
  onDelete,
  disabled = false,
}: RecurringExclusionItemProps) {
  const getPatternLabel = () => {
    if (exclusion.pattern === "monthly") {
      return `매월 ${exclusion.dayOfMonth}일`;
    }

    const dayNames = (exclusion.dayOfWeek || [])
      .map((d) => WEEKDAY_LABELS[d])
      .join(", ");
    return exclusion.pattern === "weekly" ? `매주 ${dayNames}` : `격주 ${dayNames}`;
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100">
          <Repeat className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            {getPatternLabel()}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {exclusion.exclusionType}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {exclusion.startDate} ~ {exclusion.endDate || "무기한"}
            {exclusion.reason && ` · ${exclusion.reason}`}
          </div>
        </div>
      </div>
      {onDelete && exclusion.id && (
        <button
          type="button"
          onClick={() => onDelete(exclusion.id!)}
          disabled={disabled}
          className={cn(
            "rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-red-500",
            disabled && "cursor-not-allowed opacity-50"
          )}
          title="삭제"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
