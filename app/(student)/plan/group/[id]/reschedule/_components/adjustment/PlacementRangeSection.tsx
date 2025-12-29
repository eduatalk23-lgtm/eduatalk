"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DateRangeSelector } from "../DateRangeSelector";
import type { PlacementRangeSectionProps } from "./types";

/**
 * 재조정 플랜 배치 범위 선택 섹션
 */
export function PlacementRangeSection({
  placementMode,
  onPlacementModeChange,
  placementDateRange,
  onPlacementDateRangeChange,
  tomorrowStr,
  groupPeriodEnd,
  existingPlans = [],
}: PlacementRangeSectionProps) {
  const [expanded, setExpanded] = useState(placementMode === "manual");

  const handleModeChange = (mode: "auto" | "manual") => {
    onPlacementModeChange(mode);
    setExpanded(mode === "manual");
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-gray-900">
          재조정 플랜 배치 범위 선택
        </h3>
        <p className="text-xs text-gray-600">
          새로 생성된 플랜을 어떤 날짜 범위에 배치할지 선택합니다 (오늘 이후만
          가능)
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
          aria-label="자동 배치 모드 선택"
        >
          <input
            type="radio"
            name="placementMode"
            value="auto"
            checked={placementMode === "auto"}
            onChange={() => handleModeChange("auto")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            aria-label="자동 배치"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">자동</div>
            <div className="text-xs text-gray-600">
              오늘 이후 ~ 플랜 그룹 종료일 ({tomorrowStr} ~ {groupPeriodEnd})
            </div>
          </div>
        </label>

        <label
          className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition hover:bg-gray-50"
          aria-label="수동 선택 모드 선택"
        >
          <input
            type="radio"
            name="placementMode"
            value="manual"
            checked={placementMode === "manual"}
            onChange={() => handleModeChange("manual")}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            aria-label="수동 선택"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900">수동 선택</div>
            <div className="text-xs text-gray-600">
              원하는 날짜 범위를 직접 선택합니다 (오늘 이후만 선택 가능)
            </div>
          </div>
        </label>
      </div>

      {/* 배치 범위 선택 UI (접이식 패널) */}
      {placementMode === "manual" && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-3 transition hover:bg-gray-100"
            aria-expanded={expanded}
            aria-controls="placement-range-panel"
          >
            <span className="text-sm font-medium text-gray-900">
              배치 범위 선택
            </span>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-gray-600" aria-hidden="true" />
            ) : (
              <ChevronDown
                className="h-5 w-5 text-gray-600"
                aria-hidden="true"
              />
            )}
          </button>

          {expanded && (
            <div
              id="placement-range-panel"
              className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4"
              role="region"
              aria-label="배치 범위 선택 패널"
            >
              <DateRangeSelector
                groupPeriodStart={tomorrowStr}
                groupPeriodEnd={groupPeriodEnd}
                existingPlans={existingPlans}
                onRangeChange={onPlacementDateRangeChange}
                initialRange={placementDateRange}
                minDate={tomorrowStr}
              />
            </div>
          )}
        </div>
      )}

      {/* 선택한 배치 범위 요약 */}
      {placementMode === "auto" ? (
        <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <div className="text-sm font-medium text-blue-900">
            자동 배치 범위
          </div>
          <div className="text-sm text-blue-700">
            {tomorrowStr} ~ {groupPeriodEnd}
          </div>
        </div>
      ) : (
        placementDateRange.from &&
        placementDateRange.to && (
          <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="text-sm font-medium text-blue-900">
              선택한 배치 범위
            </div>
            <div className="text-sm text-blue-700">
              {placementDateRange.from} ~ {placementDateRange.to}
            </div>
          </div>
        )
      )}
    </div>
  );
}
