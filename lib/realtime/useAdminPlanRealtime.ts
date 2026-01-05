'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

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

    const supabase = createSupabaseBrowserClient();

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
        (payload) => {
          console.log('[Admin Realtime] Plan updated:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin Realtime] Subscribed to plan updates for student:', studentId);
        }
      });

    // ad_hoc_plans 테이블 변경 구독
    const adHocChannel = supabase
      .channel(`admin-adhoc-${studentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ad_hoc_plans',
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log('[Admin Realtime] Ad-hoc plan updated:', payload.eventType);
          debouncedRefresh();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Admin Realtime] Subscribed to ad-hoc updates for student:', studentId);
        }
      });

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      supabase.removeChannel(planChannel);
      supabase.removeChannel(adHocChannel);
    };
  }, [studentId, enabled, debouncedRefresh]);
}
