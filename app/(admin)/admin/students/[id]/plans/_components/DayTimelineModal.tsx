"use client";

import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import type { TimeSlot } from "@/lib/types/plan-generation";

interface DayTimelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  timeSlots: TimeSlot[];
}

/**
 * 시간대 유형별 색상 및 아이콘 매핑
 */
const slotConfig: Record<string, { bg: string; text: string; icon: string }> = {
  학습시간: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700", icon: "📚" },
  점심시간: { bg: "bg-orange-100", text: "text-orange-700", icon: "🍱" },
  학원일정: { bg: "bg-purple-100", text: "text-purple-700", icon: "🏫" },
  이동시간: { bg: "bg-teal-100", text: "text-teal-700", icon: "🚌" },
  자율학습: { bg: "bg-green-100", text: "text-green-700", icon: "📖" },
};

/**
 * 시간대 유형별 바 색상
 */
const slotBarColors: Record<string, string> = {
  학습시간: "bg-blue-500",
  점심시간: "bg-orange-400",
  학원일정: "bg-purple-500",
  이동시간: "bg-teal-400",
  자율학습: "bg-green-500",
};

/**
 * 날짜 포맷팅 (YYYY-MM-DD → M월 D일 (요일))
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

/**
 * HH:mm 형식의 시간을 분 단위로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 날짜별 상세 타임라인 모달
 *
 * 각 시간대별 시작/종료 시간, 유형, 라벨을 시각적으로 표시합니다.
 */
export function DayTimelineModal({
  isOpen,
  onClose,
  date,
  timeSlots,
}: DayTimelineModalProps) {
  // 시간 순으로 정렬
  const sortedSlots = useMemo(() => {
    if (!timeSlots || timeSlots.length === 0) return [];
    return [...timeSlots].sort(
      (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
    );
  }, [timeSlots]);

  // 타임라인 바 계산 (06:00 ~ 24:00)
  const dayStart = 6 * 60;
  const dayEnd = 24 * 60;
  const totalMinutes = dayEnd - dayStart;

  const timelineSegments = useMemo(() => {
    return sortedSlots
      .map((slot) => {
        const startMinutes = Math.max(timeToMinutes(slot.start), dayStart);
        const endMinutes = Math.min(timeToMinutes(slot.end), dayEnd);

        if (startMinutes >= dayEnd || endMinutes <= dayStart) return null;

        const left = ((startMinutes - dayStart) / totalMinutes) * 100;
        const width = ((endMinutes - startMinutes) / totalMinutes) * 100;

        return {
          type: slot.type,
          left: `${left}%`,
          width: `${Math.max(width, 1)}%`,
          color: slotBarColors[slot.type] ?? "bg-gray-400",
        };
      })
      .filter(Boolean);
  }, [sortedSlots, dayStart, dayEnd, totalMinutes]);

  // 유형별 총 시간 계산
  const summaryByType = useMemo(() => {
    const summary: Record<string, number> = {};
    sortedSlots.forEach((slot) => {
      const duration = timeToMinutes(slot.end) - timeToMinutes(slot.start);
      summary[slot.type] = (summary[slot.type] ?? 0) + duration;
    });
    return summary;
  }, [sortedSlots]);

  const titleText = date ? `${formatDate(date)} 일정` : "일정";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={titleText}
      maxWidth="lg"
    >
      <DialogContent>
        <div className="space-y-6">
          {/* 타임라인 바 */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
            <div className="relative h-6 bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden">
              {timelineSegments.map((segment, index) => (
                <div
                  key={`bar-${index}`}
                  className={cn("absolute top-0 h-full", segment?.color)}
                  style={{
                    left: segment?.left,
                    width: segment?.width,
                  }}
                />
              ))}
            </div>
          </div>

          {/* 상세 일정 목록 */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sortedSlots.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                등록된 일정이 없습니다.
              </p>
            ) : (
              sortedSlots.map((slot, index) => {
                const config = slotConfig[slot.type] ?? {
                  bg: "bg-gray-100 dark:bg-gray-800",
                  text: "text-gray-700 dark:text-gray-300",
                  icon: "📌",
                };
                return (
                  <div
                    key={`slot-${index}`}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      config.bg
                    )}
                  >
                    <span className="text-xl">{config.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className={cn("font-medium", config.text)}>
                        {slot.type}
                        {slot.label && (
                          <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                            ({slot.label})
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {slot.start} - {slot.end}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 요약 (유형별 총 시간) */}
          {Object.keys(summaryByType).length > 0 && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">요약</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summaryByType).map(([type, minutes]) => {
                  const config = slotConfig[type] ?? {
                    bg: "bg-gray-100 dark:bg-gray-800",
                    text: "text-gray-700 dark:text-gray-300",
                    icon: "📌",
                  };
                  const hours = Math.floor(minutes / 60);
                  const mins = minutes % 60;
                  return (
                    <span
                      key={type}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs",
                        config.bg,
                        config.text
                      )}
                    >
                      {config.icon} {type}: {hours > 0 ? `${hours}시간 ` : ""}
                      {mins > 0 ? `${mins}분` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 범례 */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">범례</h4>
            <div className="flex flex-wrap gap-3 text-xs">
              {Object.entries(slotBarColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className={cn("w-3 h-3 rounded-sm", color)} />
                  <span className="text-gray-600 dark:text-gray-400">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
