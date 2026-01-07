"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/cn";

// ============================================
// 타입 정의
// ============================================

export type TimeSlotType =
  | "study"
  | "self-study"
  | "lunch"
  | "academy"
  | "travel"
  | "non-study"
  | "unavailable";

export interface TimeSlotSegment {
  start: string; // HH:mm
  end: string; // HH:mm
  type: TimeSlotType;
  label?: string;
}

export interface DayTimelineBarProps {
  /** 요일 (0-6, 일-토) */
  weekday: number;
  /** 시간 세그먼트 목록 */
  segments: TimeSlotSegment[];
  /** 총 가용 시간 (분) */
  totalMinutes: number;
  /** 표시 시간 범위 */
  displayRange?: { start: string; end: string };
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 클래스명 */
  className?: string;
}

// ============================================
// 유틸리티 함수
// ============================================

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

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

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}분`;
  if (mins === 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

// ============================================
// 색상 매핑
// ============================================

const SEGMENT_COLORS: Record<TimeSlotType, string> = {
  study: "bg-green-400",
  "self-study": "bg-teal-300",
  lunch: "bg-gray-300",
  academy: "bg-orange-400",
  travel: "bg-orange-200",
  "non-study": "bg-gray-200",
  unavailable: "bg-gray-100",
};

const SEGMENT_LABELS: Record<TimeSlotType, string> = {
  study: "학습",
  "self-study": "자율학습",
  lunch: "점심",
  academy: "학원",
  travel: "이동",
  "non-study": "비학습",
  unavailable: "비가용",
};

// ============================================
// 컴포넌트
// ============================================

/**
 * 개별 타임라인 세그먼트 블록
 */
function SegmentBlock({
  segment,
  startMinutes,
  endMinutes,
  compact,
}: {
  segment: TimeSlotSegment;
  startMinutes: number;
  endMinutes: number;
  compact?: boolean;
}) {
  const segStart = timeToMinutes(segment.start);
  const segEnd = timeToMinutes(segment.end);

  const left = minutesToPercent(segStart, startMinutes, endMinutes);
  const width = minutesToPercent(segEnd, startMinutes, endMinutes) - left;

  // 너무 작은 세그먼트는 최소 너비 적용
  const minWidth = compact ? 0.5 : 1;
  const finalWidth = Math.max(width, minWidth);

  const colorClass = SEGMENT_COLORS[segment.type];
  const label = segment.label || SEGMENT_LABELS[segment.type];
  const duration = segEnd - segStart;

  return (
    <div
      className={cn(
        "absolute top-0 bottom-0 transition-opacity hover:opacity-80",
        colorClass,
        segment.type === "unavailable" && "opacity-50"
      )}
      style={{
        left: `${Math.max(0, left)}%`,
        width: `${Math.min(finalWidth, 100 - left)}%`,
      }}
      title={`${label} (${segment.start} ~ ${segment.end}, ${formatDuration(duration)})`}
    >
      {/* 세그먼트가 충분히 클 때만 레이블 표시 */}
      {width > 6 && !compact && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="text-[10px] text-gray-700 truncate px-0.5">
            {width > 12 ? label : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * 일별 타임라인 바 컴포넌트
 */
export function DayTimelineBar({
  weekday,
  segments,
  totalMinutes,
  displayRange = { start: "06:00", end: "24:00" },
  compact = false,
  className,
}: DayTimelineBarProps) {
  const startMinutes = timeToMinutes(displayRange.start);
  const endMinutes = timeToMinutes(displayRange.end);

  // 세그먼트를 시간순으로 정렬
  const sortedSegments = useMemo(() => {
    return [...segments].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );
  }, [segments]);

  // 학원 일정 여부 확인
  const hasAcademy = segments.some((s) => s.type === "academy");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* 요일 레이블 */}
      <div
        className={cn(
          "flex-shrink-0 font-medium text-gray-700",
          compact ? "w-6 text-xs" : "w-8 text-sm"
        )}
      >
        {WEEKDAY_LABELS[weekday]}
      </div>

      {/* 타임라인 바 */}
      <div
        className={cn(
          "flex-1 relative bg-gray-50 border border-gray-200 rounded overflow-hidden",
          compact ? "h-4" : "h-6"
        )}
      >
        {sortedSegments.map((segment, idx) => (
          <SegmentBlock
            key={`${segment.type}-${idx}`}
            segment={segment}
            startMinutes={startMinutes}
            endMinutes={endMinutes}
            compact={compact}
          />
        ))}
      </div>

      {/* 가용시간 표시 */}
      <div
        className={cn(
          "flex-shrink-0 text-right text-gray-600",
          compact ? "w-12 text-xs" : "w-16 text-sm"
        )}
      >
        {totalMinutes > 0 ? (
          <span className={hasAcademy ? "text-orange-600" : ""}>
            {Math.floor(totalMinutes / 60)}h{" "}
            {totalMinutes % 60 > 0 && `${totalMinutes % 60}m`}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </div>
    </div>
  );
}

export default DayTimelineBar;
