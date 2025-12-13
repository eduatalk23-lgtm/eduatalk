"use client";

import { Clock, Link2 } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import { getContentTypeIcon } from "../../_shared/utils";
import { ProgressBar } from "@/components/atoms/ProgressBar";

type PlanCardProps = {
  plan: PlanWithContent;
  compact?: boolean;
  showTime?: boolean;
  showProgress?: boolean;
  // 연결 상태 (같은 plan_number를 가진 쪼개진 플랜들)
  isConnected?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isMiddle?: boolean;
};

/**
 * CalendarPlanCard - Calendar-specific plan card component
 * 
 * Specialized for displaying plans within calendar views (day, week, month).
 * Includes features like:
 * - Compact mode for timeline displays
 * - Connection indicators for split plans
 * - Time-based styling and progress display
 * 
 * For generic plan group cards, use _shared/PlanCard instead.
 */
export function CalendarPlanCard({ 
  plan, 
  compact = false, 
  showTime = true, 
  showProgress = true,
  isConnected = false,
  isFirst = false,
  isLast = false,
  isMiddle = false,
}: PlanCardProps) {
  const contentTypeIcon = getContentTypeIcon(plan.content_type);
  const isCompleted = plan.progress != null && plan.progress >= 100;
  const isActive = plan.actual_start_time && !plan.actual_end_time;
  const progressPercentage = plan.progress != null ? Math.round(plan.progress) : null;

  if (compact) {
    // 연결선 스타일 결정
    const connectionClasses = isConnected
      ? isFirst
        ? "rounded-t-md rounded-b-none" // 첫 번째: 위쪽만 둥글게
        : isLast
        ? "rounded-b-md rounded-t-none" // 마지막: 아래쪽만 둥글게
        : "rounded-none" // 중간: 둥글게 없음
      : "rounded-md";
    
    const borderColorClass = isCompleted
      ? "border-green-300"
      : isActive
      ? "border-blue-300"
      : "border-gray-200";
    
    const bgColorClass = isCompleted
      ? "bg-green-50"
      : isActive
      ? "bg-blue-50"
      : "bg-white";
    
    // 연결된 경우 border 조정
    const borderClasses = isConnected
      ? isFirst
        ? "border-b-0" // 첫 번째: 아래 border 제거
        : isLast
        ? "border-t-0" // 마지막: 위 border 제거
        : "border-t-0 border-b-0" // 중간: 위아래 border 제거
      : "";
    
    return (
      <div
        className={`group border p-1 py-0.5 text-xs transition-all duration-200 hover:scale-[1.02] hover:shadow-md relative ${connectionClasses} ${borderColorClass} ${bgColorClass} ${borderClasses}`}
      >
        {/* 연결선 표시 (아래쪽에 연결선) */}
        {isConnected && !isLast && (
          <div 
            className={`absolute left-0 right-0 bottom-0 h-[3px] translate-y-[6px] z-10 ${isCompleted ? "bg-green-300" : isActive ? "bg-blue-300" : "bg-gray-200"}`} 
          />
        )}
        <div className="flex items-center gap-0.5 min-w-0">
          <span className="text-xs shrink-0">{contentTypeIcon}</span>
          <span className="truncate font-medium text-gray-900 min-w-0 flex-1 text-[10px] leading-tight">
            {plan.contentSubjectCategory || plan.contentSubject || "-"}
          </span>
          {plan.contentEpisode && (
            <span className="shrink-0 text-[10px] text-gray-600">
              {plan.contentEpisode}
            </span>
          )}
          {isCompleted && (
            <span className="shrink-0 rounded-full bg-green-500 px-1 py-0.5 text-[10px] font-semibold text-white">
              ✅
            </span>
          )}
          {isActive && !isCompleted && (
            <span className="shrink-0 rounded-full bg-blue-500 px-1 py-0.5 text-[10px] font-semibold text-white">
              ⏱️
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`group rounded-lg border-2 p-4 md:p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg relative ${
        isCompleted
          ? "border-green-300 bg-green-50"
          : isActive
          ? "border-blue-300 bg-blue-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: 콘텐츠 정보 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-2.5">
          {/* 1행: 상태 뱃지 + 시간 표기 + 교과 과목 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 상태 뱃지 */}
            {isCompleted && (
              <span className="shrink-0 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ✅ 완료
              </span>
            )}
            {isActive && !isCompleted && (
              <span className="shrink-0 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⏱️ 학습 중
              </span>
            )}
            {!isCompleted && !isActive && (
              <span className="shrink-0 rounded-full bg-gray-400 px-3 py-1 text-xs font-bold text-white shadow-sm">
                ⏸️ 대기
              </span>
            )}
            {/* 시간 표기 */}
            {showTime && plan.start_time && plan.end_time && (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {plan.start_time} ~ {plan.end_time}
              </span>
            )}
            {/* 교과 과목 */}
            {plan.contentSubjectCategory && (
              <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {plan.contentSubjectCategory}
              </span>
            )}
            {plan.contentSubject && (
              <span className="shrink-0 text-xs font-medium text-gray-600">
                {plan.contentSubject}
              </span>
            )}
          </div>

          {/* 2행: 교재명(또는 강의명) 회차 */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xl md:text-2xl shrink-0">{contentTypeIcon}</span>
            <h3 className="truncate text-base md:text-lg font-semibold text-gray-900 min-w-0 flex-1">{plan.contentTitle}</h3>
            {plan.contentEpisode && (
              <span className="shrink-0 text-sm font-medium text-gray-600">
                {plan.contentEpisode}
              </span>
            )}
          </div>

          {/* 3행: 학습 범위 */}
          {plan.planned_start_page_or_time !== null && plan.planned_end_page_or_time !== null && (
            <div className="text-xs md:text-sm text-gray-500">
              {plan.content_type === "book" ? (
                <>📖 {plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}페이지</>
              ) : (
                <>🎧 {plan.planned_start_page_or_time}강</>
              )}
              {plan.chapter && <span className="pl-1">({plan.chapter})</span>}
            </div>
          )}
        </div>

        {/* 오른쪽: 진행률 */}
        {showProgress && progressPercentage !== null && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`text-base md:text-lg font-bold ${
              isCompleted ? "text-green-600" : isActive ? "text-blue-600" : "text-gray-600"
            }`}>
              {progressPercentage}%
            </span>
            <div className="w-20 md:w-24">
              <ProgressBar
                value={progressPercentage}
                variant={isCompleted ? "success" : isActive ? "default" : undefined}
                color={isCompleted ? undefined : isActive ? "blue" : undefined}
                size="sm"
                className="shadow-inner"
              />
            </div>
          </div>
        )}
      </div>
      {/* 연결 아이콘 (오른쪽 상단) */}
      {isConnected && (
        <div className="absolute top-3 right-3 md:top-4 md:right-4">
          <Link2 
            size={16} 
            className="text-indigo-500 opacity-70" 
            strokeWidth={2}
          />
        </div>
      )}
    </div>
  );
}

