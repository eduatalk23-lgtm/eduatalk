'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { calendarEventKeys } from '@/lib/query-options/calendarEvents';
import type {
  CalendarEventWithStudyData,
  EventStudyData,
  EventStatus,
} from '@/lib/domains/calendar/types';
import type { PlanStatus } from '@/lib/types/plan';

type RollbackFn = () => void;

// ============================================
// PlanStatus → Calendar 필드 매핑 (클라이언트용)
// ============================================

function planStatusToEventStatus(planStatus: PlanStatus): EventStatus {
  switch (planStatus) {
    case 'completed': // Task 완료는 done으로 분리, 이벤트는 confirmed 유지
      return 'confirmed';
    case 'cancelled':
      return 'cancelled';
    case 'in_progress':
    case 'draft':
      return 'tentative';
    default:
      return 'confirmed';
  }
}

// ============================================
// Hook
// ============================================

/**
 * 캘린더 이벤트 옵티미스틱 업데이트 훅
 *
 * queryClient 캐시를 직접 조작하여 즉시 UI 반영 + 실패 시 롤백.
 * calendarEventKeys.events(calendarId) prefix에 해당하는 모든 쿼리(daily, weekly, monthly, unfinished)를
 * 순회하며 업데이트합니다.
 */
export function useOptimisticCalendarUpdate(calendarId: string | undefined) {
  const queryClient = useQueryClient();

  /**
   * 모든 events 쿼리를 스냅샷 → 변환 → 롤백 함수 반환
   * mutate는 배열 변환 함수 (CalendarEventWithStudyData[] → CalendarEventWithStudyData[])
   */
  const withSnapshot = useCallback(
    (
      mutate: (
        data: CalendarEventWithStudyData[],
        queryKey: readonly unknown[],
      ) => CalendarEventWithStudyData[],
    ): RollbackFn => {
      if (!calendarId) return () => {};

      const queryFilter = {
        queryKey: calendarEventKeys.events(calendarId),
      };
      const snapshots: [
        readonly unknown[],
        CalendarEventWithStudyData[] | undefined,
      ][] = [];

      const queries =
        queryClient.getQueriesData<CalendarEventWithStudyData[]>(queryFilter);
      for (const [key, data] of queries) {
        snapshots.push([key, data]);
        if (data) {
          queryClient.setQueryData(key, mutate(data, key));
        }
      }

      return () => {
        for (const [key, data] of snapshots) {
          queryClient.setQueryData(key, data);
        }
      };
    },
    [queryClient, calendarId],
  );

  /** 이벤트 상태 즉시 변경 (색상 즉시 반영) */
  const optimisticStatusChange = useCallback(
    (eventId: string, newStatus: PlanStatus): RollbackFn => {
      const eventStatus = planStatusToEventStatus(newStatus);
      const done = newStatus === 'completed';

      return withSnapshot((data) =>
        data.map((e) =>
          e.id === eventId
            ? {
                ...e,
                status: eventStatus,
                event_study_data: e.event_study_data
                  ? {
                      ...e.event_study_data,
                      done,
                      done_at: done ? new Date().toISOString() : null,
                    }
                  : done
                    ? ({
                        // event_study_data가 없는 경우 합성 객체 생성 (서버에서 UPSERT됨)
                        id: crypto.randomUUID(),
                        event_id: eventId,
                        done: true,
                        done_at: new Date().toISOString(),
                        done_by: null,
                        content_type: null,
                        content_title: null,
                        content_id: null,
                        flexible_content_id: null,
                        master_content_id: null,
                        subject_category: null,
                        subject_name: null,
                        chapter: null,
                        planned_start_page: null,
                        planned_end_page: null,
                        completed_amount: null,
                        estimated_minutes: null,
                        actual_minutes: null,
                        progress: null,
                        memo: null,
                        origin_plan_item_id: null,
                        started_at: null,
                        paused_at: null,
                        paused_duration_seconds: null,
                        pause_count: null,
                      } satisfies EventStudyData)
                    : null,
              }
            : e,
        ),
      );
    },
    [withSnapshot],
  );

  /** 이벤트 캐시에서 즉시 제거 (삭제 즉시 반영) */
  const optimisticDelete = useCallback(
    (eventId: string): RollbackFn => {
      return withSnapshot((data) => data.filter((e) => e.id !== eventId));
    },
    [withSnapshot],
  );

  /** 같은 날짜 내 시간 즉시 변경 (리사이즈/같은날 드래그) */
  const optimisticTimeChange = useCallback(
    (
      eventId: string,
      date: string,
      startTime: string,
      endTime: string,
      estimatedMinutes?: number,
    ): RollbackFn => {
      const newStartAt = `${date}T${startTime}:00+09:00`;
      const newEndAt = `${date}T${endTime}:00+09:00`;

      return withSnapshot((data) =>
        data.map((e) =>
          e.id === eventId
            ? {
                ...e,
                start_at: newStartAt,
                end_at: newEndAt,
                ...(e.event_study_data && estimatedMinutes !== undefined
                  ? {
                      event_study_data: {
                        ...e.event_study_data,
                        estimated_minutes: estimatedMinutes,
                      },
                    }
                  : {}),
              }
            : e,
        ),
      );
    },
    [withSnapshot],
  );

  /** 다른 날짜로 이동 (크로스데이 드래그) — daily 캐시 간 이동 처리 */
  const optimisticDateMove = useCallback(
    (
      eventId: string,
      sourceDate: string,
      targetDate: string,
      startTime: string,
      endTime: string,
      estimatedMinutes?: number,
    ): RollbackFn => {
      if (!calendarId) return () => {};

      const newStartAt = `${targetDate}T${startTime}:00+09:00`;
      const newEndAt = `${targetDate}T${endTime}:00+09:00`;

      const queryFilter = {
        queryKey: calendarEventKeys.events(calendarId),
      };
      const snapshots: [
        readonly unknown[],
        CalendarEventWithStudyData[] | undefined,
      ][] = [];
      const queries =
        queryClient.getQueriesData<CalendarEventWithStudyData[]>(queryFilter);

      // 1단계: 어떤 캐시에서든 원본 이벤트를 찾아 복제
      let movedEvent: CalendarEventWithStudyData | undefined;
      for (const [, data] of queries) {
        if (!data) continue;
        const found = data.find((e) => e.id === eventId);
        if (found) {
          movedEvent = {
            ...found,
            start_at: newStartAt,
            end_at: newEndAt,
            start_date: targetDate,
            ...(found.event_study_data && estimatedMinutes !== undefined
              ? {
                  event_study_data: {
                    ...found.event_study_data,
                    estimated_minutes: estimatedMinutes,
                  },
                }
              : {}),
          };
          break;
        }
      }

      // 2단계: 각 캐시별 적절한 처리
      for (const [key, data] of queries) {
        snapshots.push([key, data]);
        if (!data) continue;

        const isDaily = key.length >= 5 && key[3] === 'daily';
        const dailyDate = isDaily ? (key[4] as string) : null;

        if (isDaily && dailyDate === sourceDate) {
          // 소스 날짜 캐시에서 제거
          queryClient.setQueryData(
            key,
            data.filter((e) => e.id !== eventId),
          );
        } else if (isDaily && dailyDate === targetDate && movedEvent) {
          // 타겟 날짜 캐시에 추가
          queryClient.setQueryData(key, [...data, movedEvent]);
        } else {
          // weekly/monthly/unfinished: start_at 업데이트 (어댑터가 날짜별 그룹핑)
          queryClient.setQueryData(
            key,
            data.map((e) => (e.id === eventId ? (movedEvent ?? e) : e)),
          );
        }
      }

      return () => {
        for (const [key, data] of snapshots) {
          queryClient.setQueryData(key, data);
        }
      };
    },
    [queryClient, calendarId],
  );

  /** 배경 재검증 — 성공 후 fresh data 보장 */
  const revalidate = useCallback(() => {
    if (!calendarId) return;
    queryClient.invalidateQueries({
      queryKey: calendarEventKeys.events(calendarId),
    });
  }, [queryClient, calendarId]);

  return {
    optimisticStatusChange,
    optimisticDelete,
    optimisticTimeChange,
    optimisticDateMove,
    revalidate,
  };
}
