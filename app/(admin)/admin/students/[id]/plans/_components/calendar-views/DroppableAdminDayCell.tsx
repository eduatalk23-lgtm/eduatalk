"use client";

/**
 * 드롭 가능한 관리자 캘린더 날짜 셀
 *
 * @dnd-kit/core의 useDroppable을 사용하여 드롭 영역 제공
 * React.memo로 메모이제이션하여 불필요한 리렌더링 방지
 */

import { memo, useCallback } from "react";
import { useDroppable } from "@dnd-kit/core";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/cn";
import { useAdminCalendarDrag } from "./_context/AdminCalendarDragContext";
import DraggableAdminPlanCard from "./DraggableAdminPlanCard";
import { formatTimeKoAmPm } from "../utils/timeGridUtils";
import type { EmptySlot } from "@/lib/domains/admin-plan/utils/emptySlotCalculation";
import type {
  CalendarPlan,
  DayCellStatus,
  DayCellStats,
  DroppableTargetData,
} from "./_types/adminCalendar";

interface DroppableAdminDayCellProps {
  date: Date;
  status: DayCellStatus;
  stats: DayCellStats;
  plans: CalendarPlan[];
  /** 날짜 클릭 핸들러 - dateStr(yyyy-MM-dd)을 인자로 받음 */
  onDateClick: (dateStr: string) => void;
  /** 플랜 클릭 핸들러 */
  onPlanClick: (planId: string) => void;
  /** 컨텍스트 메뉴 핸들러 - 이벤트와 dateStr을 인자로 받음 */
  onContextMenu: (e: React.MouseEvent, dateStr: string) => void;
  /** 선택 모드 활성화 여부 */
  isSelectionMode?: boolean;
  /** 선택된 플랜 ID Set */
  selectedPlanIds?: Set<string>;
  /** 플랜 선택 토글 콜백 */
  onPlanSelect?: (planId: string, shiftKey: boolean) => void;
  /** 검색 하이라이트된 플랜 ID Set */
  highlightedPlanIds?: Set<string>;
  /** 오버플로 "+N개 더" 클릭 핸들러 (팝오버용) */
  onOverflowClick?: (dateStr: string, plans: CalendarPlan[], stats: DayCellStats, anchorRect: DOMRect) => void;
  /** 빈 영역 클릭 또는 "+" 클릭 → 퀵생성 */
  onQuickCreate?: (dateStr: string, anchorRect: DOMRect) => void;
  /** 현재 이 셀이 퀵생성 타겟인지 (팝오버가 열려있는 날짜) */
  isQuickCreateTarget?: boolean;
  /** 퀵생성 프리뷰용 슬롯 정보 */
  quickCreateSlot?: EmptySlot | null;
  /** 퀵생성이 종일 모드인지 */
  isQuickCreateAllDay?: boolean;
}

/**
 * DayCell 비교 함수
 * 날짜, 상태, 통계, 플랜 목록 비교하여 불필요한 리렌더링 방지
 * (콜백 함수는 부모에서 메모이제이션되어야 함)
 */
function arePropsEqual(
  prevProps: DroppableAdminDayCellProps,
  nextProps: DroppableAdminDayCellProps
): boolean {
  // 날짜 비교 (시간값)
  if (prevProps.date.getTime() !== nextProps.date.getTime()) return false;

  // status 비교
  const prevStatus = prevProps.status;
  const nextStatus = nextProps.status;
  if (
    prevStatus.isToday !== nextStatus.isToday ||
    prevStatus.isCurrentMonth !== nextStatus.isCurrentMonth ||
    prevStatus.isSelected !== nextStatus.isSelected ||
    prevStatus.isExclusion !== nextStatus.isExclusion ||
    prevStatus.exclusionType !== nextStatus.exclusionType ||
    prevStatus.exclusionReason !== nextStatus.exclusionReason ||
    prevStatus.weekNumber !== nextStatus.weekNumber ||
    prevStatus.cycleDayNumber !== nextStatus.cycleDayNumber ||
    prevStatus.dayType !== nextStatus.dayType
  ) {
    return false;
  }

  // stats 비교
  const prevStats = prevProps.stats;
  const nextStats = nextProps.stats;
  if (
    prevStats.totalPlans !== nextStats.totalPlans ||
    prevStats.completedPlans !== nextStats.completedPlans ||
    prevStats.completionRate !== nextStats.completionRate ||
    // Phase 4: 시간대 유형별 통계 비교
    prevStats.studySlotPlans !== nextStats.studySlotPlans ||
    prevStats.selfStudySlotPlans !== nextStats.selfStudySlotPlans ||
    prevStats.noSlotPlans !== nextStats.noSlotPlans
  ) {
    return false;
  }

  // plans 비교 (길이와 각 플랜의 주요 속성)
  if (prevProps.plans.length !== nextProps.plans.length) return false;
  for (let i = 0; i < prevProps.plans.length; i++) {
    const prev = prevProps.plans[i];
    const next = nextProps.plans[i];
    if (
      prev.id !== next.id ||
      prev.status !== next.status ||
      prev.custom_title !== next.custom_title ||
      prev.content_title !== next.content_title
    ) {
      return false;
    }
  }

  // 선택 모드 비교
  if (prevProps.isSelectionMode !== nextProps.isSelectionMode) return false;

  // 선택된 플랜 ID 비교 (Set 비교)
  const prevSelected = prevProps.selectedPlanIds;
  const nextSelected = nextProps.selectedPlanIds;
  if (prevSelected !== nextSelected) {
    // 둘 다 undefined가 아니면 내용 비교
    if (prevSelected && nextSelected) {
      if (prevSelected.size !== nextSelected.size) return false;
      // 현재 셀의 플랜만 선택 상태 비교
      for (const plan of prevProps.plans) {
        if (prevSelected.has(plan.id) !== nextSelected.has(plan.id)) {
          return false;
        }
      }
    } else {
      // 한쪽만 undefined면 다름
      return false;
    }
  }

  // 검색 하이라이트 비교 (현재 셀의 플랜만)
  const prevHighlighted = prevProps.highlightedPlanIds;
  const nextHighlighted = nextProps.highlightedPlanIds;
  if (prevHighlighted !== nextHighlighted) {
    if (prevHighlighted && nextHighlighted) {
      for (const plan of prevProps.plans) {
        if (prevHighlighted.has(plan.id) !== nextHighlighted.has(plan.id)) {
          return false;
        }
      }
    } else {
      return false;
    }
  }

  // onOverflowClick, onQuickCreate 참조 비교
  if (prevProps.onOverflowClick !== nextProps.onOverflowClick) return false;
  if (prevProps.onQuickCreate !== nextProps.onQuickCreate) return false;

  // 퀵생성 타겟 비교
  if (prevProps.isQuickCreateTarget !== nextProps.isQuickCreateTarget) return false;

  // 퀵생성 슬롯 비교
  const prevSlot = prevProps.quickCreateSlot;
  const nextSlot = nextProps.quickCreateSlot;
  if (prevSlot !== nextSlot) {
    if (!prevSlot || !nextSlot) return false;
    if (prevSlot.startTime !== nextSlot.startTime || prevSlot.endTime !== nextSlot.endTime) return false;
  }

  // 퀵생성 종일 모드 비교
  if (prevProps.isQuickCreateAllDay !== nextProps.isQuickCreateAllDay) return false;

  return true;
}

function DroppableAdminDayCellComponent({
  date,
  status,
  stats,
  plans,
  onDateClick,
  onPlanClick,
  onContextMenu,
  isSelectionMode = false,
  selectedPlanIds,
  onPlanSelect,
  highlightedPlanIds,
  onOverflowClick,
  onQuickCreate,
  isQuickCreateTarget,
  quickCreateSlot,
  isQuickCreateAllDay,
}: DroppableAdminDayCellProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayOfWeek = date.getDay();

  // 드롭 타겟 데이터
  const dropData: DroppableTargetData = {
    date: dateStr,
    isExclusion: status.isExclusion,
  };

  const { isDragging, canDropOnDate } = useAdminCalendarDrag();

  const { setNodeRef, isOver } = useDroppable({
    id: `day-${dateStr}`,
    data: dropData,
    disabled: status.isExclusion,
  });

  // 드롭 가능 여부
  const canDrop = canDropOnDate(dateStr);
  const showDropIndicator = isDragging && !status.isExclusion;
  const showInvalidDrop = isDragging && status.isExclusion;

  // 검색 하이라이트: 이 셀에 매칭 플랜이 있는지
  const hasHighlightedPlan = highlightedPlanIds
    ? plans.some((p) => highlightedPlanIds.has(p.id))
    : false;

  // 셀 빈 영역 클릭 핸들러 (퀵생성 또는 날짜 선택)
  const handleCellClick = useCallback(
    (e: React.MouseEvent) => {
      // 플랜 칩, 날짜 숫자, "+" 버튼, 오버플로 버튼 클릭은 각자 핸들러에서 처리
      if (
        (e.target as HTMLElement).closest('[data-plan-chip]') ||
        (e.target as HTMLElement).closest('[data-date-number]') ||
        (e.target as HTMLElement).closest('[data-quick-create-btn]') ||
        (e.target as HTMLElement).closest('[data-overflow-btn]')
      ) return;

      if (onQuickCreate && status.isCurrentMonth && !status.isExclusion) {
        onQuickCreate(dateStr, e.currentTarget.getBoundingClientRect());
      } else {
        onDateClick(dateStr);
      }
    },
    [onDateClick, dateStr, onQuickCreate, status.isCurrentMonth, status.isExclusion],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu(e, dateStr);
    },
    [onContextMenu, dateStr]
  );

  return (
    <div
      ref={setNodeRef}
      onClick={handleCellClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "group/cell relative bg-white p-1.5 min-h-[90px] cursor-pointer transition-colors",
        // 기본 상태별 배경 및 호버
        !status.isCurrentMonth && "bg-gray-50 hover:bg-gray-100",
        status.isCurrentMonth && !status.isExclusion && !status.isSelected && "hover:bg-blue-50/40",
        // 선택된 날짜 - 에메랄드로 오늘(파랑)과 구분
        status.isSelected && "ring-2 ring-emerald-500 ring-inset bg-emerald-50/30 hover:bg-emerald-50/60",
        // 제외일
        status.isExclusion && "bg-gray-100 hover:bg-gray-200",
        // 퀵생성 타겟 셀 (팝오버 열려있는 날짜)
        isQuickCreateTarget && "ring-2 ring-blue-400 ring-inset bg-blue-50/40",
        // 검색 하이라이트 셀 배경
        hasHighlightedPlan && "bg-yellow-50/60",
        // 드롭 관련 스타일 - 펄스 애니메이션 추가
        showDropIndicator && canDrop && "ring-2 ring-dashed ring-blue-300 animate-pulse",
        isOver && canDrop && "bg-blue-50 ring-2 ring-blue-500 animate-none",
        showInvalidDrop && "bg-red-50 cursor-not-allowed",
        isOver && !canDrop && "bg-red-100"
      )}
    >
      {/* 날짜 숫자 + "+" 퀵생성 버튼 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-date-number
            onClick={(e) => { e.stopPropagation(); onDateClick(dateStr); }}
            className={cn(
              "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full hover:ring-1 hover:ring-gray-300 transition-shadow",
              !status.isCurrentMonth && "text-gray-400",
              status.isToday && "bg-blue-600 text-white hover:ring-blue-400",
              dayOfWeek === 0 &&
                status.isCurrentMonth &&
                !status.isToday &&
                "text-red-500",
              dayOfWeek === 6 &&
                status.isCurrentMonth &&
                !status.isToday &&
                "text-blue-500"
            )}
          >
            {format(date, "d")}
          </button>

          {/* 주차/일차 정보 (학습일/복습일인 경우에만) */}
          {status.weekNumber != null && status.cycleDayNumber != null && (
            <span className="text-[9px] text-gray-400">
              {status.weekNumber}주{status.cycleDayNumber}일
            </span>
          )}
        </div>

        {/* "+" 퀵생성 버튼 (호버 시 표시) + 제외일/날짜 타입 + 완료 뱃지 */}
        <div className="flex items-center gap-0.5">
          {onQuickCreate && status.isCurrentMonth && !status.isExclusion && (
            <button
              type="button"
              data-quick-create-btn
              className="w-5 h-5 rounded-full
                bg-gray-100 text-gray-500 text-xs leading-none
                flex items-center justify-center
                opacity-0 group-hover/cell:opacity-100
                transition-opacity hover:bg-blue-500 hover:text-white z-10"
              onClick={(e) => {
                e.stopPropagation();
                onQuickCreate(dateStr, e.currentTarget.getBoundingClientRect());
              }}
            >
              +
            </button>
          )}
          {status.isExclusion ? (
            <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
              {status.exclusionType}
            </span>
          ) : status.dayType === "복습일" ? (
            <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium">
              R
            </span>
          ) : null}
          {stats.totalPlans > 0 && !status.isExclusion && (
            <span className={cn(
              "text-[9px] px-1 py-0.5 rounded font-medium",
              stats.completionRate === 100
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            )}>
              {stats.completedPlans}/{stats.totalPlans}
            </span>
          )}
        </div>
      </div>

      {/* 드래그 중 드롭 불가 표시 - shake 애니메이션 */}
      <AnimatePresence>
        {showInvalidDrop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              x: [0, -3, 3, -3, 3, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.15 },
              x: { duration: 0.4, repeat: Infinity, repeatDelay: 0.3 }
            }}
            className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded z-10"
          >
            <span className="text-xs text-red-500 font-medium">제외일</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 플랜 칩 목록 */}
      {stats.totalPlans > 0 && !status.isExclusion && (
        <div className="space-y-0.5">
          {plans.slice(0, 4).map((plan) => (
            <div key={plan.id} data-plan-chip>
              <DraggableAdminPlanCard
                plan={plan}
                onClick={() => onPlanClick(plan.id)}
                disabled={isSelectionMode}
                isSelectionMode={isSelectionMode}
                isSelected={selectedPlanIds?.has(plan.id) ?? false}
                onSelect={onPlanSelect}
                isHighlighted={highlightedPlanIds?.has(plan.id) ?? false}
              />
            </div>
          ))}
          {plans.length > 4 && (
            <button
              type="button"
              data-overflow-btn
              onClick={(e) => {
                e.stopPropagation();
                if (onOverflowClick) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOverflowClick(dateStr, plans, stats, rect);
                } else {
                  onDateClick(dateStr);
                }
              }}
              className="text-xs text-blue-600 hover:underline pl-1"
            >
              +{plans.length - 4}개 더
            </button>
          )}

          {/* 완료율 프로그레스 바 */}
          {stats.completionRate > 0 && stats.completionRate < 100 && (
            <div className="h-0.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${stats.completionRate}%` }}
              />
            </div>
          )}
          {stats.completionRate === 100 && (
            <div className="h-0.5 bg-green-500 rounded-full mt-1" />
          )}
        </div>
      )}

      {/* 퀵생성 프리뷰 칩 (Google Calendar 스타일) */}
      {isQuickCreateTarget && (quickCreateSlot || isQuickCreateAllDay) && (
        <div className="flex items-center gap-1 px-1 py-px text-xs rounded border-2 border-dashed border-blue-400 bg-blue-500/15 animate-in fade-in-0 duration-150">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
          {isQuickCreateAllDay ? (
            <span className="text-blue-700 font-medium truncate">(제목 없음) 종일</span>
          ) : quickCreateSlot ? (
            <>
              <span className="text-blue-600/70 flex-shrink-0 tabular-nums text-[10px]">
                {formatTimeKoAmPm(quickCreateSlot.startTime)}
              </span>
              <span className="text-blue-700 font-medium truncate">(제목 없음)</span>
            </>
          ) : null}
        </div>
      )}

      {/* 제외일 사유 */}
      {status.isExclusion && status.exclusionReason && (
        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
          {status.exclusionReason}
        </p>
      )}
    </div>
  );
}

/**
 * 메모이제이션된 드롭 가능한 관리자 날짜 셀
 * arePropsEqual로 날짜, 상태, 통계, 플랜 변경 시에만 리렌더링
 */
const DroppableAdminDayCell = memo(
  DroppableAdminDayCellComponent,
  arePropsEqual
);

export default DroppableAdminDayCell;
