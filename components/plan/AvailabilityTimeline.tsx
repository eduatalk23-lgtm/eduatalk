"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { DailyAvailabilityInfo, OccupiedSlot } from "@/lib/domains/plan/services/AvailabilityService";
import type { TimeRange } from "@/lib/scheduler/calculateAvailableDates";

// ============================================
// 타입 정의
// ============================================

export interface AvailabilityTimelineProps {
  /** 일별 가용시간 정보 */
  dailyInfo: DailyAvailabilityInfo;
  /** 새 플랜 미리보기 (선택적) */
  previewSlots?: Array<{
    start: string;
    end: string;
    label?: string;
  }>;
  /** 시간 범위 (기본: 06:00 ~ 24:00) */
  timeRange?: { start: string; end: string };
  /** 클릭 핸들러 */
  onSlotClick?: (slot: OccupiedSlot) => void;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToPercent(
  minutes: number,
  rangeStart: number,
  rangeEnd: number
): number {
  const total = rangeEnd - rangeStart;
  if (total <= 0) return 0;
  return ((minutes - rangeStart) / total) * 100;
}

// ============================================
// 서브 컴포넌트
// ============================================

/**
 * 시간 눈금 표시
 */
function TimeScale({
  startMinutes,
  endMinutes,
  compact,
}: {
  startMinutes: number;
  endMinutes: number;
  compact?: boolean;
}) {
  const hours = useMemo(() => {
    const result: number[] = [];
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.ceil(endMinutes / 60);
    const step = compact ? 2 : 1;

    for (let h = startHour; h <= endHour; h += step) {
      result.push(h);
    }
    return result;
  }, [startMinutes, endMinutes, compact]);

  return (
    <div className="relative h-4 border-b border-gray-200">
      {hours.map((hour) => {
        const position = minutesToPercent(
          hour * 60,
          startMinutes,
          endMinutes
        );
        return (
          <div
            key={hour}
            className="absolute -translate-x-1/2 text-xs text-gray-500"
            style={{ left: `${position}%` }}
          >
            {hour}:00
          </div>
        );
      })}
    </div>
  );
}

/**
 * 가용시간 블록
 */
function AvailableBlock({
  range,
  startMinutes,
  endMinutes,
}: {
  range: TimeRange;
  startMinutes: number;
  endMinutes: number;
}) {
  const left = minutesToPercent(
    timeToMinutes(range.start),
    startMinutes,
    endMinutes
  );
  const width = minutesToPercent(
    timeToMinutes(range.end),
    startMinutes,
    endMinutes
  ) - left;

  return (
    <div
      className="absolute top-0 bottom-0 bg-green-100 border border-green-300 rounded"
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`가용: ${range.start} ~ ${range.end}`}
    />
  );
}

/**
 * 점유 슬롯 블록
 */
function OccupiedBlock({
  slot,
  startMinutes,
  endMinutes,
  onClick,
}: {
  slot: OccupiedSlot;
  startMinutes: number;
  endMinutes: number;
  onClick?: () => void;
}) {
  const left = minutesToPercent(
    timeToMinutes(slot.start),
    startMinutes,
    endMinutes
  );
  const width = minutesToPercent(
    timeToMinutes(slot.end),
    startMinutes,
    endMinutes
  ) - left;

  const bgColor = {
    book: "bg-blue-200 border-blue-400",
    lecture: "bg-purple-200 border-purple-400",
    custom: "bg-orange-200 border-orange-400",
  }[slot.contentType];

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 border rounded cursor-pointer transition-opacity hover:opacity-80",
        bgColor
      )}
      style={{ left: `${left}%`, width: `${width}%` }}
      onClick={onClick}
      title={`${slot.contentTitle || "플랜"} (${slot.start} ~ ${slot.end})`}
    >
      {width > 8 && (
        <div className="px-1 text-xs truncate leading-tight">
          {slot.contentTitle || slot.planId.slice(0, 6)}
        </div>
      )}
    </div>
  );
}

/**
 * 미리보기 슬롯 블록
 */
function PreviewBlock({
  slot,
  startMinutes,
  endMinutes,
}: {
  slot: { start: string; end: string; label?: string };
  startMinutes: number;
  endMinutes: number;
}) {
  const left = minutesToPercent(
    timeToMinutes(slot.start),
    startMinutes,
    endMinutes
  );
  const width = minutesToPercent(
    timeToMinutes(slot.end),
    startMinutes,
    endMinutes
  ) - left;

  return (
    <div
      className="absolute top-0 bottom-0 bg-yellow-300 border-2 border-yellow-500 border-dashed rounded opacity-70"
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`미리보기: ${slot.label || ""} (${slot.start} ~ ${slot.end})`}
    >
      {width > 8 && (
        <div className="px-1 text-xs font-medium truncate leading-tight">
          {slot.label || "새 플랜"}
        </div>
      )}
    </div>
  );
}

/**
 * 남은 가용시간 블록
 */
function RemainingBlock({
  range,
  startMinutes,
  endMinutes,
}: {
  range: TimeRange;
  startMinutes: number;
  endMinutes: number;
}) {
  const left = minutesToPercent(
    timeToMinutes(range.start),
    startMinutes,
    endMinutes
  );
  const width = minutesToPercent(
    timeToMinutes(range.end),
    startMinutes,
    endMinutes
  ) - left;

  return (
    <div
      className="absolute top-0 bottom-0 bg-emerald-50 border border-emerald-200 border-dashed rounded"
      style={{ left: `${left}%`, width: `${width}%` }}
      title={`남은 시간: ${range.start} ~ ${range.end}`}
    />
  );
}

// ============================================
// 메인 컴포넌트
// ============================================

export function AvailabilityTimeline({
  dailyInfo,
  previewSlots,
  timeRange = { start: "06:00", end: "24:00" },
  onSlotClick,
  compact = false,
  className,
}: AvailabilityTimelineProps) {
  const startMinutes = timeToMinutes(timeRange.start);
  const endMinutes = timeToMinutes(timeRange.end);

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}시간 ${mins > 0 ? `${mins}분` : ""}`.trim();
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{dailyInfo.date}</span>
          <span
            className={cn(
              "px-2 py-0.5 text-xs rounded",
              dailyInfo.dayType === "학습일"
                ? "bg-blue-100 text-blue-700"
                : dailyInfo.dayType === "복습일"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {dailyInfo.dayType}
          </span>
        </div>
        <div className="text-xs text-gray-500">
          {dailyInfo.existingPlanCount > 0 && (
            <span className="mr-2">플랜 {dailyInfo.existingPlanCount}개</span>
          )}
          <span>
            남은 시간: {formatMinutes(dailyInfo.totalRemainingMinutes)}
          </span>
        </div>
      </div>

      {/* 타임라인 */}
      <div className="relative">
        {/* 시간 눈금 */}
        <TimeScale
          startMinutes={startMinutes}
          endMinutes={endMinutes}
          compact={compact}
        />

        {/* 타임라인 바 */}
        <div
          className={cn(
            "relative bg-gray-50 border border-gray-200 rounded",
            compact ? "h-6" : "h-8"
          )}
        >
          {/* 전체 가용시간 (배경) */}
          {dailyInfo.totalAvailableRanges.map((range, idx) => (
            <AvailableBlock
              key={`avail-${idx}`}
              range={range}
              startMinutes={startMinutes}
              endMinutes={endMinutes}
            />
          ))}

          {/* 점유 슬롯 */}
          {dailyInfo.occupiedSlots.map((slot, idx) => (
            <OccupiedBlock
              key={`occupied-${idx}`}
              slot={slot}
              startMinutes={startMinutes}
              endMinutes={endMinutes}
              onClick={() => onSlotClick?.(slot)}
            />
          ))}

          {/* 미리보기 슬롯 */}
          {previewSlots?.map((slot, idx) => (
            <PreviewBlock
              key={`preview-${idx}`}
              slot={slot}
              startMinutes={startMinutes}
              endMinutes={endMinutes}
            />
          ))}
        </div>
      </div>

      {/* 범례 (컴팩트 모드가 아닌 경우) */}
      {!compact && (
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
            <span>가용시간</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-200 border border-blue-400 rounded" />
            <span>교재</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-purple-200 border border-purple-400 rounded" />
            <span>강의</span>
          </div>
          {previewSlots && previewSlots.length > 0 && (
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-yellow-300 border-2 border-yellow-500 border-dashed rounded" />
              <span>새 플랜</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AvailabilityTimeline;
