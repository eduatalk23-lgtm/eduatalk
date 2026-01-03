"use client";

import React, { useMemo } from "react";
import { Clock, MapPin, X, BookOpen } from "lucide-react";
import { cn } from "@/lib/cn";

type AcademySchedule = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  academy_name?: string;
  subject?: string;
  travel_time?: number;
  source?: "template" | "student" | "time_management";
  is_locked?: boolean;
};

interface AcademyTimeTableViewProps {
  schedules: AcademySchedule[];
  onRemove?: (index: number) => void;
  editable?: boolean;
  campMode?: boolean;
  className?: string;
  showTravelTime?: boolean;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_FULL_LABELS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

// 시간을 분으로 변환
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

// 분을 시간 문자열로 변환
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

// 색상 팔레트
const COLORS = [
  { bg: "bg-blue-100", border: "border-blue-300", text: "text-blue-800" },
  { bg: "bg-green-100", border: "border-green-300", text: "text-green-800" },
  { bg: "bg-purple-100", border: "border-purple-300", text: "text-purple-800" },
  { bg: "bg-orange-100", border: "border-orange-300", text: "text-orange-800" },
  { bg: "bg-pink-100", border: "border-pink-300", text: "text-pink-800" },
  { bg: "bg-teal-100", border: "border-teal-300", text: "text-teal-800" },
  { bg: "bg-indigo-100", border: "border-indigo-300", text: "text-indigo-800" },
];

/**
 * 주간 시간표 형태로 학원 일정 시각화
 */
export function AcademyTimeTableView({
  schedules,
  onRemove,
  editable = true,
  campMode = false,
  className,
  showTravelTime = true,
}: AcademyTimeTableViewProps) {
  // 학원별 색상 매핑
  const academyColors = useMemo(() => {
    const colorMap = new Map<string, typeof COLORS[0]>();
    const uniqueAcademies = [...new Set(schedules.map((s) => s.academy_name || "기타"))];
    uniqueAcademies.forEach((name, index) => {
      colorMap.set(name, COLORS[index % COLORS.length]);
    });
    return colorMap;
  }, [schedules]);

  // 시간 범위 계산 (최소 8시 ~ 최대 22시)
  const timeRange = useMemo(() => {
    if (schedules.length === 0) {
      return { start: 8 * 60, end: 22 * 60 };
    }

    let minTime = 8 * 60;
    let maxTime = 22 * 60;

    schedules.forEach((s) => {
      const startMin = timeToMinutes(s.start_time);
      const endMin = timeToMinutes(s.end_time);
      const travelMin = s.travel_time || 60;

      minTime = Math.min(minTime, startMin - travelMin);
      maxTime = Math.max(maxTime, endMin + travelMin);
    });

    // 30분 단위로 반올림
    return {
      start: Math.floor(minTime / 30) * 30,
      end: Math.ceil(maxTime / 30) * 30,
    };
  }, [schedules]);

  // 요일별 일정 그룹핑
  const schedulesByDay = useMemo(() => {
    const grouped = new Map<number, Array<AcademySchedule & { originalIndex: number }>>();
    schedules.forEach((schedule, index) => {
      const day = schedule.day_of_week;
      if (!grouped.has(day)) {
        grouped.set(day, []);
      }
      grouped.get(day)!.push({ ...schedule, originalIndex: index });
    });
    return grouped;
  }, [schedules]);

  // 시간 눈금 생성
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let t = timeRange.start; t <= timeRange.end; t += 60) {
      slots.push(minutesToTime(t));
    }
    return slots;
  }, [timeRange]);

  const totalMinutes = timeRange.end - timeRange.start;
  const hourHeight = 60; // 1시간 = 60px

  const getPositionStyle = (schedule: AcademySchedule) => {
    const startMin = timeToMinutes(schedule.start_time);
    const endMin = timeToMinutes(schedule.end_time);
    const travelTime = schedule.travel_time || 60;

    const top = ((startMin - timeRange.start) / 60) * hourHeight;
    const height = ((endMin - startMin) / 60) * hourHeight;

    return {
      top: `${top}px`,
      height: `${Math.max(height, 30)}px`, // 최소 높이 30px
    };
  };

  const canRemove = (schedule: AcademySchedule) => {
    if (!editable) return false;
    if (campMode && (schedule.is_locked || schedule.source === "template")) return false;
    return true;
  };

  if (schedules.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center", className)}>
        <Clock className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">등록된 학원 일정이 없습니다.</p>
        <p className="mt-1 text-xs text-gray-400">위에서 학원 일정을 추가해주세요.</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border bg-white", className)}>
      {/* 헤더 - 요일 */}
      <div className="grid grid-cols-8 border-b bg-gray-50">
        <div className="p-2 text-center text-xs font-medium text-gray-500">시간</div>
        {WEEKDAY_LABELS.map((day, index) => {
          const hasSchedule = schedulesByDay.has(index);
          return (
            <div
              key={index}
              className={cn(
                "p-2 text-center text-xs font-medium",
                hasSchedule ? "text-gray-900" : "text-gray-400",
                index === 0 && "text-red-500",
                index === 6 && "text-blue-500"
              )}
            >
              {day}
              {hasSchedule && (
                <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                  {schedulesByDay.get(index)!.length}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 시간표 본체 */}
      <div className="relative grid grid-cols-8">
        {/* 시간 눈금 */}
        <div className="border-r bg-gray-50">
          {timeSlots.map((time, index) => (
            <div
              key={time}
              className="flex h-[60px] items-start justify-center border-b border-gray-100 px-1 pt-1"
            >
              <span className="text-[10px] text-gray-400">{time}</span>
            </div>
          ))}
        </div>

        {/* 요일별 컬럼 */}
        {WEEKDAY_LABELS.map((_, dayIndex) => {
          const daySchedules = schedulesByDay.get(dayIndex) || [];

          return (
            <div
              key={dayIndex}
              className="relative border-r last:border-r-0"
              style={{ height: `${timeSlots.length * hourHeight}px` }}
            >
              {/* 시간 구분선 */}
              {timeSlots.map((_, idx) => (
                <div
                  key={idx}
                  className="absolute left-0 right-0 border-b border-gray-100"
                  style={{ top: `${idx * hourHeight}px`, height: `${hourHeight}px` }}
                />
              ))}

              {/* 일정 블록 */}
              {daySchedules.map((schedule) => {
                const posStyle = getPositionStyle(schedule);
                const color = academyColors.get(schedule.academy_name || "기타")!;

                return (
                  <div
                    key={schedule.originalIndex}
                    className={cn(
                      "absolute left-0.5 right-0.5 overflow-hidden rounded border",
                      color.bg,
                      color.border,
                      "shadow-sm transition-shadow hover:shadow-md"
                    )}
                    style={posStyle}
                  >
                    <div className="flex h-full flex-col p-1">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <div className={cn("truncate text-[10px] font-semibold leading-tight", color.text)}>
                            {schedule.academy_name || "학원"}
                          </div>
                          {schedule.subject && (
                            <div className="flex items-center gap-0.5 truncate text-[9px] text-gray-600">
                              <BookOpen className="h-2 w-2" />
                              {schedule.subject}
                            </div>
                          )}
                        </div>
                        {canRemove(schedule) && onRemove && (
                          <button
                            onClick={() => onRemove(schedule.originalIndex)}
                            className="ml-0.5 flex-shrink-0 rounded p-0.5 text-gray-400 hover:bg-white/50 hover:text-red-500"
                            title="삭제"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="mt-auto">
                        <div className="text-[9px] text-gray-500">
                          {schedule.start_time} - {schedule.end_time}
                        </div>
                        {showTravelTime && schedule.travel_time && (
                          <div className="flex items-center gap-0.5 text-[8px] text-gray-400">
                            <MapPin className="h-2 w-2" />
                            이동 {schedule.travel_time}분
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      {schedules.length > 0 && (
        <div className="border-t bg-gray-50 p-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-gray-500">학원:</span>
            {[...academyColors.entries()].map(([name, color]) => (
              <div key={name} className="flex items-center gap-1">
                <div className={cn("h-2 w-2 rounded", color.bg, color.border)} />
                <span className="text-[10px] text-gray-600">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 요일 패턴 선택기 (월/수/금, 화/목 등 일괄 선택)
 */
export function WeekdayPatternSelector({
  selectedDays,
  onChange,
  disabled = false,
}: {
  selectedDays: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const patterns = [
    { label: "월/수/금", days: [1, 3, 5] },
    { label: "화/목", days: [2, 4] },
    { label: "평일", days: [1, 2, 3, 4, 5] },
    { label: "주말", days: [0, 6] },
  ];

  const isPatternSelected = (patternDays: number[]) => {
    return patternDays.every((d) => selectedDays.includes(d));
  };

  const togglePattern = (patternDays: number[]) => {
    if (disabled) return;

    if (isPatternSelected(patternDays)) {
      // 패턴 제거
      onChange(selectedDays.filter((d) => !patternDays.includes(d)));
    } else {
      // 패턴 추가
      const newDays = [...new Set([...selectedDays, ...patternDays])];
      onChange(newDays.sort((a, b) => a - b));
    }
  };

  const toggleDay = (day: number) => {
    if (disabled) return;

    if (selectedDays.includes(day)) {
      onChange(selectedDays.filter((d) => d !== day));
    } else {
      const newDays = [...selectedDays, day].sort((a, b) => a - b);
      onChange(newDays);
    }
  };

  return (
    <div className="space-y-3">
      {/* 패턴 버튼 */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500">빠른 선택:</span>
        {patterns.map((pattern) => (
          <button
            key={pattern.label}
            type="button"
            onClick={() => togglePattern(pattern.days)}
            disabled={disabled}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              isPatternSelected(pattern.days)
                ? "border-primary bg-primary text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {pattern.label}
          </button>
        ))}
      </div>

      {/* 개별 요일 선택 */}
      <div className="flex flex-wrap gap-1.5">
        {WEEKDAY_FULL_LABELS.map((label, index) => (
          <button
            key={index}
            type="button"
            onClick={() => toggleDay(index)}
            disabled={disabled}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              selectedDays.includes(index)
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100",
              index === 0 && !selectedDays.includes(index) && "text-red-500",
              index === 6 && !selectedDays.includes(index) && "text-blue-500",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedDays.length > 0 && (
        <p className="text-xs text-gray-500">
          {selectedDays.length}개 요일 선택됨: {selectedDays.map((d) => WEEKDAY_LABELS[d]).join(", ")}
        </p>
      )}
    </div>
  );
}
