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

    // Delay channel creation to avoid subscribing during rapid student switches
    // (350ms > StudentSwitcher debounce of 300ms)
    let planChannel: ReturnType<typeof supabase.channel> | undefined;
    let calendarChannel: ReturnType<typeof supabase.channel> | undefined;

    const subTimer = setTimeout(() => {
      // Broadcast 방식: DB Trigger → realtime.broadcast_changes()
      // 관리자도 같은 student_id 기반 채널을 구독
      planChannel = supabase
        .channel(`plan-realtime-${studentId}`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, () => debouncedRefresh())
        .on('broadcast', { event: 'UPDATE' }, () => debouncedRefresh())
        .on('broadcast', { event: 'DELETE' }, () => debouncedRefresh())
        .subscribe();

      calendarChannel = supabase
        .channel(`calendar-realtime-${studentId}`, { config: { private: true } })
        .on('broadcast', { event: 'INSERT' }, () => debouncedRefresh())
        .on('broadcast', { event: 'UPDATE' }, () => debouncedRefresh())
        .on('broadcast', { event: 'DELETE' }, () => debouncedRefresh())
        .subscribe();
    }, 350);

    return () => {
      clearTimeout(subTimer);
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (planChannel) supabase.removeChannel(planChannel);
      if (calendarChannel) supabase.removeChannel(calendarChannel);
    };
  }, [studentId, enabled, debouncedRefresh]);
}
