"use client";

/**
 * 날짜 플랜 오버플로 팝오버
 *
 * 월간뷰에서 "+N개 더" 클릭 시 해당 날짜의 전체 플랜 목록을 표시
 * createPortal로 body에 렌더하여 셀 overflow 탈출
 */

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { X, ArrowRight } from "lucide-react";

import { cn } from "@/lib/cn";
import DraggableAdminPlanCard from "./DraggableAdminPlanCard";
import type { CalendarPlan, DayCellStats } from "./_types/adminCalendar";

interface DayPlanPopoverProps {
  /** 날짜 문자열 (yyyy-MM-dd) */
  date: string;
  /** 해당 날짜의 전체 플랜 목록 */
  plans: CalendarPlan[];
  /** 날짜 통계 */
  stats: DayCellStats;
  /** "+N개 더" 버튼의 위치 */
  anchorRect: DOMRect;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 플랜 클릭 콜백 (GCal 팝오버용) */
  onPlanClick: (plan: CalendarPlan, anchorRect: DOMRect) => void;
  /** 날짜 클릭 콜백 (일일뷰 전환) */
  onDateClick: (dateStr: string) => void;
  /** 캘린더별 색상 맵 (calendarId → hex) */
  calendarColorMap?: Map<string, string>;
}

/** 팝오버 너비/최대 높이 */
const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 360;
const POPOVER_GAP = 6;

export default function DayPlanPopover({
  date,
  plans,
  stats,
  anchorRect,
  onClose,
  onPlanClick,
  onDateClick,
  calendarColorMap,
}: DayPlanPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // 위치 계산: useLayoutEffect로 페인트 전에 계산하여 깜빡임 방지
  useLayoutEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 가로 위치: 앵커 중앙 정렬, 뷰포트 벗어나면 조정
    let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
    if (left + POPOVER_WIDTH > vw - 8) left = vw - POPOVER_WIDTH - 8;
    if (left < 8) left = 8;

    // 세로 위치: 아래가 기본, 공간 부족하면 위로
    const spaceBelow = vh - anchorRect.bottom - POPOVER_GAP;
    const spaceAbove = anchorRect.top - POPOVER_GAP;

    let top: number;
    if (spaceBelow >= POPOVER_MAX_HEIGHT || spaceBelow >= spaceAbove) {
      top = anchorRect.bottom + POPOVER_GAP;
    } else {
      top = anchorRect.top - POPOVER_GAP - Math.min(POPOVER_MAX_HEIGHT, spaceAbove);
    }

    setPosition({ top, left });
  }, [anchorRect]);

  // 외부 클릭 닫기
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // ESC 키 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // 날짜 포맷: "2월 22일 (토)"
  const dateObj = new Date(date + "T00:00:00");
  const dateLabel = format(dateObj, "M월 d일 (E)", { locale: ko });

  const handleDateClick = useCallback(() => {
    onClose();
    onDateClick(date);
  }, [onClose, onDateClick, date]);

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
        zIndex: 50,
        visibility: position ? "visible" : "hidden",
      }}
      className="bg-[rgb(var(--color-secondary-50))] rounded-lg shadow-xl border border-[rgb(var(--color-secondary-200))] flex flex-col overflow-hidden animate-in fade-in-0 duration-150"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[rgb(var(--color-secondary-100))]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{dateLabel}</span>
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded font-medium",
            stats.completionRate === 100
              ? "bg-green-100 text-green-700"
              : "bg-[rgb(var(--color-secondary-100))] text-[var(--text-secondary)]"
          )}>
            {stats.completedPlans}/{stats.totalPlans} 완료
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 플랜 목록 (스크롤) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {plans.map((plan) => (
          <DraggableAdminPlanCard
            key={plan.id}
            plan={plan}
            onClick={(e) => onPlanClick(plan, (e.target as HTMLElement).closest('[data-plan-chip]')?.getBoundingClientRect() ?? (e.currentTarget as HTMLElement).getBoundingClientRect())}
            disabled
            calendarColor={calendarColorMap?.get(plan.calendar_id ?? '')}
          />
        ))}
      </div>

      {/* 푸터 */}
      <div className="border-t border-[rgb(var(--color-secondary-100))] px-3 py-2">
        <button
          type="button"
          onClick={handleDateClick}
          className="w-full flex items-center justify-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-medium py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:bg-blue-900/20 transition-colors"
        >
          자세히 보기
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>,
    document.body
  );
}
