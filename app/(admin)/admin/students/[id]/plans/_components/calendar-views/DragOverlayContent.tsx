"use client";

/**
 * 드래그 오버레이 콘텐츠 — Google Calendar 스타일
 *
 * 드래그 중인 이벤트를 원래 셀 칩과 동일한 형태로 표시합니다.
 * - 원래 이벤트와 같은 색상/크기의 compact chip
 * - drop shadow로 "떠 있는" 느낌
 * - 드롭 불가 시 미니 배지로 표시 (카드 UI 아님)
 */

import { cn } from "@/lib/cn";
import { Ban, Check } from "lucide-react";
import { resolveCalendarColors } from "../utils/subjectColors";
import { formatTimeKoAmPm } from "../utils/timeGridUtils";
import type {
  DraggableAdminPlanData,
  DroppableTargetData,
} from "./_types/adminCalendar";

interface DragOverlayContentProps {
  /** 드래그 중인 플랜 데이터 */
  plan: DraggableAdminPlanData;
  /** 현재 오버 중인 드롭 타겟 (없으면 null) */
  overTarget: DroppableTargetData | null;
  /** 드롭 가능 여부 체크 함수 */
  canDropOnDate: (date: string) => boolean;
  /** 서버 저장 중 여부 */
  isPending?: boolean;
}

export default function DragOverlayContent({
  plan,
  overTarget,
  canDropOnDate,
  isPending = false,
}: DragOverlayContentProps) {
  const isOverValidTarget = overTarget && canDropOnDate(overTarget.date);
  const isOverInvalidTarget = overTarget && !canDropOnDate(overTarget.date);

  const isCompleted = plan.status === "completed";
  const colors = resolveCalendarColors(plan.color, plan.calendarColor, plan.status || "pending", isCompleted);

  const timeLabel = plan.originalStartTime
    ? formatTimeKoAmPm(plan.originalStartTime)
    : null;

  return (
    <div className="relative">
      {/* Google Calendar 스타일 chip — 원래 셀 칩과 동일한 형태 */}
      <div
        className={cn(
          "flex items-center gap-1 rounded-md text-xs overflow-hidden relative",
          "pl-2 pr-1.5 py-0.5 min-w-[100px] max-w-[200px]",
          "shadow-xl cursor-grabbing select-none",
          colors.textIsWhite ? "text-white" : "text-gray-900",
          // 드롭 상태 피드백 (미니멀)
          isOverValidTarget && "ring-2 ring-green-400",
          isOverInvalidTarget && "ring-2 ring-red-400 opacity-70",
          isPending && "ring-2 ring-blue-400",
        )}
        style={{
          backgroundColor: colors.bgHex,
          opacity: colors.opacity,
          borderLeft: `4px solid ${colors.barHex}`,
        }}
      >
        {timeLabel && (
          <span className="flex-shrink-0 tabular-nums opacity-70">{timeLabel}</span>
        )}
        {isCompleted && (
          <Check className={cn("w-3 h-3 flex-shrink-0", colors.textIsWhite ? "text-white/80" : "text-green-600")} />
        )}
        <span className={cn("truncate", colors.strikethrough && "line-through")}>
          {plan.title}
        </span>
      </div>

      {/* 드롭 불가 배지 — 최소한의 피드백 */}
      {isOverInvalidTarget && (
        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
          <Ban className="w-3 h-3" />
          <span>이동 불가</span>
        </div>
      )}
    </div>
  );
}
