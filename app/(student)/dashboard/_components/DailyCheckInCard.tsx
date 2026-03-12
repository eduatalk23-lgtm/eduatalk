"use client";

import { useEffect, useState, useTransition } from "react";
import { cn, textPrimaryVar, textSecondaryVar } from "@/lib/utils/darkMode";
import { checkInAndGetStatus } from "@/lib/domains/checkin";
import type { CheckInStatus } from "@/lib/domains/checkin";

/**
 * 인라인 출석 표시 컴포넌트 (대시보드 상단 인사 영역에 통합)
 */
export function DailyCheckInCard() {
  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [showMilestone, setShowMilestone] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await checkInAndGetStatus();
      if (result.success && result.data) {
        setStatus(result.data);
        if (result.data.newTitle) {
          setShowMilestone(true);
        }
      }
    });
  }, []);

  // 마일스톤 자동 닫기
  useEffect(() => {
    if (!showMilestone) return;
    const timer = setTimeout(() => setShowMilestone(false), 5000);
    return () => clearTimeout(timer);
  }, [showMilestone]);

  if (isPending || !status) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 animate-pulse rounded bg-secondary-200 dark:bg-secondary-700" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 relative">
      {/* 마일스톤 달성 토스트 */}
      {showMilestone && status.newTitle && (
        <div className="absolute -top-10 left-0 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 animate-in fade-in slide-in-from-bottom-2 duration-300 shadow-sm">
          새로운 칭호 달성! 「{status.newTitle}」
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <span className={cn(
          "text-base",
          status.currentStreak >= 30 ? "animate-pulse" : ""
        )}>
          {status.currentStreak >= 7 ? "🔥" : "✅"}
        </span>
        <span className={cn("text-sm font-medium tabular-nums", textPrimaryVar)}>
          {status.currentStreak > 0
            ? `${status.currentStreak}일 연속 출석`
            : "오늘 출석 완료"}
        </span>
        <span className={cn("text-xs", textSecondaryVar)}>
          · 총 {status.totalDays}일
        </span>
      </div>

      {status.currentTitle && (
        <span className="rounded-full bg-secondary-100 dark:bg-secondary-800 px-2.5 py-0.5 text-xs font-medium text-secondary-600 dark:text-secondary-300">
          {status.currentTitle}
        </span>
      )}
    </div>
  );
}
