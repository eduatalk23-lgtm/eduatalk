"use client";

/**
 * 드래그 가능한 관리자 플랜 카드
 *
 * @dnd-kit/core의 useDraggable을 사용하여 드래그 기능 제공
 * React.memo로 메모이제이션하여 불필요한 리렌더링 방지
 * 선택 모드에서 체크박스 표시 지원
 */

import { memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { getGridBlockColors } from "../utils/subjectColors";
import { formatTimeKoAmPm } from "../utils/timeGridUtils";
import type { CalendarPlan, DraggableAdminPlanData } from "./_types/adminCalendar";

interface DraggableAdminPlanCardProps {
  plan: CalendarPlan;
  onClick: () => void;
  disabled?: boolean;
  /** 선택 모드 활성화 여부 */
  isSelectionMode?: boolean;
  /** 선택 여부 */
  isSelected?: boolean;
  /** 선택 토글 콜백 */
  onSelect?: (planId: string, shiftKey: boolean) => void;
  /** 검색 하이라이트 여부 */
  isHighlighted?: boolean;
}

/**
 * 플랜 비교 함수
 * plan의 주요 속성만 비교하여 불필요한 리렌더링 방지
 */
function arePropsEqual(
  prevProps: DraggableAdminPlanCardProps,
  nextProps: DraggableAdminPlanCardProps
): boolean {
  const prevPlan = prevProps.plan;
  const nextPlan = nextProps.plan;

  return (
    prevPlan.id === nextPlan.id &&
    prevPlan.status === nextPlan.status &&
    prevPlan.custom_title === nextPlan.custom_title &&
    prevPlan.content_title === nextPlan.content_title &&
    prevPlan.content_type === nextPlan.content_type &&
    prevPlan.content_subject === nextPlan.content_subject &&
    prevPlan.start_time === nextPlan.start_time &&
    prevPlan.plan_date === nextPlan.plan_date &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHighlighted === nextProps.isHighlighted
  );
}

function DraggableAdminPlanCardComponent({
  plan,
  onClick,
  disabled = false,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
  isHighlighted = false,
}: DraggableAdminPlanCardProps) {
  // 드래그 데이터 구성
  const dragData: DraggableAdminPlanData = {
    id: plan.id,
    type: "plan",
    title: plan.custom_title || plan.content_title || "플랜",
    originalDate: plan.plan_date || "",
    originalStartTime: plan.start_time || null,
    estimatedMinutes: plan.estimated_minutes || null,
    planGroupId: plan.plan_group_id || null,
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `plan-${plan.id}`,
    data: dragData,
    disabled,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const isCompleted = plan.status === "completed";
  const colors = getGridBlockColors(
    plan.content_subject ?? undefined,
    plan.status || "pending",
    isCompleted,
  );

  // 시간 포맷 (HH:mm → AM/PM 한국어)
  const timeLabel = plan.start_time ? formatTimeKoAmPm(plan.start_time) : null;

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // 드래그 중에는 클릭 이벤트 무시
        if (isDragging) return;

        e.stopPropagation();

        // 선택 모드일 때는 선택 토글
        if (isSelectionMode && onSelect) {
          onSelect(plan.id, e.shiftKey);
          return;
        }

        onClick();
      }}
      className={cn(
        "w-full text-left text-xs rounded flex items-center gap-1 overflow-hidden",
        "cursor-grab active:cursor-grabbing",
        "touch-none select-none",
        "transition-shadow hover:shadow-sm",
        "pl-1 pr-1 py-px",
        colors.bg,
        colors.text,
        isDragging && "opacity-50 shadow-lg z-50",
        disabled && "cursor-default opacity-60",
        isCompleted && "opacity-80",
        // 선택 모드 스타일
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-blue-500 ring-offset-1 bg-blue-50",
        isHighlighted && !isSelected && "ring-2 ring-yellow-400 bg-yellow-50"
      )}
    >
      {/* 색상 도트 */}
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", colors.accent)} />
      {/* 선택 체크박스 */}
      {isSelectionMode && (
        <span
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border flex-shrink-0",
            isSelected
              ? "bg-blue-500 border-blue-500 text-white"
              : "bg-white border-gray-300"
          )}
        >
          {isSelected && <Check className="w-2.5 h-2.5" />}
        </span>
      )}
      {timeLabel && (
        <span className="flex-shrink-0 tabular-nums opacity-70">{timeLabel}</span>
      )}
      {isCompleted && <Check className="w-3 h-3 flex-shrink-0 text-green-600" />}
      <span className={cn("truncate", isCompleted && "line-through")}>
        {plan.custom_title || plan.content_title || "플랜"}
      </span>
    </button>
  );
}

/**
 * 메모이제이션된 드래그 가능한 관리자 플랜 카드
 * arePropsEqual로 plan의 주요 속성 변경 시에만 리렌더링
 */
const DraggableAdminPlanCard = memo(
  DraggableAdminPlanCardComponent,
  arePropsEqual
);

export default DraggableAdminPlanCard;
