"use client";

/**
 * 드래그 가능한 관리자 플랜 카드
 *
 * @dnd-kit/core의 useDraggable을 사용하여 드래그 기능 제공
 * React.memo로 메모이제이션하여 불필요한 리렌더링 방지
 * 선택 모드에서 체크박스 표시 지원
 */

import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";

import { cn } from "@/lib/cn";
import { resolveCalendarColors } from "../utils/subjectColors";
import { formatTimeKoAmPm } from "../utils/timeGridUtils";
import type { CalendarPlan, DraggableAdminPlanData } from "./_types/adminCalendar";

interface DraggableAdminPlanCardProps {
  plan: CalendarPlan;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  /** 선택 모드 활성화 여부 */
  isSelectionMode?: boolean;
  /** 선택 여부 */
  isSelected?: boolean;
  /** 선택 토글 콜백 */
  onSelect?: (planId: string, shiftKey: boolean) => void;
  /** 검색 하이라이트 여부 */
  isHighlighted?: boolean;
  /**
   * 표시 변형
   * - 'chip': 기존 색상 칩 스타일 (기본)
   * - 'dot': Google Calendar 월간 뷰 스타일 (배경 없음, 컬러 도트 + 시간 + 제목)
   */
  variant?: 'chip' | 'dot';
  /** 캘린더 기본 색상 (hex) — 좌측 바 + 배경 fallback */
  calendarColor?: string | null;
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
    prevPlan.color === nextPlan.color &&
    prevProps.calendarColor === nextProps.calendarColor &&
    prevProps.disabled === nextProps.disabled &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isHighlighted === nextProps.isHighlighted &&
    prevProps.variant === nextProps.variant
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
  variant = 'chip',
  calendarColor,
}: DraggableAdminPlanCardProps) {
  const isCompleted = plan.status === "completed";
  const colors = resolveCalendarColors(plan.color, calendarColor, plan.status || "pending", isCompleted);

  // 드래그 데이터 구성
  const dragData: DraggableAdminPlanData = {
    id: plan.id,
    type: "plan",
    title: plan.custom_title || plan.content_title || "플랜",
    originalDate: plan.plan_date || "",
    originalStartTime: plan.start_time || null,
    estimatedMinutes: plan.estimated_minutes || null,
    planGroupId: plan.plan_group_id || null,
    subject: plan.content_subject,
    status: plan.status || "pending",
    color: plan.color,
    calendarId: plan.calendar_id,
    calendarColor,
    rrule: plan.rrule ?? null,
    recurringEventId: plan.recurring_event_id ?? null,
    isException: plan.is_exception ?? null,
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
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  // 시간 포맷 (HH:mm → AM/PM 한국어)
  const timeLabel = plan.start_time ? formatTimeKoAmPm(plan.start_time) : null;

  // dot 변형: Google Calendar 월간 뷰 — 배경 없음, 색 도트 + 시간 + 제목
  const isDotVariant = variant === 'dot';

  const textColor = colors.textIsWhite ? 'text-white' : 'text-gray-900';

  return (
    <button
      ref={setNodeRef}
      style={{
        ...style,
        // chip 변형에서만 배경색 + opacity 적용
        ...(!isDotVariant && !isSelected && !isHighlighted
          ? { backgroundColor: colors.bgHex, opacity: colors.opacity }
          : {}),
        // chip 변형: 좌측 캘린더 컬러 바 (border-left)
        ...(!isDotVariant ? { borderLeft: `4px solid ${colors.barHex}` } : {}),
        // 겹침 시 흰색 테두리 (border-left 제외한 나머지)
        ...(!isDotVariant ? {
          borderTop: '1px solid white',
          borderRight: '1px solid white',
          borderBottom: '1px solid white',
        } : {}),
      }}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        if (isSelectionMode && onSelect) {
          onSelect(plan.id, e.shiftKey);
          return;
        }
        onClick(e);
      }}
      className={cn(
        "w-full text-left text-xs rounded-md flex items-center gap-1 overflow-hidden relative",
        "cursor-grab active:cursor-grabbing",
        "touch-none select-none",
        "transition-[shadow,filter] hover:shadow-sm hover:brightness-[0.92]",
        isDotVariant ? [
          'pl-1 pr-1 py-px',
          'bg-transparent text-[var(--text-primary)] hover:bg-[rgb(var(--color-secondary-100))]',
          isCompleted && 'opacity-60',
        ] : [
          'pl-1 pr-1 py-px',
          textColor,
        ],
        isDragging && "opacity-50 shadow-lg z-50",
        disabled && "cursor-default opacity-60",
        isSelectionMode && "cursor-pointer",
        isSelected && "ring-2 ring-blue-500 ring-offset-1 bg-blue-50",
        isHighlighted && !isSelected && "ring-2 ring-yellow-400 bg-yellow-50"
      )}
    >
      {/* 색상 도트 */}
      <span
        className={cn("rounded-full flex-shrink-0", isDotVariant ? "w-2 h-2" : "w-1.5 h-1.5")}
        style={{ backgroundColor: isDotVariant ? colors.bgHex : 'rgba(255,255,255,0.5)' }}
      />

      {/* 선택 체크박스 */}
      {isSelectionMode && (
        <span
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border flex-shrink-0",
            isSelected
              ? "bg-blue-500 border-blue-500 text-white"
              : "bg-[rgb(var(--color-secondary-50))] border-[rgb(var(--color-secondary-300))]"
          )}
        >
          {isSelected && <Check className="w-2.5 h-2.5" />}
        </span>
      )}
      {timeLabel && (
        <span className="flex-shrink-0 tabular-nums opacity-70">{timeLabel}</span>
      )}
      {isCompleted && (
        <Check className={cn("w-3 h-3 flex-shrink-0", isDotVariant ? "text-green-600" : colors.textIsWhite ? "text-white/80" : "text-green-600")} />
      )}
      <span className={cn("truncate", colors.strikethrough && "line-through")}>
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
