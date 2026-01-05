"use client";

import { useState, useEffect, useCallback } from "react";
import type { IncompletePlanInfo } from "@/lib/services/planReminderService";

interface UsePlanReminderOptions {
  studentId: string;
  /** 자동 새로고침 여부 */
  autoRefresh?: boolean;
  /** 새로고침 간격 (ms) - 기본 5분 */
  refreshIntervalMs?: number;
}

interface UsePlanReminderReturn {
  /** 오늘 미완료 플랜 */
  todayIncomplete: IncompletePlanInfo[];
  /** 지연된 플랜 */
  delayedPlans: IncompletePlanInfo[];
  /** 주간 요약 */
  weeklySummary: {
    totalIncomplete: number;
    bySubject: Record<string, number>;
  };
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: string | null;
  /** 새로고침 */
  refresh: () => Promise<void>;
  /** 배너 표시 여부 */
  shouldShowBanner: boolean;
  /** 배너 닫기 */
  dismissBanner: () => void;
}

/**
 * 플랜 리마인더 데이터 훅
 *
 * 미완료 플랜 정보를 로드하고 관리합니다.
 */
export function usePlanReminder({
  studentId,
  autoRefresh = false,
  refreshIntervalMs = 5 * 60 * 1000, // 5분
}: UsePlanReminderOptions): UsePlanReminderReturn {
  const [todayIncomplete, setTodayIncomplete] = useState<IncompletePlanInfo[]>([]);
  const [delayedPlans, setDelayedPlans] = useState<IncompletePlanInfo[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<{
    totalIncomplete: number;
    bySubject: Record<string, number>;
  }>({ totalIncomplete: 0, bySubject: {} });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!studentId) return;

    try {
      setError(null);
      // 동적 import로 서버 액션 로드
      const { getIncompleteReminderInfo } = await import(
        "@/lib/services/planReminderService"
      );
      const data = await getIncompleteReminderInfo(studentId);

      if (data) {
        setTodayIncomplete(data.todayIncomplete);
        setDelayedPlans(data.delayedPlans);
        setWeeklySummary(data.weeklySummary);
      }
    } catch (err) {
      console.error("[usePlanReminder] 데이터 로드 오류:", err);
      setError("미완료 플랜 정보를 불러오지 못했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [studentId]);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 자동 새로고침
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadData, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshIntervalMs, loadData]);

  // 새로고침
  const refresh = useCallback(async () => {
    setIsLoading(true);
    await loadData();
  }, [loadData]);

  // 배너 닫기
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    // 세션 스토리지에 저장 (같은 세션 동안 유지)
    try {
      const today = new Date().toISOString().split("T")[0];
      sessionStorage.setItem(`reminder_dismissed_${today}`, "true");
    } catch {
      // 스토리지 접근 실패 무시
    }
  }, []);

  // 세션 스토리지에서 닫기 상태 복원
  useEffect(() => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const dismissed = sessionStorage.getItem(`reminder_dismissed_${today}`);
      if (dismissed === "true") {
        setBannerDismissed(true);
      }
    } catch {
      // 스토리지 접근 실패 무시
    }
  }, []);

  // 배너 표시 여부 결정
  const shouldShowBanner =
    !bannerDismissed &&
    !isLoading &&
    (todayIncomplete.length > 0 || delayedPlans.length > 0);

  return {
    todayIncomplete,
    delayedPlans,
    weeklySummary,
    isLoading,
    error,
    refresh,
    shouldShowBanner,
    dismissBanner,
  };
}
