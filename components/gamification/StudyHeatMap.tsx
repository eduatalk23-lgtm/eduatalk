"use client";

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { StudentStudyHeatmap } from "@/lib/domains/gamification/types";

interface StudyHeatMapProps {
  data: StudentStudyHeatmap[];
  weeks?: number;
  className?: string;
  showLegend?: boolean;
  showLabels?: boolean;
}

const INTENSITY_COLORS = [
  "bg-gray-100", // 0 - no activity
  "bg-green-200", // 1 - light
  "bg-green-300", // 2 - medium
  "bg-green-500", // 3 - high
  "bg-green-700", // 4 - very high
];

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

export function StudyHeatMap({
  data,
  weeks = 13,
  className,
  showLegend = true,
  showLabels = true,
}: StudyHeatMapProps) {
  // Build heatmap grid
  const grid = useMemo(() => {
    const today = new Date();
    const dataMap = new Map(data.map((d) => [d.studyDate, d]));

    // Start from (weeks) weeks ago, aligned to Sunday
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (weeks * 7) + (7 - startDate.getDay()));

    const cells: Array<{
      date: string;
      intensity: number;
      minutes: number;
      plansCompleted: number;
      dayOfWeek: number;
      weekIndex: number;
      isToday: boolean;
      isFuture: boolean;
    }> = [];

    const todayStr = today.toISOString().split("T")[0];

    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + w * 7 + d);
        const dateStr = currentDate.toISOString().split("T")[0];
        const heatmapData = dataMap.get(dateStr);
        const isFuture = currentDate > today;

        cells.push({
          date: dateStr,
          intensity: heatmapData?.intensityLevel ?? 0,
          minutes: heatmapData?.totalMinutes ?? 0,
          plansCompleted: heatmapData?.plansCompleted ?? 0,
          dayOfWeek: d,
          weekIndex: w,
          isToday: dateStr === todayStr,
          isFuture,
        });
      }
    }

    return cells;
  }, [data, weeks]);

  // Get month labels with positions
  const monthLabels = useMemo(() => {
    const labels: Array<{ month: number; weekIndex: number }> = [];
    let lastMonth = -1;

    grid.forEach((cell) => {
      if (cell.dayOfWeek === 0) {
        const cellDate = new Date(cell.date);
        const month = cellDate.getMonth();
        if (month !== lastMonth) {
          labels.push({ month, weekIndex: cell.weekIndex });
          lastMonth = month;
        }
      }
    });

    return labels;
  }, [grid]);

  const formatTooltip = (cell: typeof grid[0]) => {
    const date = new Date(cell.date);
    const dateStr = date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (cell.isFuture) return dateStr;
    if (cell.minutes === 0) return `${dateStr}\n학습 기록 없음`;
    return `${dateStr}\n${cell.minutes}분 학습\n${cell.plansCompleted}개 플랜 완료`;
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Month labels */}
      {showLabels && (
        <div className="flex text-xs text-gray-400 ml-8">
          {monthLabels.map(({ month, weekIndex }, i) => (
            <div
              key={i}
              className="absolute"
              style={{ marginLeft: `${weekIndex * 14 + 32}px` }}
            >
              {MONTH_LABELS[month]}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1">
        {/* Weekday labels */}
        {showLabels && (
          <div className="flex flex-col gap-[2px] text-xs text-gray-400 pr-1">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={i}
                className="h-3 flex items-center justify-end"
                style={{ visibility: i % 2 === 1 ? "visible" : "hidden" }}
              >
                {label}
              </div>
            ))}
          </div>
        )}

        {/* Heatmap grid */}
        <div
          className="grid gap-[2px]"
          style={{
            gridTemplateColumns: `repeat(${weeks}, 12px)`,
            gridTemplateRows: "repeat(7, 12px)",
          }}
        >
          {grid.map((cell, i) => (
            <div
              key={i}
              className={cn(
                "w-3 h-3 rounded-sm transition-all duration-200",
                cell.isFuture
                  ? "bg-gray-50 cursor-default"
                  : INTENSITY_COLORS[cell.intensity],
                cell.isToday && "ring-2 ring-blue-500 ring-offset-1",
                !cell.isFuture && "cursor-pointer hover:ring-1 hover:ring-gray-400"
              )}
              style={{
                gridColumn: cell.weekIndex + 1,
                gridRow: cell.dayOfWeek + 1,
              }}
              title={formatTooltip(cell)}
            />
          ))}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-end gap-2 text-xs text-gray-500 mt-1">
          <span>적음</span>
          {INTENSITY_COLORS.map((color, i) => (
            <div key={i} className={cn("w-3 h-3 rounded-sm", color)} />
          ))}
          <span>많음</span>
        </div>
      )}
    </div>
  );
}
