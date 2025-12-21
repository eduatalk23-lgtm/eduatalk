"use client";

import { useState, useMemo, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { PlanGroup } from "../_utils/planGroupUtils";
import { getActivePlan, getTimeStats } from "../_utils/planGroupUtils";
import { PlanTimer } from "./PlanTimer";
import {
  startPlan,
  pausePlan,
  resumePlan,
  preparePlanCompletion,
  postponePlan,
} from "../actions/todayActions";
import { Clock } from "lucide-react";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { useToast } from "@/components/ui/ToastProvider";
import { buildPlanExecutionUrl } from "../_utils/navigationUtils";
import { 
  bgSurface, 
  borderDefault, 
  textPrimary, 
  textSecondary,
  getIndigoTextClasses,
  getIndigoBgClasses,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type PlanRunState = "idle" | "running" | "paused" | "completed";
type PendingAction = "start" | "pause" | "resume" | "complete";

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
  campMode?: boolean; // 캠프 모드 여부
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
  const router = useRouter();
  const { showError, showInfo } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const timerStore = usePlanTimerStore();

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

  const sessionForPlan = sessions.get(group.plan.id);

  const derivedStatus = useMemo<PlanRunState>(() => {
    if (group.plan.actual_end_time) {
      return "completed";
    }
    if (group.plan.actual_start_time) {
      return sessionForPlan?.isPaused ? "paused" : "running";
    }
    return "idle";
  }, [group.plan.actual_end_time, group.plan.actual_start_time, sessionForPlan?.isPaused]);

  const [optimisticStatus, setOptimisticStatus] = useState<PlanRunState | null>(null);

  useEffect(() => {
    setOptimisticStatus(null);
  }, [derivedStatus]);

  const resolvedStatus = optimisticStatus ?? derivedStatus;
  const isRunning = resolvedStatus === "running";
  const isPausedState = resolvedStatus === "paused";

  // 시간 통계
  const timeStats = useMemo(
    () => getTimeStats([group.plan], activePlan, sessions),
    [group.plan, activePlan, sessions]
  );

  // 서버에서 계산된 초기 타이머 상태 계산 (새로운 시스템 사용)
  const timerState = useMemo(() => {
    const plan = group.plan;
    const session = sessions.get(plan.id);

    // 완료된 경우
    if (plan.actual_end_time && plan.total_duration_seconds !== null && plan.total_duration_seconds !== undefined) {
      return {
        status: "COMPLETED" as const,
        accumulatedSeconds: plan.total_duration_seconds,
        startedAt: null,
      };
    }

    // 시작하지 않은 경우
    if (!plan.actual_start_time) {
      return {
        status: "NOT_STARTED" as const,
        accumulatedSeconds: 0,
        startedAt: null,
      };
    }

    // 일시정지 중인 경우
    if (session && session.isPaused && session.pausedAt) {
      const startMs = new Date(plan.actual_start_time).getTime();
      const pausedAtMs = new Date(session.pausedAt).getTime();
      if (Number.isFinite(startMs) && Number.isFinite(pausedAtMs)) {
        const elapsedUntilPause = Math.floor((pausedAtMs - startMs) / 1000);
        const sessionPausedDuration = session.pausedDurationSeconds || 0;
        const planPausedDuration = plan.paused_duration_seconds || 0;
        const accumulatedSeconds = Math.max(0, elapsedUntilPause - sessionPausedDuration - planPausedDuration);

        return {
          status: "PAUSED" as const,
          accumulatedSeconds,
          startedAt: null,
        };
      }
    }

    // 실행 중인 경우 - 서버에서 계산된 누적 시간 사용
    if (session && session.startedAt) {
      const sessionStartMs = new Date(session.startedAt).getTime();
      const now = Date.now();
      if (Number.isFinite(sessionStartMs)) {
        const elapsed = Math.floor((now - sessionStartMs) / 1000);
        const sessionPausedDuration = session.pausedDurationSeconds || 0;
        const planPausedDuration = plan.paused_duration_seconds || 0;
        const accumulatedSeconds = Math.max(0, elapsed - sessionPausedDuration - planPausedDuration);

        return {
          status: "RUNNING" as const,
          accumulatedSeconds,
          startedAt: session.startedAt,
        };
      }
    }

    // 활성 세션이 없지만 플랜이 시작된 경우
    const startMs = new Date(plan.actual_start_time).getTime();
    if (Number.isFinite(startMs)) {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const pausedDuration = plan.paused_duration_seconds || 0;
      const accumulatedSeconds = Math.max(0, elapsed - pausedDuration);

      return {
        status: "RUNNING" as const,
        accumulatedSeconds,
        startedAt: plan.actual_start_time,
      };
    }

    // fallback: 시작 시간이 유효하지 않은 경우
    return {
      status: "NOT_STARTED" as const,
      accumulatedSeconds: 0,
      startedAt: null,
    };
  }, [group.plan, sessions]);

  const handlePostponePlan = async (planId: string) => {
    if (isLoading) return;
    if (!group.plan.is_reschedulable) {
      showInfo("이 플랜은 일정 미루기가 허용되지 않습니다.");
      return;
    }
    if (!confirm("이 플랜을 내일 일정으로 미루시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await postponePlan(planId);
      if (!result.success) {
        showError(result.error || "일정을 미루는 중 오류가 발생했습니다.");
      }
      // postponePlan은 Server Action에서 revalidatePath를 호출하므로 router.refresh() 불필요
    } catch (error) {
      console.error("[PlanCard] 일정 미루기 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 타이머 제어 핸들러
  const handleStart = async () => {
    const plan = group.plan;
    if (plan.actual_start_time || plan.actual_end_time || isLoading) return;
    const waitingPlan = plan;

    setIsLoading(true);
    setPendingAction("start");
    setOptimisticStatus("running");
    try {
      const timestamp = new Date().toISOString();
      const result = await startPlan(waitingPlan.id, timestamp);
      if (!result.success) {
        showError(result.error || "플랜 시작에 실패했습니다.");
        setOptimisticStatus(null);
      } else if (result.serverNow && result.status && result.startedAt) {
        // 스토어에 타이머 시작
        timerStore.startTimer(waitingPlan.id, result.serverNow, result.startedAt);
      }
    } catch (error) {
      setOptimisticStatus(null);
      alert("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    if (isLoading) return;
    if (resolvedStatus !== "running") {
      showInfo("일시정지할 활성 플랜이 없습니다.");
      return;
    }

    const plan = group.plan;
    setOptimisticStatus("paused");
    setIsLoading(true);
    setPendingAction("pause");
    try {
      const timestamp = new Date().toISOString();
      const result = await pausePlan(plan.id, timestamp);
      if (!result.success) {
        setOptimisticStatus(null);
        showError(result.error || "플랜 일시정지에 실패했습니다.");
      } else if (result.serverNow && result.accumulatedSeconds !== undefined) {
        // 스토어에 타이머 일시정지
        timerStore.pauseTimer(plan.id, result.accumulatedSeconds);
      }
    } catch (error) {
      console.error("[PlanCard] 일시정지 오류:", error);
      setOptimisticStatus(null);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (resolvedStatus !== "paused") {
      showInfo("재개할 일시정지된 플랜이 없습니다.");
      return;
    }

    const plan = group.plan;
    setOptimisticStatus("running");
    setIsLoading(true);
    setPendingAction("resume");
    try {
      const timestamp = new Date().toISOString();
      const result = await resumePlan(plan.id, timestamp);
      if (!result.success) {
        setOptimisticStatus(null);
        showError(result.error || "플랜 재개에 실패했습니다.");
      } else if (result.serverNow && result.status && result.startedAt) {
        // 스토어에 타이머 재개
        timerStore.startTimer(plan.id, result.serverNow, result.startedAt);
      }
    } catch (error) {
      console.error("[PlanCard] 재개 오류:", error);
      setOptimisticStatus(null);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    const targetPlanId = activePlan?.id || group.plan.id;
    
    // 확인 다이얼로그
    const confirmed = confirm(
      "지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?"
    );
    
    if (!confirmed) {
      return;
    }

    setIsLoading(true);
    setPendingAction("complete");
    try {
      const result = await preparePlanCompletion(targetPlanId);
      
      if (!result.success) {
        showError(result.error || "플랜 완료 준비에 실패했습니다.");
        return;
      }

      // 타이머 정지 (스토어에서 제거)
      timerStore.removeTimer(targetPlanId);

      // 완료 입력 페이지로 이동
      router.push(buildPlanExecutionUrl(targetPlanId, campMode));
    } catch (error) {
      console.error("[PlanCard] 완료 처리 오류:", error);
      showError("오류가 발생했습니다.");
    } finally {
      setPendingAction(null);
      setIsLoading(false);
    }
  };

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
          onPostpone={
            group.plan.is_reschedulable && !group.plan.actual_end_time
              ? () => handlePostponePlan(group.plan.id)
              : undefined
          }
          canPostpone={group.plan.is_reschedulable && !group.plan.actual_end_time}
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
                onClick={() => {
                  // plan.id를 전달하여 planNumber가 null인 경우도 처리
                  onViewDetail(group.plan.id);
                }}
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
          onPostpone={
            group.plan.is_reschedulable && !group.plan.actual_end_time
              ? () => handlePostponePlan(group.plan.id)
              : undefined
          }
          canPostpone={group.plan.is_reschedulable && !group.plan.actual_end_time}
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
  // group의 주요 속성만 비교하여 불필요한 리렌더링 방지
  const prevPlan = prevProps.group.plan;
  const nextPlan = nextProps.group.plan;
  
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
    // sessions Map 비교 (크기와 주요 키만 확인)
    prevProps.sessions.size === nextProps.sessions.size &&
    prevProps.sessions.get(prevPlan.id)?.isPaused === nextProps.sessions.get(nextPlan.id)?.isPaused
  );
});

