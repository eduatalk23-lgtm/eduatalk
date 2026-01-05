"use client";

import { BookOpen, Clock, ChevronRight, Coffee } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ContainerPlan } from "@/lib/domains/today/actions/containerPlans";

interface NextPlanCardProps {
  plan: ContainerPlan;
  onStart: () => void;
  onStartAfterBreak?: () => void;
  suggestedBreakMinutes?: number;
  className?: string;
}

/**
 * 다음 플랜 카드 컴포넌트
 * 학습 완료 후 다음 플랜을 제안하는 카드 UI
 */
export function NextPlanCard({
  plan,
  onStart,
  onStartAfterBreak,
  suggestedBreakMinutes,
  className,
}: NextPlanCardProps) {
  const title = plan.custom_title || plan.content_title || "다음 학습";
  const subject = plan.content_subject;

  // 범위 표시 생성
  const rangeText = plan.custom_range_display
    ? plan.custom_range_display
    : plan.planned_start_page_or_time && plan.planned_end_page_or_time
      ? `${plan.planned_start_page_or_time} ~ ${plan.planned_end_page_or_time}`
      : null;

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
        className
      )}
    >
      {/* 플랜 정보 */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
          <BookOpen className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-gray-900">
            {title}
          </h3>
          {subject && (
            <p className="mt-0.5 text-xs text-gray-500">{subject}</p>
          )}
          {rangeText && (
            <p className="mt-1 text-xs text-gray-400">{rangeText}</p>
          )}
        </div>
      </div>

      {/* 액션 버튼들 */}
      <div className="mt-4 flex flex-col gap-2">
        {/* 바로 시작 버튼 */}
        <button
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <span>바로 시작</span>
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* 휴식 후 시작 버튼 (옵션) */}
        {suggestedBreakMinutes && onStartAfterBreak && (
          <button
            onClick={onStartAfterBreak}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Coffee className="h-4 w-4" />
            <span>{suggestedBreakMinutes}분 휴식 후 시작</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 모든 플랜 완료 카드
 */
export function AllPlansCompleteCard({
  message,
  subMessage,
  className,
}: {
  message: string;
  subMessage?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-xl border border-green-200 bg-green-50 p-6 text-center",
        className
      )}
    >
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <span className="text-3xl">🎊</span>
      </div>
      <h3 className="text-lg font-bold text-green-800">{message}</h3>
      {subMessage && (
        <p className="mt-1 text-sm text-green-600">{subMessage}</p>
      )}
    </div>
  );
}

/**
 * 휴식 권장 카드
 */
export function BreakRecommendedCard({
  plan,
  message,
  subMessage,
  suggestedBreakMinutes,
  onStartNow,
  onStartAfterBreak,
  onSkip,
  className,
}: {
  plan: ContainerPlan;
  message: string;
  subMessage?: string;
  suggestedBreakMinutes: number;
  onStartNow: () => void;
  onStartAfterBreak: () => void;
  onSkip: () => void;
  className?: string;
}) {
  const title = plan.custom_title || plan.content_title || "다음 학습";

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-amber-200 bg-amber-50 p-4",
        className
      )}
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-2">
        <Coffee className="h-5 w-5 text-amber-600" />
        <span className="text-sm font-medium text-amber-800">{message}</span>
      </div>

      {subMessage && (
        <p className="mb-4 text-sm text-amber-700">{subMessage}</p>
      )}

      {/* 다음 플랜 정보 */}
      <div className="mb-4 rounded-lg bg-white p-3">
        <p className="text-xs text-gray-500">다음 학습</p>
        <p className="mt-0.5 truncate text-sm font-medium text-gray-900">
          {title}
        </p>
      </div>

      {/* 버튼들 */}
      <div className="flex flex-col gap-2">
        <button
          onClick={onStartAfterBreak}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
        >
          <Clock className="h-4 w-4" />
          <span>{suggestedBreakMinutes}분 후 알림 받기</span>
        </button>
        <div className="flex gap-2">
          <button
            onClick={onStartNow}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            바로 시작
          </button>
          <button
            onClick={onSkip}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            오늘은 여기까지
          </button>
        </div>
      </div>
    </div>
  );
}
