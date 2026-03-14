"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface AddRecurringEventFormProps {
  onAdd: (pattern: {
    type: string;
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
    label?: string;
  }) => void;
  isLoading?: boolean;
}

const WEEKDAYS = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
];

const EVENT_TYPES = [
  { value: "학원", label: "학원" },
  { value: "이동시간", label: "이동시간" },
  { value: "기타", label: "기타" },
];

export default function AddRecurringEventForm({
  onAdd,
  isLoading = false,
}: AddRecurringEventFormProps) {
  const [type, setType] = useState("학원");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("19:00");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [label, setLabel] = useState("");

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSubmit = () => {
    if (daysOfWeek.length === 0 || !startTime || !endTime) return;
    onAdd({
      type,
      startTime,
      endTime,
      daysOfWeek,
      label: label || undefined,
    });
    setDaysOfWeek([]);
    setLabel("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">유형</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">이름 (선택)</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 영어학원"
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">시작</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">종료</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">요일:</span>
        <div className="flex gap-1">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={cn(
                "h-7 w-7 rounded-full text-xs font-medium transition-colors",
                daysOfWeek.includes(day.value)
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:bg-gray-700"
              )}
            >
              {day.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSubmit}
          disabled={daysOfWeek.length === 0 || !startTime || !endTime || isLoading}
          className="ml-auto flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          반복 일정 추가
        </button>
      </div>
    </div>
  );
}
