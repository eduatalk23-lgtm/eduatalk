"use client";

import { useState } from "react";

type TimeRange = {
  start: string;
  end: string;
};

type TimeRangeInputProps = {
  label: string;
  description?: string;
  value?: TimeRange;
  onChange: (range: TimeRange) => void;
  defaultStart: string;
  defaultEnd: string;
  required?: boolean;
  disabled?: boolean;
};

export function TimeRangeInput({
  label,
  description,
  value,
  onChange,
  defaultStart,
  defaultEnd,
  required = false,
  disabled = false,
}: TimeRangeInputProps) {
  const start = value?.start || defaultStart;
  const end = value?.end || defaultEnd;
  const isUsingDefault = start === defaultStart && end === defaultEnd;

  const handleStartChange = (newStart: string) => {
    if (newStart >= end) {
      // 시작 시간이 종료 시간보다 크거나 같으면 경고
      return;
    }
    onChange({ start: newStart, end });
  };

  const handleEndChange = (newEnd: string) => {
    if (newEnd <= start) {
      // 종료 시간이 시작 시간보다 작거나 같으면 경고
      return;
    }
    onChange({ start, end: newEnd });
  };

  const handleReset = () => {
    onChange({ start: defaultStart, end: defaultEnd });
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {description && (
          <p className="mt-1 text-xs text-gray-800">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            type="time"
            value={start}
            onChange={(e) => handleStartChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-800"
          />
        </div>
        <div>
          <input
            type="time"
            value={end}
            onChange={(e) => handleEndChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-800"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-800">
          기본값: {defaultStart} ~ {defaultEnd}
        </div>
        {!isUsingDefault && (
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="text-xs text-gray-800 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            기본값으로 되돌리기
          </button>
        )}
      </div>
    </div>
  );
}

