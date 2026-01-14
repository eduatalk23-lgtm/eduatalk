"use client";

/**
 * 드래그 오버레이 콘텐츠
 *
 * 드래그 중인 플랜의 상세 정보와 드롭 상태를 표시합니다.
 * - 플랜 제목 및 콘텐츠 타입 아이콘
 * - 원래 날짜 → 대상 날짜 표시
 * - 예상 소요 시간
 * - 드롭 가능/불가능 상태 피드백
 * - 서버 저장 중 로딩 상태
 */

import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight, Ban, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/cn";
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

// 콘텐츠 타입별 아이콘
const CONTENT_TYPE_ICONS: Record<string, string> = {
  book: "📚",
  lecture: "🎬",
  custom: "📝",
  plan: "📋",
};

/**
 * 날짜 포맷팅 (yyyy-MM-dd → M/d)
 */
function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export default function DragOverlayContent({
  plan,
  overTarget,
  canDropOnDate,
  isPending = false,
}: DragOverlayContentProps) {
  // 드롭 상태 계산
  const isOverValidTarget = overTarget && canDropOnDate(overTarget.date);
  const isOverInvalidTarget = overTarget && !canDropOnDate(overTarget.date);
  const isSameDate = overTarget?.date === plan.originalDate;

  // 대상 날짜 표시 여부
  const showTargetDate = overTarget && !isSameDate;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={cn(
        "bg-white rounded-lg shadow-xl border-2 min-w-[180px] max-w-[240px]",
        // 드롭 상태에 따른 테두리 색상
        isOverValidTarget && "border-green-500 bg-green-50/50",
        isOverInvalidTarget && "border-red-500 bg-red-50/50",
        !overTarget && "border-blue-500"
      )}
    >
      {/* 헤더 - 플랜 제목 */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">
            {CONTENT_TYPE_ICONS[plan.type] || CONTENT_TYPE_ICONS.plan}
          </span>
          <span className="font-medium text-sm truncate flex-1">
            {plan.title}
          </span>
        </div>
      </div>

      {/* 본문 - 날짜 및 시간 정보 */}
      <div className="px-3 py-2 space-y-1.5">
        {/* 날짜 이동 표시 */}
        <div className="flex items-center gap-2 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className={cn(showTargetDate && "text-gray-400")}>
            {formatShortDate(plan.originalDate)}
          </span>
          {showTargetDate && (
            <>
              <motion.div
                animate={isOverValidTarget ? { x: [0, 2, 0] } : {}}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                <ArrowRight
                  className={cn(
                    "w-3.5 h-3.5 flex-shrink-0",
                    isOverValidTarget && "text-green-500",
                    isOverInvalidTarget && "text-red-500"
                  )}
                />
              </motion.div>
              <span
                className={cn(
                  "font-medium",
                  isOverValidTarget && "text-green-600",
                  isOverInvalidTarget && "text-red-600"
                )}
              >
                {formatShortDate(overTarget.date)}
              </span>
            </>
          )}
        </div>

        {/* 예상 시간 */}
        {plan.estimatedMinutes && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{plan.estimatedMinutes}분</span>
          </div>
        )}
      </div>

      {/* 푸터 - 드롭 상태 메시지 */}
      <motion.div
        layout
        className={cn(
          "px-3 py-1.5 text-xs rounded-b-lg",
          isPending && "bg-blue-100 text-blue-700",
          !isPending && isOverValidTarget && "bg-green-100 text-green-700",
          !isPending && isOverInvalidTarget && "bg-red-100 text-red-700",
          !isPending && !overTarget && "bg-gray-50 text-gray-500"
        )}
      >
        <div className="flex items-center gap-1.5">
          {isPending ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>저장 중...</span>
            </>
          ) : isOverValidTarget ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>여기에 놓아 이동</span>
            </>
          ) : isOverInvalidTarget ? (
            <>
              <Ban className="w-3.5 h-3.5" />
              <span>제외일 - 이동 불가</span>
            </>
          ) : (
            <span>날짜 위로 드래그하세요</span>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
