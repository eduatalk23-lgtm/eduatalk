"use client";

/**
 * 드래그 가능한 간트 플랜 막대
 *
 * @dnd-kit/core의 useDraggable을 사용하여 드래그 기능 제공
 * React.memo로 메모이제이션하여 불필요한 리렌더링 방지
 */

import { memo, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Clock, Calendar, BookOpen, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Tooltip } from "@/components/ui/Tooltip";
import type { CalendarPlan, DraggableAdminPlanData } from "./_types/adminCalendar";

// 상태 텍스트 변환
const STATUS_TEXT: Record<string, string> = {
  completed: "완료",
  in_progress: "진행 중",
  pending: "대기",
};

// 콘텐츠 타입 텍스트 변환
const CONTENT_TYPE_TEXT: Record<string, string> = {
  book: "교재",
  lecture: "강의",
  custom: "기타",
};

// Phase 4: 시간대 유형 텍스트 및 색상
const TIME_SLOT_TYPE_TEXT: Record<string, string> = {
  study: "학습시간",
  self_study: "자율학습",
};

const TIME_SLOT_BORDER_COLORS: Record<string, string> = {
  study: "ring-2 ring-green-300 ring-inset",
  self_study: "ring-2 ring-teal-300 ring-inset",
};

interface DraggableGanttPlanBarProps {
  plan: CalendarPlan;
  style: {
    left: string;
    width: string;
    top: number;
  };
  onClick: (planId: string) => void;
  disabled?: boolean;
}

/**
 * 플랜 툴팁 콘텐츠 컴포넌트
 */
function PlanTooltipContent({ plan }: { plan: CalendarPlan }) {
  const statusText = STATUS_TEXT[plan.status || "pending"] || "대기";
  const contentTypeText = CONTENT_TYPE_TEXT[plan.content_type || "custom"] || "기타";

  return (
    <div className="flex flex-col gap-2 min-w-[200px]">
      {/* 제목 */}
      <div className="font-medium text-sm border-b border-gray-700 pb-2">
        {plan.custom_title || plan.content_title || "플랜"}
      </div>

      {/* 상세 정보 */}
      <div className="flex flex-col gap-1.5 text-xs">
        {/* 날짜 */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span>{plan.plan_date}</span>
        </div>

        {/* 콘텐츠 타입 */}
        <div className="flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-gray-400" />
          <span>{contentTypeText}</span>
          {plan.content_subject && (
            <span className="text-gray-400">• {plan.content_subject}</span>
          )}
        </div>

        {/* 예상 시간 */}
        {plan.estimated_minutes && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>{plan.estimated_minutes}분</span>
          </div>
        )}

        {/* 상태 & 진행률 */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-gray-400" />
          <span>{statusText}</span>
          {plan.progress !== null && plan.progress !== undefined && (
            <span className="text-gray-400">• {plan.progress}%</span>
          )}
        </div>

        {/* Phase 4: 시간대 유형 */}
        {plan.time_slot_type && (
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              plan.time_slot_type === "study" && "bg-green-500/30 text-green-300",
              plan.time_slot_type === "self_study" && "bg-teal-500/30 text-teal-300"
            )}>
              {TIME_SLOT_TYPE_TEXT[plan.time_slot_type]}
            </span>
          </div>
        )}

        {/* 범위 표시 */}
        {plan.custom_range_display && (
          <div className="text-gray-400 mt-1">
            범위: {plan.custom_range_display}
          </div>
        )}
      </div>

      {/* 드래그 안내 */}
      <div className="text-[10px] text-gray-500 mt-1 pt-2 border-t border-gray-700">
        드래그하여 날짜 변경 • 클릭하여 편집
      </div>
    </div>
  );
}

/**
 * Props 비교 함수
 */
function arePropsEqual(
  prevProps: DraggableGanttPlanBarProps,
  nextProps: DraggableGanttPlanBarProps
): boolean {
  const prevPlan = prevProps.plan;
  const nextPlan = nextProps.plan;

  return (
    prevPlan.id === nextPlan.id &&
    prevPlan.status === nextPlan.status &&
    prevPlan.custom_title === nextPlan.custom_title &&
    prevPlan.content_title === nextPlan.content_title &&
    prevPlan.plan_date === nextPlan.plan_date &&
    // Phase 4: 시간대 유형 비교 추가
    prevPlan.time_slot_type === nextPlan.time_slot_type &&
    prevProps.style.left === nextProps.style.left &&
    prevProps.style.top === nextProps.style.top &&
    prevProps.disabled === nextProps.disabled
  );
}

// 상태별 색상
function getStatusColor(status: string | null | undefined) {
  switch (status) {
    case "completed":
      return "bg-green-500";
    case "in_progress":
      return "bg-blue-500";
    case "pending":
    default:
      return "bg-gray-400";
  }
}

function DraggableGanttPlanBarComponent({
  plan,
  style,
  onClick,
  disabled = false,
}: DraggableGanttPlanBarProps) {
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
    id: `gantt-plan-${plan.id}`,
    data: dragData,
    disabled,
  });

  const dragStyle = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const handleClick = useCallback(() => {
    if (!isDragging) {
      onClick(plan.id);
    }
  }, [isDragging, onClick, plan.id]);

  return (
    <Tooltip
      content={<PlanTooltipContent plan={plan} />}
      position="top"
      delay={300}
      maxWidth={280}
      interactive
    >
      <button
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={cn(
          "absolute h-6 rounded text-xs text-white px-1.5 truncate",
          "cursor-grab active:cursor-grabbing",
          "touch-none select-none",
          "transition-all duration-150 ease-out",
          "hover:scale-105 hover:shadow-lg hover:z-10",
          "focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-1",
          "active:scale-100",
          getStatusColor(plan.status),
          // Phase 4: 시간대 유형에 따른 테두리 표시
          plan.time_slot_type && TIME_SLOT_BORDER_COLORS[plan.time_slot_type],
          isDragging && "opacity-50 shadow-lg z-50 scale-105",
          disabled && "cursor-default opacity-60"
        )}
        style={{
          left: style.left,
          width: style.width,
          top: style.top,
          ...dragStyle,
        }}
      >
        {plan.custom_title || plan.content_title || "플랜"}
      </button>
    </Tooltip>
  );
}

/**
 * 메모이제이션된 드래그 가능한 간트 플랜 막대
 */
const DraggableGanttPlanBar = memo(
  DraggableGanttPlanBarComponent,
  arePropsEqual
);

export default DraggableGanttPlanBar;
