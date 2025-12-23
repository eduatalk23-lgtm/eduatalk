"use client";

/**
 * P2 개선: 출석 기록 실시간 업데이트 구독
 */

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UseAttendanceRealtimeOptions = {
  studentId: string;
  tenantId?: string;
  enabled?: boolean;
};

/**
 * 출석 기록 실시간 업데이트 훅
 * - 학생의 출석 기록 변경 시 자동으로 쿼리 무효화
 */
export function useAttendanceRealtime({
  studentId,
  tenantId,
  enabled = true,
}: UseAttendanceRealtimeOptions) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !studentId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`attendance-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `student_id=eq.${studentId}`,
        },
        (payload) => {
          console.log("[Realtime] Attendance updated:", payload);
          // 출석 관련 쿼리 무효화
          queryClient.invalidateQueries({ queryKey: ["attendance", studentId] });
          queryClient.invalidateQueries({ queryKey: ["attendance", "stats"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard", "attendance"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, tenantId, enabled, queryClient]);
}

/**
 * 관리자용 테넌트 전체 출석 실시간 업데이트 훅
 */
export function useAdminAttendanceRealtime({
  tenantId,
  enabled = true,
}: {
  tenantId: string;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !tenantId) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel(`admin-attendance-${tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_records",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log("[Realtime] Admin attendance updated:", payload);
          queryClient.invalidateQueries({ queryKey: ["admin", "attendance"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, enabled, queryClient]);
}
