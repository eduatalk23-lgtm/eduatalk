"use client";

import React from "react";

/**
 * AllocationControls - 전략/취약과목 설정 컨트롤
 * 
 * 재사용 가능한 전략/취약과목 설정 UI 컴포넌트
 */

type AllocationControlsProps = {
  subjectType: "strategy" | "weakness";
  weeklyDays?: number;
  onChange: (allocation: {
    subject_type: "strategy" | "weakness";
    weekly_days?: number;
  }) => void;
  disabled?: boolean;
  size?: "sm" | "md";
};

export function AllocationControls({
  subjectType,
  weeklyDays = 3,
  onChange,
  disabled = false,
  size = "md",
}: AllocationControlsProps) {
  const isSmall = size === "sm";
  const paddingClass = isSmall ? "p-2" : "p-3";
  const textSizeClass = isSmall ? "text-xs" : "text-sm";
  const inputSizeClass = isSmall ? "h-3 w-3" : "h-4 w-4";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <label
          className={`flex flex-1 cursor-pointer items-center gap-2 rounded border ${paddingClass} transition-colors hover:bg-gray-100 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <input
            type="radio"
            name="subject_type"
            value="weakness"
            checked={subjectType === "weakness"}
            onChange={() => {
              if (!disabled) {
                onChange({ subject_type: "weakness" });
              }
            }}
            disabled={disabled}
            className={`${inputSizeClass} border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <span className={`${textSizeClass} text-gray-900`}>취약과목</span>
        </label>
        <label
          className={`flex flex-1 cursor-pointer items-center gap-2 rounded border ${paddingClass} transition-colors hover:bg-gray-100 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <input
            type="radio"
            name="subject_type"
            value="strategy"
            checked={subjectType === "strategy"}
            onChange={() => {
              if (!disabled) {
                onChange({ subject_type: "strategy", weekly_days: 3 });
              }
            }}
            disabled={disabled}
            className={`${inputSizeClass} border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60`}
          />
          <span className={`${textSizeClass} text-gray-900`}>전략과목</span>
        </label>
      </div>

      {subjectType === "strategy" && (
        <div>
          <select
            className={`w-full rounded border border-gray-300 px-2 py-1 ${textSizeClass} focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60`}
            value={weeklyDays}
            onChange={(e) => {
              if (!disabled) {
                onChange({
                  subject_type: "strategy",
                  weekly_days: Number(e.target.value),
                });
              }
            }}
            disabled={disabled}
          >
            <option value="2">주 2일</option>
            <option value="3">주 3일</option>
            <option value="4">주 4일</option>
          </select>
        </div>
      )}
    </div>
  );
}

