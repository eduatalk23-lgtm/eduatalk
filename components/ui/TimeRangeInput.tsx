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
    <div className="flex flex-col gap-2">
      <div>
        <label className="text-xs font-medium text-[var(--text-primary)]">
          {label} {required && <span className="text-error-500">*</span>}
        </label>
        {description && (
          <p className="text-xs text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <input
            type="time"
            value={start}
            onChange={(e) => handleStartChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[rgb(var(--color-secondary-100))] disabled:text-[var(--text-tertiary)]"
          />
        </div>
        <div>
          <input
            type="time"
            value={end}
            onChange={(e) => handleEndChange(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-[rgb(var(--color-secondary-300))] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--text-primary)] focus:outline-none disabled:cursor-not-allowed disabled:bg-[rgb(var(--color-secondary-100))] disabled:text-[var(--text-tertiary)]"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--text-primary)]">
          기본값: {defaultStart} ~ {defaultEnd}
        </div>
        {!isUsingDefault && (
          <button
            type="button"
            onClick={handleReset}
            disabled={disabled}
            className="text-xs text-[var(--text-primary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            기본값으로 되돌리기
          </button>
        )}
      </div>
    </div>
  );
}

