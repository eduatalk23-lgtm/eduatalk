"use client";

import { useMemo } from "react";
import { Calendar, Clock, Repeat, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { type SelectedContent, type ScheduleSettings, DURATION_OPTIONS } from "../types";

interface Step2ScheduleProps {
  schedule: ScheduleSettings;
  content: SelectedContent | null;
  onScheduleChange: (updates: Partial<ScheduleSettings>) => void;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

const REPEAT_OPTIONS = [
  { value: "none" as const, label: "반복 안함" },
  { value: "daily" as const, label: "매일" },
  { value: "weekly" as const, label: "매주" },
];

const WEEKDAYS = [
  { value: 0, label: "일" },
  { value: 1, label: "월" },
  { value: 2, label: "화" },
  { value: 3, label: "수" },
  { value: 4, label: "목" },
  { value: 5, label: "금" },
  { value: 6, label: "토" },
];

export function Step2Schedule({
  schedule,
  content,
  onScheduleChange,
}: Step2ScheduleProps) {
  // 날짜 포맷팅
  const formattedDate = useMemo(() => {
    if (!schedule.planDate) return "";
    const date = new Date(schedule.planDate + "T00:00:00");
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  }, [schedule.planDate]);

  // 종료 시간 자동 계산
  const handleStartTimeChange = (startTime: string) => {
    onScheduleChange({ startTime });

    // 예상 시간으로 종료 시간 자동 설정
    if (content?.estimatedMinutes) {
      const [hours, minutes] = startTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes + content.estimatedMinutes;
      const endHours = Math.floor(totalMinutes / 60) % 24;
      const endMinutes = totalMinutes % 60;
      const endTime = `${String(endHours).padStart(2, "0")}:${String(
        endMinutes
      ).padStart(2, "0")}`;
      onScheduleChange({ startTime, endTime });
    }
  };

  // 요일 토글
  const toggleRepeatDay = (day: number) => {
    const currentDays = schedule.repeatDays || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    onScheduleChange({ repeatDays: newDays });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          언제 학습할까요?
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          학습 일정을 설정하세요
        </p>
      </div>

      {/* Date Selection */}
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Calendar className="h-4 w-4" />
          날짜
        </label>
        <input
          type="date"
          value={schedule.planDate}
          onChange={(e) => onScheduleChange({ planDate: e.target.value })}
          className={cn(
            "w-full rounded-lg border px-4 py-3 text-sm",
            "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
            "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          )}
        />
        {formattedDate && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {formattedDate}
          </p>
        )}
      </div>

      {/* Time Selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4" />
            시작 시간
          </label>
          <div className="relative">
            <select
              value={schedule.startTime || ""}
              onChange={(e) => handleStartTimeChange(e.target.value)}
              className={cn(
                "w-full appearance-none rounded-lg border px-4 py-3 pr-10 text-sm",
                "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              )}
            >
              <option value="">시간 선택 (선택사항)</option>
              {TIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            종료 시간
          </label>
          <div className="relative">
            <select
              value={schedule.endTime || ""}
              onChange={(e) => onScheduleChange({ endTime: e.target.value })}
              className={cn(
                "w-full appearance-none rounded-lg border px-4 py-3 pr-10 text-sm",
                "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
                "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              )}
            >
              <option value="">시간 선택 (선택사항)</option>
              {TIME_OPTIONS.filter((t) =>
                schedule.startTime ? t > schedule.startTime : true
              ).map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Quick Time Presets */}
      {schedule.startTime && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            빠른 시간 설정
          </label>
          <div className="flex flex-wrap gap-2">
            {DURATION_OPTIONS.map((option) => {
              const [hours, minutes] = schedule.startTime!.split(":").map(Number);
              const totalMinutes = hours * 60 + minutes + option.value;
              const endHours = Math.floor(totalMinutes / 60) % 24;
              const endMinutes = totalMinutes % 60;
              const endTime = `${String(endHours).padStart(2, "0")}:${String(
                endMinutes
              ).padStart(2, "0")}`;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onScheduleChange({ endTime })}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    schedule.endTime === endTime
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Repeat Settings */}
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Repeat className="h-4 w-4" />
          반복 설정
        </label>
        <div className="flex gap-2">
          {REPEAT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onScheduleChange({ repeatType: option.value })}
              className={cn(
                "flex-1 rounded-lg border-2 px-4 py-2 text-sm font-medium transition-all",
                schedule.repeatType === option.value
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Weekly Repeat Days */}
      {schedule.repeatType === "weekly" && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            반복 요일
          </label>
          <div className="flex gap-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleRepeatDay(day.value)}
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all",
                  schedule.repeatDays?.includes(day.value)
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                )}
              >
                {day.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Repeat End Date */}
      {schedule.repeatType !== "none" && (
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            반복 종료일
          </label>
          <input
            type="date"
            value={schedule.repeatEndDate || ""}
            onChange={(e) => onScheduleChange({ repeatEndDate: e.target.value })}
            min={schedule.planDate}
            className={cn(
              "w-full rounded-lg border px-4 py-3 text-sm",
              "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20",
              "dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            )}
          />
        </div>
      )}
    </div>
  );
}
