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
    prevPlan.plan_date === nextPlan.plan_date &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected
  );
}

function DraggableAdminPlanCardComponent({
  plan,
  onClick,
  disabled = false,
  isSelectionMode = false,
  isSelected = false,
  onSelect,
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

  // 상태별 색상
  const statusColor = {
    completed: "bg-green-100 text-green-700 border-green-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    pending: "bg-gray-100 text-gray-600 border-gray-200",
  }[plan.status || "pending"];

  // 콘텐츠 유형 아이콘
  const contentTypeIcon = {
    book: "📚",
    lecture: "🎬",
    custom: "📝",
  }[plan.content_type || "custom"];

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
        "w-full text-left text-xs px-1.5 py-0.5 rounded truncate border",
        "cursor-grab active:cursor-grabbing",
        "touch-none select-none",
        "transition-shadow hover:shadow-sm",
        statusColor,
        isDragging && "opacity-50 shadow-lg z-50",
        disabled && "cursor-default opacity-60",
        // 선택 모드 스타일
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-blue-500 ring-offset-1 bg-blue-50"
      )}
    >
      {/* 선택 체크박스 */}
      {isSelectionMode && (
        <span
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 mr-1 rounded-sm border",
            isSelected
              ? "bg-blue-500 border-blue-500 text-white"
              : "bg-white border-gray-300"
          )}
        >
          {isSelected && <Check className="w-2.5 h-2.5" />}
        </span>
      )}
      <span className="mr-0.5">{contentTypeIcon}</span>
      {plan.custom_title || plan.content_title || "플랜"}
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
