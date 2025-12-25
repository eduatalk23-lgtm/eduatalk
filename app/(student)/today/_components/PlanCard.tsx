"use client";

import { useMemo, memo } from "react";
import { PlanGroup } from "../_utils/planGroupUtils";
import { getActivePlan, getTimeStats } from "../_utils/planGroupUtils";
import { PlanTimer } from "./PlanTimer";
import { Clock } from "lucide-react";
import { usePlanCardActions } from "@/lib/hooks/usePlanCardActions";
import {
  bgSurface,
  borderDefault,
  textPrimary,
  textSecondary,
  getIndigoTextClasses,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type PlanCardProps = {
  group: PlanGroup;
  sessions: Map<string, {
    isPaused: boolean;
    startedAt?: string | null;
    pausedAt?: string | null;
    resumedAt?: string | null;
    pausedDurationSeconds?: number | null;
  }>;
  planDate: string;
  viewMode: "single" | "daily";
  onViewDetail?: (planId: string) => void;
  serverNow?: number;
  campMode?: boolean;
};

function PlanCardComponent({
  group,
  sessions,
  planDate,
  viewMode,
  onViewDetail,
  serverNow = Date.now(),
  campMode = false,
}: PlanCardProps) {
  // Hook으로 추출된 액션 및 상태
  const {
    isLoading,
    pendingAction,
    isPausedState,
    isRunning,
    timerState,
    handleStart,
    handlePause,
    handleResume,
    handleComplete,
    handlePostponePlan,
    canPostpone,
  } = usePlanCardActions({ group, sessions, campMode });

  // 콘텐츠 정보
  const contentInfo = useMemo(
    () => ({
      title: group.content?.title || "제목 없음",
      icon:
        group.plan.content_type === "book"
          ? "📚"
          : group.plan.content_type === "lecture"
          ? "🎧"
          : "📝",
    }),
    [group.content?.title, group.plan.content_type]
  );

  const activePlan = useMemo(
    () => getActivePlan(group, sessions),
    [group, sessions]
  );

  // 시간 통계
  const timeStats = useMemo(
    () => getTimeStats([group.plan], activePlan, sessions),
    [group.plan, activePlan, sessions]
  );

  const planTimeRange =
    group.plan.start_time && group.plan.end_time
      ? `${group.plan.start_time} ~ ${group.plan.end_time}`
      : null;

  const getChapterIcon = (contentType: PlanGroup["plan"]["content_type"]) => {
    if (contentType === "book") return "📖";
    if (contentType === "lecture") return "🎧";
    return "📝";
  };

  const getRangeLabel = (planData: PlanGroup["plan"]) => {
    const { planned_start_page_or_time: start, planned_end_page_or_time: end, content_type } = planData;
    if (start === null || end === null) {
      return null;
    }
    if (content_type === "book") {
      return `📄 페이지: ${start} ~ ${end}`;
    }
    if (content_type === "lecture") {
      return `🎧 강의: ${start} ~ ${end}`;
    }
    return `📝 범위: ${start} ~ ${end}`;
  };

  const planChapterIcon = getChapterIcon(group.plan.content_type);
  const planRangeLabel = getRangeLabel(group.plan);

  // 단일 뷰
  if (viewMode === "single") {
    return (
      <div className="flex flex-col gap-6">
        {/* 헤더 */}
        <div className="flex flex-col items-center gap-3 text-center">
          {planTimeRange && (
            <div className={cn("inline-flex items-center gap-2 rounded-md px-4 py-1 text-sm font-semibold shadow-[var(--elevation-1)]", bgSurface, getIndigoTextClasses("heading"))}>
              <Clock className={cn("h-4 w-4", getIndigoTextClasses("icon"))} aria-hidden="true" />
              <span>{planTimeRange}</span>
            </div>
          )}
          <div className="text-4xl">{contentInfo.icon}</div>
          <h2 className={cn("text-2xl font-bold", textPrimary)}>{contentInfo.title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-4xl" aria-hidden="true">
              {planChapterIcon}
            </span>
            <div className="flex flex-col gap-1">
              <span className={cn("text-sm font-semibold", textPrimary)}>
                {group.plan.chapter || "챕터 정보 없음"}
              </span>
            </div>
          </div>
          {planRangeLabel && (
            <div className={cn("text-sm", textSecondary)}>{planRangeLabel}</div>
          )}
        </div>

        {/* 타이머 */}
        <PlanTimer
          planId={group.plan.id}
          timeStats={timeStats}
          isPaused={isPausedState}
          isActive={isRunning}
          isLoading={isLoading}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
          pendingAction={pendingAction}
          onPostpone={canPostpone ? () => handlePostponePlan(group.plan.id) : undefined}
          canPostpone={canPostpone}
          status={timerState.status}
          accumulatedSeconds={timerState.accumulatedSeconds}
          startedAt={timerState.startedAt}
          serverNow={serverNow}
        />
      </div>
    );
  }

  // 일일 뷰 - 모바일 친화적 카드 레이아웃
  return (
    <div className={cn("rounded-xl border p-4 shadow-[var(--elevation-1)] transition-base hover:shadow-[var(--elevation-4)] sm:p-5", borderDefault, bgSurface)}>
      <div className="flex flex-col gap-4 sm:gap-5">
        {/* 카드 헤더 */}
        <div className="flex flex-col gap-3 text-center sm:text-left">
          {planTimeRange && (
            <div className={cn("inline-flex items-center justify-center gap-2 self-center rounded-md px-3 py-1 text-xs font-semibold shadow-[var(--elevation-1)] sm:self-start", bgSurface, getIndigoTextClasses("heading"))}>
              <Clock className={cn("h-4 w-4", getIndigoTextClasses("icon"))} aria-hidden="true" />
              <span>{planTimeRange}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-lg">
              <span>{contentInfo.icon}</span>
              <h3 className={cn("font-semibold", textPrimary)}>{contentInfo.title}</h3>
            </div>
            {onViewDetail && (
              <button
                onClick={() => onViewDetail(group.plan.id)}
                className={cn("text-sm font-semibold", getIndigoTextClasses("link"))}
              >
                상세보기 →
              </button>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">
                {planChapterIcon}
              </span>
              <span className={cn("text-sm font-semibold", textPrimary)}>
                {group.plan.chapter || "챕터 정보 없음"}
              </span>
            </div>
            {planRangeLabel && (
              <div className={cn("text-sm", textSecondary)}>{planRangeLabel}</div>
            )}
          </div>
        </div>

        {/* 타이머 */}
        <PlanTimer
          planId={group.plan.id}
          timeStats={timeStats}
          isPaused={isPausedState}
          isActive={isRunning}
          isLoading={isLoading}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onComplete={handleComplete}
          pendingAction={pendingAction}
          onPostpone={canPostpone ? () => handlePostponePlan(group.plan.id) : undefined}
          canPostpone={canPostpone}
          compact
          status={timerState.status}
          accumulatedSeconds={timerState.accumulatedSeconds}
          startedAt={timerState.startedAt}
          serverNow={serverNow}
        />
      </div>
    </div>
  );
}

export const PlanCard = memo(PlanCardComponent, (prevProps, nextProps) => {
  const prevPlan = prevProps.group.plan;
  const nextPlan = nextProps.group.plan;

  // 현재 플랜의 세션만 비교 (다른 플랜 세션 변경 시 리렌더링 방지)
  const prevSession = prevProps.sessions.get(prevPlan.id);
  const nextSession = nextProps.sessions.get(nextPlan.id);

  const sessionsEqual =
    prevSession?.isPaused === nextSession?.isPaused &&
    prevSession?.startedAt === nextSession?.startedAt &&
    prevSession?.pausedAt === nextSession?.pausedAt &&
    prevSession?.pausedDurationSeconds === nextSession?.pausedDurationSeconds;

  return (
    prevProps.group.planNumber === nextProps.group.planNumber &&
    prevPlan.id === nextPlan.id &&
    prevPlan.progress === nextPlan.progress &&
    prevPlan.actual_start_time === nextPlan.actual_start_time &&
    prevPlan.actual_end_time === nextPlan.actual_end_time &&
    prevProps.planDate === nextProps.planDate &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.campMode === nextProps.campMode &&
    prevProps.serverNow === nextProps.serverNow &&
    sessionsEqual
  );
});
