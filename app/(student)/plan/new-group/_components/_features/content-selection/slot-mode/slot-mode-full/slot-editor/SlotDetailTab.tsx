"use client";

import { cn } from "@/lib/cn";
import { ChevronDown, Loader2 } from "lucide-react";
import { SLOT_TYPE_CONFIG } from "./constants";
import type { SlotDetailTabProps } from "./types";

/**
 * 슬롯 상세 설정 탭
 *
 * 슬롯의 타입, 교과, 과목, 배정 방식 등을 설정합니다.
 */
export function SlotDetailTab({
  slot,
  subjects,
  isLoadingSubjects,
  subjectCategories,
  editable,
  onTypeChange,
  onSubjectCategoryChange,
  onSubjectIdChange,
  onSubjectTypeChange,
  onWeeklyDaysChange,
}: SlotDetailTabProps) {
  const isLocked = slot.is_locked;

  return (
    <div className="space-y-4">
      {/* 슬롯 타입 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          슬롯 타입
        </label>
        <div className="relative">
          <select
            value={slot.slot_type || ""}
            onChange={onTypeChange}
            disabled={!editable || isLocked}
            className={cn(
              "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">타입 선택</option>
            {Object.entries(SLOT_TYPE_CONFIG).map(([type, config]) => (
              <option key={type} value={type}>
                {config.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 교과 */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          교과
        </label>
        <div className="relative">
          <select
            value={slot.subject_category || ""}
            onChange={onSubjectCategoryChange}
            disabled={!editable || isLocked}
            className={cn(
              "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
              "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
              (!editable || isLocked) && "cursor-not-allowed opacity-60"
            )}
          >
            <option value="">교과 선택</option>
            {subjectCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* 과목 */}
      {slot.subject_category && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            과목 (선택사항)
          </label>
          {isLoadingSubjects ? (
            <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-3 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              과목 불러오는 중...
            </div>
          ) : subjects.length > 0 ? (
            <div className="relative">
              <select
                value={slot.subject_id || ""}
                onChange={onSubjectIdChange}
                disabled={!editable || isLocked}
                className={cn(
                  "w-full appearance-none rounded-lg border bg-white px-3 py-3 pr-10 text-base",
                  "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
                  (!editable || isLocked) && "cursor-not-allowed opacity-60"
                )}
              >
                <option value="">과목 선택</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            </div>
          ) : (
            <div className="rounded-lg border bg-gray-50 px-3 py-3 text-sm text-gray-400">
              등록된 과목이 없습니다
            </div>
          )}
        </div>
      )}

      {/* 배정 방식 */}
      {slot.subject_category && (
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            배정 방식
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onSubjectTypeChange("weakness")}
              disabled={!editable || isLocked}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-all",
                slot.subject_type !== "strategy"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              취약과목
              <span className="text-xs text-gray-400">(매일)</span>
            </button>
            <button
              type="button"
              onClick={() => onSubjectTypeChange("strategy")}
              disabled={!editable || isLocked}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-all",
                slot.subject_type === "strategy"
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300",
                (!editable || isLocked) && "cursor-not-allowed opacity-60"
              )}
            >
              전략과목
            </button>
          </div>

          {/* 주당 배정 일수 */}
          {slot.subject_type === "strategy" && (
            <div className="mt-3">
              <label className="mb-1.5 block text-xs text-gray-500">
                주당 배정 일수
              </label>
              <div className="relative">
                <select
                  value={slot.weekly_days ?? 3}
                  onChange={onWeeklyDaysChange}
                  disabled={!editable || isLocked}
                  className={cn(
                    "w-full appearance-none rounded-lg border bg-white px-3 py-2.5 pr-10 text-sm",
                    "focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500",
                    (!editable || isLocked) && "cursor-not-allowed opacity-60"
                  )}
                >
                  <option value={2}>주 2일</option>
                  <option value={3}>주 3일 (기본)</option>
                  <option value={4}>주 4일</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
