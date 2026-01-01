"use client";

/**
 * PlanListItem - 공통 플랜 아이템 컴포넌트
 *
 * 캘린더와 오늘 학습에서 공통으로 사용하는 플랜 아이템입니다.
 * 다양한 모드(display, interactive)를 지원합니다.
 *
 * 완료 모드:
 * - timer: 타이머 기반 완료 (기존)
 * - simple: 체크박스 기반 간단 완료 (신규)
 */

import { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import { SimpleCompleteCheckbox } from "./SimpleCompleteCheckbox";

export type PlanStatus = "pending" | "in_progress" | "completed" | "overdue";
export type PlanType = "student_plan" | "ad_hoc_plan";

export interface PlanListItemProps {
  /** 플랜 ID */
  id: string;
  /** 플랜 제목 */
  title: string;
  /** 플랜 타입 */
  planType?: PlanType;
  /** 상태 */
  status?: PlanStatus;
  /** 진행률 (0-100) */
  progress?: number;
  /** 과목명 */
  subject?: string;
  /** 범위 표시 (예: "p.1-10" 또는 "1강") */
  rangeDisplay?: string;
  /** 예상 시간 (분) */
  estimatedMinutes?: number;
  /** 이월 날짜 (YYYY-MM-DD) */
  carryoverFromDate?: string;
  /** 아이콘 또는 이모지 */
  icon?: ReactNode;
  /** 태그 (예: "복습", "취약", "단발성") */
  tags?: { label: string; color: "purple" | "orange" | "blue" | "green" | "gray" }[];
  /** 클릭 핸들러 */
  onClick?: () => void;
  /** 추가 액션 버튼 */
  actions?: ReactNode;
  /** 드래그 핸들 표시 여부 */
  showDragHandle?: boolean;
  /** 컴팩트 모드 */
  compact?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 테두리 색상 클래스 */
  borderClass?: string;
  /** 간단 완료 모드 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 후 콜백 */
  onSimpleComplete?: (completedAt: string) => void;
  /** 간단 완료 에러 시 콜백 */
  onSimpleCompleteError?: (error: string) => void;
}

const statusConfig = {
  pending: {
    icon: "○",
    iconClass: "text-gray-400",
    bgClass: "",
    label: "대기",
  },
  in_progress: {
    icon: "●",
    iconClass: "text-blue-500 animate-pulse",
    bgClass: "border-blue-400 ring-1 ring-blue-200",
    label: "진행 중",
  },
  completed: {
    icon: "✓",
    iconClass: "text-green-500",
    bgClass: "opacity-60",
    label: "완료",
  },
  overdue: {
    icon: "⚠️",
    iconClass: "text-amber-500",
    bgClass: "border-amber-400",
    label: "미완료",
  },
};

const tagColors = {
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

export function PlanListItem({
  id,
  title,
  planType = "student_plan",
  status = "pending",
  progress,
  subject,
  rangeDisplay,
  estimatedMinutes,
  carryoverFromDate,
  icon,
  tags = [],
  onClick,
  actions,
  showDragHandle = false,
  compact = false,
  className,
  borderClass,
  enableSimpleComplete = false,
  onSimpleComplete,
  onSimpleCompleteError,
}: PlanListItemProps) {
  const statusCfg = statusConfig[status];
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <div
      role={onClick ? "button" : "listitem"}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border bg-white dark:bg-gray-800 transition-all",
        compact ? "p-2" : "p-3",
        statusCfg.bgClass,
        borderClass || "border-gray-200 dark:border-gray-700",
        onClick && "cursor-pointer hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600",
        className
      )}
      aria-label={`${title}, ${statusCfg.label}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* 드래그 핸들 */}
        {showDragHandle && (
          <div className="flex-shrink-0 mt-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" />
              <circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" />
              <circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" />
              <circle cx="15" cy="18" r="1.5" />
            </svg>
          </div>
        )}

        {/* 왼쪽: 상태 아이콘 + 정보 */}
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {/* 간단 완료 체크박스 또는 상태 아이콘 */}
          {enableSimpleComplete ? (
            <div className="mt-0.5 flex-shrink-0">
              <SimpleCompleteCheckbox
                planId={id}
                planType={planType}
                isCompleted={isCompleted}
                disabled={isInProgress}
                onComplete={onSimpleComplete}
                onError={onSimpleCompleteError}
                size={compact ? "sm" : "md"}
                label={`${title} 완료하기`}
              />
            </div>
          ) : (
            <span className={cn("mt-0.5 flex-shrink-0", !icon && statusCfg.iconClass)}>
              {icon || statusCfg.icon}
            </span>
          )}

          {/* 콘텐츠 정보 */}
          <div className="flex-1 min-w-0">
            {/* 제목 + 태그 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  compact ? "text-sm" : "text-base",
                  "font-medium truncate",
                  textPrimary,
                  isCompleted && "line-through opacity-70"
                )}
              >
                {title}
              </span>

              {/* 태그들 */}
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                    tagColors[tag.color]
                  )}
                >
                  {tag.label}
                </span>
              ))}

              {/* Ad-hoc 플랜 표시 */}
              {planType === "ad_hoc_plan" && (
                <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-1.5 py-0.5 rounded flex-shrink-0">
                  단발성
                </span>
              )}
            </div>

            {/* 과목 및 범위 */}
            {!compact && (subject || rangeDisplay || estimatedMinutes) && (
              <div className={cn("flex items-center gap-2 mt-0.5 text-sm", textSecondary)}>
                {subject && <span>{subject}</span>}
                {subject && rangeDisplay && <span>·</span>}
                {rangeDisplay && <span>{rangeDisplay}</span>}
                {estimatedMinutes && (
                  <>
                    {(subject || rangeDisplay) && <span>·</span>}
                    <span>약 {estimatedMinutes}분</span>
                  </>
                )}
              </div>
            )}

            {/* 이월 정보 */}
            {carryoverFromDate && (
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {formatRelativeDate(carryoverFromDate)}부터 이월
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 액션 또는 완료 표시 */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {actions}

          {!actions && isCompleted && (
            <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">
              완료
            </span>
          )}

          {!actions && isInProgress && (
            <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
              진행중
            </span>
          )}
        </div>
      </div>

      {/* 진행률 바 (옵션) */}
      {!compact && progress !== undefined && progress > 0 && progress < 100 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className={textMuted}>진행률</span>
            <span className={textSecondary}>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 상대 날짜 포맷팅 헬퍼
 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "오늘";
  if (diffDays === 1) return "어제";
  if (diffDays === 2) return "그제";
  if (diffDays <= 7) return `${diffDays}일 전`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * AdHocPlanListItem - 단발성 플랜용 간단 아이템
 */
export interface AdHocPlanListItemProps {
  id: string;
  title: string;
  icon?: string;
  color?: string;
  estimatedMinutes?: number;
  status?: string;
  onClick?: () => void;
  className?: string;
  borderClass?: string;
  /** 간단 완료 모드 활성화 */
  enableSimpleComplete?: boolean;
  /** 간단 완료 후 콜백 */
  onSimpleComplete?: (completedAt: string) => void;
  /** 간단 완료 에러 시 콜백 */
  onSimpleCompleteError?: (error: string) => void;
}

export function AdHocPlanListItem({
  id,
  title,
  icon = "⚡",
  color,
  estimatedMinutes,
  status,
  onClick,
  className,
  borderClass,
  enableSimpleComplete = false,
  onSimpleComplete,
  onSimpleCompleteError,
}: AdHocPlanListItemProps) {
  const isCompleted = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <div
      role={onClick ? "button" : "listitem"}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-white dark:bg-gray-800 p-3 transition-all",
        isCompleted && "opacity-60",
        borderClass || "border-gray-200 dark:border-gray-700",
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
    >
      {/* 간단 완료 체크박스 또는 아이콘 */}
      {enableSimpleComplete ? (
        <SimpleCompleteCheckbox
          planId={id}
          planType="ad_hoc_plan"
          isCompleted={isCompleted}
          disabled={isInProgress}
          onComplete={onSimpleComplete}
          onError={onSimpleCompleteError}
          size="md"
          label={`${title} 완료하기`}
        />
      ) : (
        <span className="text-lg">{icon}</span>
      )}
      <span
        className={cn(
          "font-medium flex-1",
          textPrimary,
          isCompleted && "line-through"
        )}
      >
        {title}
      </span>
      {estimatedMinutes && (
        <span className={cn("text-sm", textMuted)}>~{estimatedMinutes}분</span>
      )}
      {isCompleted && !enableSimpleComplete && (
        <span className="text-xs text-green-600 bg-green-50 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">
          완료
        </span>
      )}
      {isInProgress && (
        <span className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
          진행중
        </span>
      )}
    </div>
  );
}
