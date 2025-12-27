"use client";

import { useEffect, useState } from "react";
import { Clock, Pause, Play, Square, CheckCircle2 } from "lucide-react";
import { pausePlan, resumePlan } from "@/app/(student)/today/actions/todayActions";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { buildPlanExecutionUrl } from "@/app/(student)/today/_utils/navigationUtils";
import { useActivePlanDetails } from "@/lib/hooks/useActivePlanDetails";
import { usePlanTimerStore } from "@/lib/store/planTimerStore";
import { textPrimaryVar, textTertiaryVar } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type ActiveLearningWidgetProps = {
  activePlanId: string | null;
  campMode?: boolean;
};

export function ActiveLearningWidget({ activePlanId, campMode = false }: ActiveLearningWidgetProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const timerStore = usePlanTimerStore();
  const { data: activePlan, isLoading: isPlanLoading } = useActivePlanDetails({
    planId: activePlanId,
    enabled: !!activePlanId,
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!activePlan || activePlan.isPaused) {
      return;
    }

    const calculateElapsed = () => {
      const start = new Date(activePlan.actualStartTime);
      const now = new Date();
      const total = Math.floor((now.getTime() - start.getTime()) / 1000);
      const paused = activePlan.pausedDurationSeconds || 0;
      return Math.max(0, total - paused);
    };

    setElapsedSeconds(calculateElapsed());

    const interval = setInterval(() => {
      setElapsedSeconds(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [activePlan]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분 ${secs}초`;
  };

  // 디지털 시계 형식 (00:00:00)
  const formatDigitalTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePause = async () => {
    if (!activePlan) return;
    // 이미 로딩 중이거나 일시정지된 상태면 중복 호출 방지
    if (isLoading || activePlan.isPaused) {
      return;
    }

    // Optimistic Update: 즉시 Zustand 상태 업데이트
    timerStore.pauseTimer(activePlan.id, elapsedSeconds);

    setIsLoading(true);
    const timestamp = new Date().toISOString();
    try {
      const result = await pausePlan(activePlan.id, timestamp);
      if (result.success) {
        // 서버 값으로 동기화
        if (result.accumulatedSeconds !== undefined) {
          timerStore.pauseTimer(activePlan.id, result.accumulatedSeconds);
        }
        // React Query 캐시 무효화 (router.refresh() 대체)
        queryClient.invalidateQueries({ queryKey: ['activePlanDetails', activePlan.id] });
      } else {
        // 실패 시 롤백: RUNNING 상태로 복구
        if (activePlan.actualStartTime) {
          timerStore.startTimer(activePlan.id, Date.now(), activePlan.actualStartTime);
        }
        // "이미 일시정지된 상태입니다" 에러는 무시 (중복 호출 방지)
        if (result.error && !result.error.includes("이미 일시정지된 상태입니다")) {
          console.error("[ActiveLearningWidget] 일시정지 실패:", result.error);
        }
      }
    } catch (error) {
      // 롤백
      if (activePlan.actualStartTime) {
        timerStore.startTimer(activePlan.id, Date.now(), activePlan.actualStartTime);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResume = async () => {
    if (!activePlan) return;

    // Optimistic Update: 즉시 Zustand 상태 업데이트
    const timestamp = new Date().toISOString();
    timerStore.startTimer(activePlan.id, Date.now(), activePlan.actualStartTime || timestamp);

    setIsLoading(true);
    try {
      const result = await resumePlan(activePlan.id, timestamp);
      if (result.success) {
        // 서버 시간으로 동기화
        if (result.serverNow) {
          timerStore.syncNow(activePlan.id, result.serverNow);
        }
        // React Query 캐시 무효화 (router.refresh() 대체)
        queryClient.invalidateQueries({ queryKey: ['activePlanDetails', activePlan.id] });
      } else {
        // 실패 시 롤백: PAUSED 상태로 복구
        timerStore.pauseTimer(activePlan.id, elapsedSeconds);
      }
    } catch (error) {
      // 롤백
      timerStore.pauseTimer(activePlan.id, elapsedSeconds);
    } finally {
      setIsLoading(false);
    }
  };

  // 로딩 중 스켈레톤 UI
  if (isPlanLoading) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/30 p-6 shadow-[var(--elevation-1)] animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <h3 className={cn("text-lg font-semibold", textPrimaryVar)}>현재 학습 중</h3>
          </div>
        </div>
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!activePlan) {
    return null;
  }

  const contentTypeIcon = {
    book: "📚",
    lecture: "🎧",
    custom: "📝",
  }[activePlan.contentType];

  return (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-gradient-to-br from-indigo-50 via-blue-50 to-white dark:from-indigo-900/40 dark:via-blue-900/30 dark:to-gray-900/40 p-6 shadow-lg">
      {/* 상단: 제목 및 상태 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{contentTypeIcon}</span>
          <div>
            <h3 className={cn("text-lg font-bold", textPrimaryVar)}>{activePlan.title}</h3>
            <div className="flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium", activePlan.isPaused ? "text-yellow-600" : "text-green-600")}>
                <span className={cn("h-2 w-2 rounded-full", activePlan.isPaused ? "bg-yellow-500" : "bg-green-500 animate-pulse")} />
                {activePlan.isPaused ? "일시정지됨" : "학습 중"}
              </span>
              {activePlan.pauseCount > 0 && (
                <span className={cn("text-xs", textTertiaryVar)}>
                  (정지 {activePlan.pauseCount}회)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 중앙: 큰 타이머 표시 */}
      <div className="flex flex-col items-center justify-center py-4">
        <div className={cn(
          "font-mono text-4xl font-bold tracking-wider",
          activePlan.isPaused ? "text-yellow-600 dark:text-yellow-400" : "text-indigo-700 dark:text-indigo-300"
        )}>
          {formatDigitalTime(elapsedSeconds)}
        </div>
        <p className={cn("mt-1 text-sm", textTertiaryVar)}>
          {formatTime(elapsedSeconds)} 학습
        </p>
      </div>

      {/* 하단: 컨트롤 버튼 */}
      <div className="flex gap-2">
        {activePlan.isPaused ? (
          <button
            onClick={handleResume}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50"
          >
            <Play className="h-5 w-5" />
            학습 재개
          </button>
        ) : (
          <button
            onClick={handlePause}
            disabled={isLoading}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-yellow-500 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-yellow-600 disabled:opacity-50"
          >
            <Pause className="h-5 w-5" />
            일시정지
          </button>
        )}
        <Link
          href={buildPlanExecutionUrl(activePlan.id, campMode)}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-green-700"
        >
          <CheckCircle2 className="h-5 w-5" />
          학습 완료
        </Link>
      </div>
    </div>
  );
}

