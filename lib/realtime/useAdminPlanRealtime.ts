'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type UseAdminPlanRealtimeOptions = {
  studentId: string;
  enabled?: boolean;
  onRefresh: () => void;
  /** Debounce delay in ms (default: 500) */
  debounceMs?: number;
};

/**
 * 관리자용 플랜 실시간 업데이트 훅
 * 특정 학생의 플랜 변경을 실시간으로 감지하여 새로고침 트리거
 */
export function useAdminPlanRealtime({
  studentId,
  enabled = true,
  onRefresh,
  debounceMs = 500,
}: UseAdminPlanRealtimeOptions) {
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshTime = useRef<number>(0);

  // Debounced refresh to prevent too many refreshes
  const debouncedRefresh = useCallback(() => {
    const now = Date.now();

    // Skip if refreshed within last debounceMs
    if (now - lastRefreshTime.current < debounceMs) {
      return;
    }

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      lastRefreshTime.current = Date.now();
      onRefresh();
    }, debounceMs);
  }, [onRefresh, debounceMs]);

  useEffect(() => {
    if (!enabled || !studentId) {
      return;
    }

    // 싱글톤 클라이언트 사용 (모듈 레벨에서 import)
    // student_plan 테이블 변경 구독
    const planChannel = supabase
      .channel(`admin-plan-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_plan',
          filter: `student_id=eq.${studentId}`,
        },
        () => debouncedRefresh()
      )
      .subscribe();

    // calendar_events 테이블 변경 구독 (학생이 추가/수정/삭제한 이벤트 실시간 반영)
    const calendarEventsChannel = supabase
      .channel(`admin-calendar-events-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calendar_events',
          filter: `student_id=eq.${studentId}`,
        },
        () => debouncedRefresh()
      )
      .subscribe();

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      supabase.removeChannel(planChannel);
      supabase.removeChannel(calendarEventsChannel);
    };
  }, [studentId, enabled, debouncedRefresh]);
}
