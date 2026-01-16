"use client";

import { useState } from "react";
import Input from "@/components/atoms/Input";
import Button from "@/components/atoms/Button";

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

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    if (newStart >= end) {
      // 시작 시간이 종료 시간보다 크거나 같으면 경고
      return;
    }
    onChange({ start: newStart, end });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
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
        <label className="text-body-2 text-text-primary">
          {label} {required && <span className="text-error-500">*</span>}
        </label>
        {description && (
          <p className="text-body-2 text-text-secondary">{description}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Input
            type="time"
            value={start}
            onChange={handleStartChange}
            disabled={disabled}
            inputSize="md"
          />
        </div>
        <div>
          <Input
            type="time"
            value={end}
            onChange={handleEndChange}
            disabled={disabled}
            inputSize="md"
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-body-2 text-text-primary">
          기본값: {defaultStart} ~ {defaultEnd}
        </div>
        {!isUsingDefault && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={disabled}
            className="text-text-primary hover:text-text-primary"
          >
            기본값으로 되돌리기
          </Button>
        )}
      </div>
    </div>
  );
}

