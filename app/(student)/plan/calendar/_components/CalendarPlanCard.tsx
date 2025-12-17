"use client";

import { Clock, Link2 } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import { getContentTypeIcon } from "../../_shared/utils";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { bgSurface, borderDefault, textPrimary } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

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
  const ContentTypeIcon = getContentTypeIcon(plan.content_type);
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
      ? "border-green-300 dark:border-green-700"
      : isActive
      ? "border-blue-300 dark:border-blue-700"
      : borderDefault;
    
    const bgColorClass = isCompleted
      ? "bg-green-50 dark:bg-green-900/30"
      : isActive
      ? "bg-blue-50 dark:bg-blue-900/30"
      : bgSurface;
    
    // 연결된 경우 border 조정
    const borderClasses = isConnected
      ? isFirst
        ? "border-b-0" // 첫 번째: 아래 border 제거
        : isLast
        ? "border-t-0" // 마지막: 위 border 제거
        : "border-t-0 border-b-0" // 중간: 위아래 border 제거
      : "";

    // 툴팁 텍스트 생성
    const tooltipText = [
      plan.contentSubjectCategory || plan.contentSubject || "과목 없음",
      plan.contentEpisode && `회차: ${plan.contentEpisode}`,
      plan.contentTitle && `제목: ${plan.contentTitle}`,
    ]
      .filter(Boolean)
      .join(" | ");

    // 교과/과목 텍스트 (회차 포함)
    const subjectText = plan.contentSubjectCategory || plan.contentSubject || "-";
    const episodeText = plan.contentEpisode ? ` ${plan.contentEpisode}` : "";
    const fullText = `${subjectText}${episodeText}`;
    
    return (
      <div
        className={cn(
          "group border p-1.5 py-1 text-xs transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-4)] relative",
          connectionClasses,
          borderColorClass,
          bgColorClass,
          borderClasses
        )}
        title={tooltipText}
      >
        {/* 연결선 표시 (아래쪽에 연결선) */}
        {isConnected && !isLast && (
          <div 
            className={`absolute left-0 right-0 bottom-0 h-[3px] translate-y-[6px] z-10 ${isCompleted ? "bg-green-300 dark:bg-green-700" : isActive ? "bg-blue-300 dark:bg-blue-700" : "bg-gray-200 dark:bg-gray-700"}`} 
          />
        )}
        {/* 개선된 레이아웃: 세로 스택으로 변경 */}
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* 1행: 아이콘 + 교과/과목 + 상태 */}
          <div className="flex items-center gap-1 min-w-0">
            <ContentTypeIcon className="w-3 h-3 shrink-0" />
            <span 
              className={cn(
                "truncate font-medium min-w-0 flex-1 text-[11px] leading-tight",
                textPrimary
              )}
              title={fullText}
            >
              {fullText}
            </span>
            {/* 상태 뱃지 (완료/진행중) */}
            {isCompleted && (
              <span 
                className="shrink-0 rounded-full bg-green-500 px-1 py-0.5 text-[9px] font-semibold text-white leading-none"
                title="완료"
                aria-label="완료"
              >
                ✓
              </span>
            )}
            {isActive && !isCompleted && (
              <span 
                className="shrink-0 rounded-full bg-blue-500 px-1 py-0.5 text-[9px] font-semibold text-white leading-none"
                title="학습 중"
                aria-label="학습 중"
              >
                ⏱
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group rounded-lg border-2 p-4 md:p-5 transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-8)] relative",
        isCompleted
          ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30"
          : isActive
          ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/30"
          : cn(borderDefault, bgSurface)
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: 콘텐츠 정보 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-2.5">
          {/* 1행: 상태 뱃지 + 시간 표기 + 교과 과목 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 상태 뱃지 */}
            {isCompleted && (
              <span className="shrink-0 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
                ✅ 완료
              </span>
            )}
            {isActive && !isCompleted && (
              <span className="shrink-0 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
                ⏱️ 학습 중
              </span>
            )}
            {!isCompleted && !isActive && (
              <span className="shrink-0 rounded-full bg-gray-400 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
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
              <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                {plan.contentSubjectCategory}
              </span>
            )}
            {plan.contentSubject && (
              <span className="shrink-0 text-xs font-medium text-gray-600 dark:text-gray-400">
                {plan.contentSubject}
              </span>
            )}
          </div>

          {/* 2행: 교재명(또는 강의명) 회차 */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <ContentTypeIcon className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
            <h3 className={cn("truncate text-base md:text-lg font-semibold min-w-0 flex-1", textPrimary)}>{plan.contentTitle}</h3>
            {plan.contentEpisode && (
              <span className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
                {plan.contentEpisode}
              </span>
            )}
          </div>

          {/* 3행: 학습 범위 */}
          {plan.planned_start_page_or_time !== null && plan.planned_end_page_or_time !== null && (
            <div className="flex items-center gap-1 text-xs md:text-sm text-gray-500 dark:text-gray-400">
              {(() => {
                const ContentIcon = getContentTypeIcon(plan.content_type);
                return <ContentIcon className="w-3 h-3 shrink-0" />;
              })()}
              <span>
                {plan.content_type === "book" ? (
                  <>{plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}페이지</>
                ) : (
                  <>{plan.planned_start_page_or_time}강</>
                )}
              </span>
              {plan.chapter && <span className="pl-1">({plan.chapter})</span>}
            </div>
          )}
        </div>

        {/* 오른쪽: 진행률 */}
        {showProgress && progressPercentage !== null && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className={`text-base md:text-lg font-bold ${
              isCompleted ? "text-green-600 dark:text-green-400" : isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"
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

