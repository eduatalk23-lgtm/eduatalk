"use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { POSTGRES_ERROR_CODES } from "@/lib/constants/errorCodes";
import { CACHE_STALE_TIME_REALTIME } from "@/lib/constants/queryCache";

type ActivePlanDetails = {
  id: string;
  title: string;
  contentType: "book" | "lecture" | "custom";
  actualStartTime: string;
  pausedDurationSeconds: number;
  pauseCount: number;
  isPaused: boolean;
};

type UseActivePlanDetailsOptions = {
  planId: string | null;
  enabled?: boolean;
};

/**
 * 활성 플랜 상세 정보를 React Query로 로드하는 훅
 * 지연 로딩을 위해 클라이언트에서만 실행
 */
export function useActivePlanDetails({
  planId,
  enabled = true,
}: UseActivePlanDetailsOptions) {
  return useQuery({
    queryKey: ["activePlanDetails", planId],
    queryFn: async (): Promise<ActivePlanDetails | null> => {
      if (!planId) {
        return null;
      }

      const supabase = createSupabaseBrowserClient();

      // 플랜 기본 정보 조회
      const { data: plan, error: planError } = await supabase
        .from("student_plan")
        .select(
          "id, actual_start_time, actual_end_time, paused_duration_seconds, pause_count, content_type, content_id, content_title"
        )
        .eq("id", planId)
        .maybeSingle();

      if (planError) {
        // 컬럼이 없는 경우 (UNDEFINED_COLUMN 에러) null 반환
        if (planError.code === POSTGRES_ERROR_CODES.UNDEFINED_COLUMN) {
          return null;
        }
        throw planError;
      }

      if (!plan || !plan.actual_start_time) {
        return null;
      }

      // 활성 세션 조회하여 일시정지 상태 확인
      const { data: activeSession } = await supabase
        .from("student_study_sessions")
        .select("paused_at, resumed_at")
        .eq("plan_id", planId)
        .is("ended_at", null)
        .maybeSingle();

      const isPaused = activeSession?.paused_at && !activeSession?.resumed_at;

      // content_title이 있으면 사용, 없으면 콘텐츠 테이블에서 조회
      let title = plan.content_title || "학습 중";
      const contentType = (plan.content_type as "book" | "lecture" | "custom") || "book";

      if (!plan.content_title && plan.content_id) {
        try {
          if (contentType === "book") {
            const { data: book } = await supabase
              .from("books")
              .select("title")
              .eq("id", plan.content_id)
              .maybeSingle();
            title = book?.title || "책";
          } else if (contentType === "lecture") {
            const { data: lecture } = await supabase
              .from("lectures")
              .select("title")
              .eq("id", plan.content_id)
              .maybeSingle();
            title = lecture?.title || "강의";
          } else if (contentType === "custom") {
            const { data: custom } = await supabase
              .from("student_custom_contents")
              .select("title")
              .eq("id", plan.content_id)
              .maybeSingle();
            title = custom?.title || "커스텀 콘텐츠";
          }
        } catch (contentError) {
          console.warn("[useActivePlanDetails] 콘텐츠 제목 조회 실패", contentError);
          // 제목 조회 실패해도 계속 진행
        }
      }

      return {
        id: plan.id,
        title,
        contentType,
        actualStartTime: plan.actual_start_time,
        pausedDurationSeconds: plan.paused_duration_seconds || 0,
        pauseCount: plan.pause_count || 0,
        isPaused: !!isPaused,
      };
    },
    enabled: enabled && !!planId,
    staleTime: CACHE_STALE_TIME_REALTIME, // 10초 (실시간 업데이트를 위해 짧게)
    refetchInterval: 1000 * 30, // 30초마다 자동 리페치
  });
}

