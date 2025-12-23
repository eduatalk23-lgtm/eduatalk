"use client";

import { Clock, Link2, LinkIcon } from "lucide-react";
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
  // 콘텐츠 연결 콜백 (가상 플랜 전용)
  onLinkContent?: (planId: string, slotIndex: number) => void;
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
  onLinkContent,
}: PlanCardProps) {
  const ContentTypeIcon = getContentTypeIcon(plan.content_type);
  const isCompleted = plan.progress != null && plan.progress >= 100;
  const isActive = plan.actual_start_time && !plan.actual_end_time;
  const progressPercentage = plan.progress != null ? Math.round(plan.progress) : null;

  // 가상 플랜 확인 (is_virtual 필드 또는 Plan 타입 확장)
  const isVirtual = (plan as { is_virtual?: boolean | null }).is_virtual === true;
  const virtualSlotIndex = (plan as { slot_index?: number | null }).slot_index;
  const virtualSubjectCategory = (plan as { virtual_subject_category?: string | null }).virtual_subject_category;
  const virtualDescription = (plan as { virtual_description?: string | null }).virtual_description;

  if (compact) {
    // 연결선 스타일 결정
    const connectionClasses = isConnected
      ? isFirst
        ? "rounded-t-md rounded-b-none" // 첫 번째: 위쪽만 둥글게
        : isLast
        ? "rounded-b-md rounded-t-none" // 마지막: 아래쪽만 둥글게
        : "rounded-none" // 중간: 둥글게 없음
      : "rounded-md";

    // 가상 플랜 스타일 (점선 테두리, 연한 배경)
    const borderColorClass = isVirtual
      ? "border-dashed border-amber-400 dark:border-amber-600"
      : isCompleted
      ? "border-green-300 dark:border-green-700"
      : isActive
      ? "border-blue-300 dark:border-blue-700"
      : borderDefault;

    const bgColorClass = isVirtual
      ? "bg-amber-50/50 dark:bg-amber-900/20"
      : isCompleted
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

    // 가상 플랜 툴팁
    const virtualTooltip = isVirtual
      ? `${virtualSubjectCategory || "과목 미정"} - ${virtualDescription || "콘텐츠 연결 필요"}`
      : null;

    // 툴팁 텍스트 생성
    const tooltipText = isVirtual
      ? virtualTooltip
      : [
          plan.contentSubjectCategory || plan.contentSubject || "과목 없음",
          plan.contentEpisode && `회차: ${plan.contentEpisode}`,
          plan.contentTitle && `제목: ${plan.contentTitle}`,
        ]
          .filter(Boolean)
          .join(" | ");

    // 교과/과목 텍스트 (회차 포함)
    const subjectText = isVirtual
      ? virtualSubjectCategory || "콘텐츠 예정"
      : plan.contentSubjectCategory || plan.contentSubject || "-";
    const episodeText = isVirtual ? "" : plan.contentEpisode ? ` ${plan.contentEpisode}` : "";
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
        title={tooltipText || undefined}
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
                isVirtual ? "text-amber-700 dark:text-amber-400 italic" : textPrimary
              )}
              title={fullText}
            >
              {fullText}
            </span>
            {/* 가상 플랜 뱃지 */}
            {isVirtual && (
              <span
                className="shrink-0 rounded-full bg-amber-500 px-1 py-0.5 text-[9px] font-semibold text-white leading-none"
                title="콘텐츠 연결 필요"
                aria-label="콘텐츠 연결 필요"
              >
                ?
              </span>
            )}
            {/* 상태 뱃지 (완료/진행중) - 가상 플랜이 아닌 경우만 */}
            {!isVirtual && isCompleted && (
              <span
                className="shrink-0 rounded-full bg-green-500 px-1 py-0.5 text-[9px] font-semibold text-white leading-none"
                title="완료"
                aria-label="완료"
              >
                ✓
              </span>
            )}
            {!isVirtual && isActive && !isCompleted && (
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

  // 가상 플랜 비-컴팩트 모드 스타일
  const normalBorderClass = isVirtual
    ? "border-dashed border-amber-400 dark:border-amber-600"
    : isCompleted
    ? "border-green-300 dark:border-green-700"
    : isActive
    ? "border-blue-300 dark:border-blue-700"
    : borderDefault;

  const normalBgClass = isVirtual
    ? "bg-amber-50/50 dark:bg-amber-900/20"
    : isCompleted
    ? "bg-green-50 dark:bg-green-900/30"
    : isActive
    ? "bg-blue-50 dark:bg-blue-900/30"
    : bgSurface;

  return (
    <div
      className={cn(
        "group rounded-lg border-2 p-4 md:p-5 transition-base hover:scale-[1.02] hover:shadow-[var(--elevation-8)] relative",
        normalBorderClass,
        normalBgClass
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 왼쪽: 콘텐츠 정보 */}
        <div className="flex-1 min-w-0 flex flex-col gap-2 md:gap-2.5">
          {/* 1행: 상태 뱃지 + 시간 표기 + 교과 과목 */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 상태 뱃지 - 가상 플랜은 별도 뱃지 */}
            {isVirtual && (
              <span className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
                📌 콘텐츠 연결 필요
              </span>
            )}
            {!isVirtual && isCompleted && (
              <span className="shrink-0 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
                ✅ 완료
              </span>
            )}
            {!isVirtual && isActive && !isCompleted && (
              <span className="shrink-0 rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-[var(--elevation-1)]">
                ⏱️ 학습 중
              </span>
            )}
            {!isVirtual && !isCompleted && !isActive && (
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
            {/* 교과/과목 - 가상 플랜은 가상 과목 표시 */}
            {isVirtual ? (
              <span className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-800 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                {virtualSubjectCategory || "과목 미정"}
              </span>
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* 2행: 교재명(또는 강의명) 회차 - 가상 플랜은 설명 표시 */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <ContentTypeIcon className="w-6 h-6 md:w-8 md:h-8 shrink-0" />
            {isVirtual ? (
              <h3 className={cn("truncate text-base md:text-lg font-semibold min-w-0 flex-1 italic", "text-amber-700 dark:text-amber-400")}>
                {virtualDescription || "콘텐츠를 연결해주세요"}
              </h3>
            ) : (
              <>
                <h3 className={cn("truncate text-base md:text-lg font-semibold min-w-0 flex-1", textPrimary)}>{plan.contentTitle}</h3>
                {plan.contentEpisode && (
                  <span className="shrink-0 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {plan.contentEpisode}
                  </span>
                )}
              </>
            )}
          </div>

          {/* 3행: 학습 범위 (가상 플랜이 아닌 경우만) */}
          {!isVirtual && plan.planned_start_page_or_time !== null && plan.planned_end_page_or_time !== null && (
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

          {/* 가상 플랜: 콘텐츠 연결 버튼 */}
          {isVirtual && onLinkContent && virtualSlotIndex !== undefined && virtualSlotIndex !== null && (
            <button
              type="button"
              onClick={() => onLinkContent(plan.id, virtualSlotIndex)}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              콘텐츠 연결하기
            </button>
          )}
        </div>

        {/* 오른쪽: 진행률 (가상 플랜이 아닌 경우만) */}
        {!isVirtual && showProgress && progressPercentage !== null && (
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

