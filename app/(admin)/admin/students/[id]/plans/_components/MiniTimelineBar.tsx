"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import type { TimeSlot } from "@/lib/types/plan-generation";

interface MiniTimelineBarProps {
  timeSlots: TimeSlot[];
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  /** 툴팁 비활성화 여부 */
  disableTooltip?: boolean;
}

/**
 * 시간대 유형별 색상 매핑
 */
const slotColors: Record<string, string> = {
  학습시간: "bg-blue-500",
  점심시간: "bg-orange-400",
  학원일정: "bg-purple-500",
  이동시간: "bg-teal-400",
  자율학습: "bg-green-500",
};

/**
 * 시간대 유형별 텍스트 색상 (툴팁용)
 */
const slotTextColors: Record<string, string> = {
  학습시간: "text-blue-600",
  점심시간: "text-orange-500",
  학원일정: "text-purple-600",
  이동시간: "text-teal-500",
  자율학습: "text-green-600",
};

/**
 * 시간대 유형별 dot 색상 (툴팁용)
 */
const slotDotColors: Record<string, string> = {
  학습시간: "bg-blue-500",
  점심시간: "bg-orange-400",
  학원일정: "bg-purple-500",
  이동시간: "bg-teal-400",
  자율학습: "bg-green-500",
};

/**
 * HH:mm 형식의 시간을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간:분 형식으로 변환
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) {
    return `${hours}시간 ${mins}분`;
  } else if (hours > 0) {
    return `${hours}시간`;
  }
  return `${mins}분`;
}

/**
 * 툴팁 콘텐츠 컴포넌트
 */
function TimelineTooltipContent({ timeSlots }: { timeSlots: TimeSlot[] }) {
  // 시간대별로 그룹화하여 총 시간 계산
  const summary = useMemo(() => {
    const typeMinutes: Record<string, number> = {};

    timeSlots.forEach((slot) => {
      const duration = timeToMinutes(slot.end) - timeToMinutes(slot.start);
      typeMinutes[slot.type] = (typeMinutes[slot.type] || 0) + duration;
    });

    return Object.entries(typeMinutes).map(([type, minutes]) => ({
      type,
      totalMinutes: minutes,
    }));
  }, [timeSlots]);

  // 시작 시간 순으로 정렬
  const sortedSlots = useMemo(() => {
    return [...timeSlots].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );
  }, [timeSlots]);

  return (
    <div className="space-y-2 min-w-[180px]">
      {/* 헤더 */}
      <div className="font-medium text-xs border-b border-gray-600 pb-1.5 mb-1.5">
        일일 시간표
      </div>

      {/* 시간대 목록 */}
      <div className="space-y-1">
        {sortedSlots.map((slot, index) => (
          <div key={`${slot.type}-${index}`} className="flex items-center gap-2 text-xs">
            <span
              className={cn("w-2 h-2 rounded-full flex-shrink-0", slotDotColors[slot.type] ?? "bg-gray-400")}
            />
            <span className="flex-1 truncate">
              {slot.label || slot.type}
            </span>
            <span className="text-gray-400 tabular-nums">
              {slot.start}~{slot.end}
            </span>
          </div>
        ))}
      </div>

      {/* 요약 (총 시간) */}
      {summary.length > 0 && (
        <div className="border-t border-gray-600 pt-1.5 mt-1.5 space-y-0.5">
          {summary.map(({ type, totalMinutes }) => (
            <div key={type} className="flex items-center justify-between text-xs">
              <span className={cn("flex items-center gap-1", slotTextColors[type])}>
                <span
                  className={cn("w-1.5 h-1.5 rounded-full", slotDotColors[type] ?? "bg-gray-400")}
                />
                {type}
              </span>
              <span className="text-gray-300">{formatDuration(totalMinutes)}</span>
            </div>
          ))}
        </div>
      )}

      {/* 클릭 안내 */}
      <div className="text-[10px] text-gray-500 pt-1">
        클릭하여 상세 보기
      </div>
    </div>
  );
}

/**
 * WeeklyCalendar 날짜 셀 내 소형 타임라인 바
 *
 * 각 시간대 유형별로 색상 막대를 표시하며,
 * 호버 시 상세 툴팁을, 클릭 시 상세 모달을 열 수 있습니다.
 */
export function MiniTimelineBar({
  timeSlots,
  onClick,
  className,
  disableTooltip = false,
}: MiniTimelineBarProps) {
  // 타임라인 계산 (하루 기준 06:00 ~ 24:00, 총 18시간)
  const dayStart = 6 * 60; // 06:00 = 360분
  const dayEnd = 24 * 60; // 24:00 = 1440분
  const totalMinutes = dayEnd - dayStart; // 1080분

  const segments = useMemo(() => {
    if (!timeSlots || timeSlots.length === 0) return [];

    return timeSlots
      .map((slot) => {
        const startMinutes = Math.max(timeToMinutes(slot.start), dayStart);
        const endMinutes = Math.min(timeToMinutes(slot.end), dayEnd);

        // 범위를 벗어나면 제외
        if (startMinutes >= dayEnd || endMinutes <= dayStart) return null;

        const left = ((startMinutes - dayStart) / totalMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

        return {
          type: slot.type,
          left: `${left}%`,
          width: `${Math.max(width, 2)}%`, // 최소 너비 2%
          color: slotColors[slot.type] ?? "bg-gray-400",
        };
      })
      .filter(Boolean);
  }, [timeSlots, dayStart, dayEnd, totalMinutes]);

  if (segments.length === 0) return null;

  const barContent = (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent);
        }
      }}
      className={cn(
        "relative w-full h-2 bg-gray-100 rounded-sm overflow-hidden",
        "hover:ring-2 hover:ring-blue-300 hover:ring-offset-1",
        "transition-all cursor-pointer",
        className
      )}
      aria-label="시간대 상세 보기"
    >
      {segments.map((segment, index) => (
        <div
          key={`${segment?.type}-${index}`}
          className={cn(
            "absolute top-0 h-full rounded-sm",
            segment?.color
          )}
          style={{
            left: segment?.left,
            width: segment?.width,
          }}
        />
      ))}
    </div>
  );

  // 툴팁 비활성화 시 바만 렌더링
  if (disableTooltip) {
    return barContent;
  }

  return (
    <Tooltip
      content={<TimelineTooltipContent timeSlots={timeSlots} />}
      position="top"
      variant="dark"
      size="sm"
      delay={300}
      interactive
      hideDelay={100}
      maxWidth={280}
    >
      {barContent}
    </Tooltip>
  );
}
