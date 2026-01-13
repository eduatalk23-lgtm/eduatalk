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

import { cn } from "@/lib/cn";
import { useAdminCalendarDrag } from "./_context/AdminCalendarDragContext";
import DraggableAdminPlanCard from "./DraggableAdminPlanCard";
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
}: DroppableAdminDayCellProps) {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayOfWeek = date.getDay();

  // 드롭 타겟 데이터
  const dropData: DroppableTargetData = {
    date: dateStr,
    isExclusion: status.isExclusion,
  };

  const { isDragging, canDropOnDate } = useAdminCalendarDrag();

  const { setNodeRef, isOver, active } = useDroppable({
    id: `day-${dateStr}`,
    data: dropData,
    disabled: status.isExclusion,
  });

  // 드롭 가능 여부
  const canDrop = canDropOnDate(dateStr);
  const showDropIndicator = isDragging && !status.isExclusion;
  const showInvalidDrop = isDragging && status.isExclusion;

  // 내부 핸들러 - 콜백에 dateStr 전달
  const handleClick = useCallback(() => {
    onDateClick(dateStr);
  }, [onDateClick, dateStr]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      onContextMenu(e, dateStr);
    },
    [onContextMenu, dateStr]
  );

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      className={cn(
        "bg-white p-2 min-h-[100px] cursor-pointer transition-colors",
        "hover:bg-gray-50",
        !status.isCurrentMonth && "bg-gray-50",
        status.isSelected && "ring-2 ring-blue-500 ring-inset",
        status.isExclusion && "bg-gray-100",
        // 드롭 관련 스타일
        showDropIndicator && canDrop && "ring-2 ring-dashed ring-blue-300",
        isOver && canDrop && "bg-blue-50 ring-2 ring-blue-500",
        showInvalidDrop && "bg-red-50 cursor-not-allowed",
        isOver && !canDrop && "bg-red-100"
      )}
    >
      {/* 날짜 숫자 */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full",
              !status.isCurrentMonth && "text-gray-400",
              status.isToday && "bg-blue-600 text-white",
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
          </span>

          {/* 주차/일차 정보 (학습일/복습일인 경우에만) */}
          {status.weekNumber != null && status.cycleDayNumber != null && (
            <span className="text-[9px] text-gray-400">
              {status.weekNumber}주{status.cycleDayNumber}일
            </span>
          )}
        </div>

        {/* 제외일 또는 날짜 타입 표시 */}
        {status.isExclusion ? (
          <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
            {status.exclusionType}
          </span>
        ) : status.dayType === "복습일" ? (
          <span className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium">
            R
          </span>
        ) : null}
      </div>

      {/* 드래그 중 드롭 불가 표시 */}
      {showInvalidDrop && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded">
          <span className="text-xs text-red-500 font-medium">제외일</span>
        </div>
      )}

      {/* 플랜 요약 */}
      {stats.totalPlans > 0 && !status.isExclusion && (
        <div className="space-y-1">
          {/* 진행률 바 */}
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>

          {/* Phase 4: 시간대 유형 분포 바 */}
          {(stats.studySlotPlans || stats.selfStudySlotPlans || 0) > 0 && (
            <div className="flex gap-0.5 h-1 mt-0.5" title="학습시간(초록) / 자율학습(청록)">
              {(stats.studySlotPlans ?? 0) > 0 && (
                <div
                  className="bg-green-400 rounded-sm"
                  style={{ flex: stats.studySlotPlans }}
                />
              )}
              {(stats.selfStudySlotPlans ?? 0) > 0 && (
                <div
                  className="bg-teal-400 rounded-sm"
                  style={{ flex: stats.selfStudySlotPlans }}
                />
              )}
              {(stats.noSlotPlans ?? 0) > 0 && (
                <div
                  className="bg-gray-300 rounded-sm"
                  style={{ flex: stats.noSlotPlans }}
                />
              )}
            </div>
          )}

          {/* 플랜 카운트 */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="text-green-600">{stats.completedPlans}</span>
            <span>/</span>
            <span>{stats.totalPlans}</span>
          </div>

          {/* 플랜 미리보기 (최대 3개) - 드래그 가능 */}
          <div className="space-y-0.5">
            {plans.slice(0, 3).map((plan) => (
              <DraggableAdminPlanCard
                key={plan.id}
                plan={plan}
                onClick={() => onPlanClick(plan.id)}
                disabled={isSelectionMode}
                isSelectionMode={isSelectionMode}
                isSelected={selectedPlanIds?.has(plan.id) ?? false}
                onSelect={onPlanSelect}
              />
            ))}
            {plans.length > 3 && (
              <div className="text-xs text-gray-400 pl-1">
                +{plans.length - 3}개 더
              </div>
            )}
          </div>
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
