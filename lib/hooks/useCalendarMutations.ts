'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { calendarEventKeys } from '@/lib/query-options/calendarEvents';
import {
  createEventAction,
  createStudyEventAction,
  updateEventAction,
  updateStudyDataAction,
  updateEventStatusAction,
  deleteEventAction,
} from '@/lib/domains/calendar/actions/events';
import type {
  CreateEventInput,
  CreateStudyEventInput,
  UpdateEventInput,
  UpdateStudyDataInput,
} from '@/lib/domains/calendar/actions/events';
import type { EventStatus } from '@/lib/domains/calendar/types';
import type { PlanStatus } from '@/lib/types/plan';
import { useOptimisticCalendarUpdate } from './useOptimisticCalendarUpdate';

// ============================================
// EventStatus → PlanStatus 매핑
// ============================================

function eventStatusToPlanStatus(status: EventStatus): PlanStatus {
  switch (status) {
    case 'confirmed':
      return 'completed';
    case 'tentative':
      return 'in_progress';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'completed';
  }
}

// ============================================
// 타입
// ============================================

type OptimisticHelper = ReturnType<typeof useOptimisticCalendarUpdate>;

// ============================================
// Mutation Hooks
// ============================================

/**
 * 일반 이벤트 생성 뮤테이션
 * (낙관적 업데이트 없음 — 서버 생성 ID 필요)
 */
export function useCreateCalendarEvent(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventInput) => createEventAction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 학습 이벤트 생성 뮤테이션 (event + study_data 동시)
 * (낙관적 업데이트 없음 — 서버 생성 ID 필요)
 */
export function useCreateStudyEvent(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateStudyEventInput) => createStudyEventAction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 이벤트 수정 뮤테이션 (낙관적 업데이트 지원)
 */
export function useUpdateCalendarEvent(
  calendarId: string,
  optimistic?: OptimisticHelper,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateEventInput }) =>
      updateEventAction(eventId, updates),
    onMutate: async ({ eventId, updates }) => {
      if (!optimistic) return;
      const rollback = optimistic.withSnapshot((data) =>
        data.map((e) =>
          e.id === eventId
            ? {
                ...e,
                ...(updates.title !== undefined && { title: updates.title }),
                ...(updates.description !== undefined && { description: updates.description }),
                ...(updates.startAt !== undefined && { start_at: updates.startAt }),
                ...(updates.endAt !== undefined && { end_at: updates.endAt }),
                ...(updates.startDate !== undefined && { start_date: updates.startDate }),
                ...(updates.endDate !== undefined && { end_date: updates.endDate }),
                ...(updates.status !== undefined && { status: updates.status }),
                ...(updates.color !== undefined && { color: updates.color }),
              }
            : e,
        ),
      );
      return { rollback };
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (optimistic) {
        optimistic.revalidate();
      } else {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.events(calendarId),
        });
      }
    },
  });
}

/**
 * 학습 추적 데이터 수정 뮤테이션 (낙관적 업데이트 지원)
 */
export function useUpdateStudyData(
  calendarId: string,
  optimistic?: OptimisticHelper,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateStudyDataInput }) =>
      updateStudyDataAction(eventId, updates),
    onMutate: async ({ eventId, updates }) => {
      if (!optimistic) return;
      // done 필드 변경 시 낙관적 업데이트
      if (updates.done !== undefined) {
        const planStatus: PlanStatus = updates.done ? 'completed' : 'in_progress';
        const rollback = optimistic.optimisticStatusChange(eventId, planStatus);
        return { rollback };
      }
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (optimistic) {
        optimistic.revalidate();
      } else {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.events(calendarId),
        });
      }
    },
  });
}

/**
 * 이벤트 상태 변경 뮤테이션 (낙관적 업데이트 지원)
 */
export function useUpdateEventStatus(
  calendarId: string,
  optimistic?: OptimisticHelper,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: EventStatus }) =>
      updateEventStatusAction(eventId, status),
    onMutate: async ({ eventId, status }) => {
      if (!optimistic) return;
      const planStatus = eventStatusToPlanStatus(status);
      const rollback = optimistic.optimisticStatusChange(eventId, planStatus);
      return { rollback };
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (optimistic) {
        optimistic.revalidate();
      } else {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.events(calendarId),
        });
      }
    },
  });
}

/**
 * 이벤트 삭제 뮤테이션 (낙관적 업데이트 지원)
 */
export function useDeleteCalendarEvent(
  calendarId: string,
  optimistic?: OptimisticHelper,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => deleteEventAction(eventId),
    onMutate: async (eventId) => {
      if (!optimistic) return;
      const rollback = optimistic.optimisticDelete(eventId);
      return { rollback };
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (optimistic) {
        optimistic.revalidate();
      } else {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.events(calendarId),
        });
      }
    },
  });
}

/**
 * 이벤트 이동 뮤테이션 (DnD, 낙관적 업데이트 지원)
 *
 * startAt/endAt만 업데이트합니다.
 * 다른 calendarId로 이동하는 경우 소스/타겟 모두 무효화합니다.
 */
export function useMoveCalendarEvent(
  calendarId: string,
  optimistic?: OptimisticHelper,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      startAt,
      endAt,
      startDate,
      endDate,
    }: {
      eventId: string;
      startAt?: string;
      endAt?: string;
      startDate?: string;
      endDate?: string;
    }) => {
      const updates: UpdateEventInput = {};
      if (startAt !== undefined) updates.startAt = startAt;
      if (endAt !== undefined) updates.endAt = endAt;
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      return updateEventAction(eventId, updates);
    },
    onMutate: async ({ eventId, startAt, endAt, startDate }) => {
      if (!optimistic) return;

      // 같은 날짜 내 시간 변경 (startDate 없음)
      if (!startDate && startAt && endAt) {
        const date = startAt.slice(0, 10);
        const startTime = startAt.slice(11, 16);
        const endTime = endAt.slice(11, 16);
        const rollback = optimistic.optimisticTimeChange(eventId, date, startTime, endTime);
        return { rollback };
      }

      // 크로스데이 또는 일반 시간 변경: 모든 캐시에서 필드 업데이트
      if (startAt || endAt || startDate) {
        const rollback = optimistic.withSnapshot((data) =>
          data.map((e) =>
            e.id === eventId
              ? {
                  ...e,
                  ...(startAt !== undefined && { start_at: startAt }),
                  ...(endAt !== undefined && { end_at: endAt }),
                  ...(startDate !== undefined && { start_date: startDate }),
                }
              : e,
          ),
        );
        return { rollback };
      }
    },
    onError: (_err, _vars, ctx) => ctx?.rollback?.(),
    onSettled: () => {
      if (optimistic) {
        optimistic.revalidate();
      } else {
        queryClient.invalidateQueries({
          queryKey: calendarEventKeys.events(calendarId),
        });
      }
    },
  });
}

// ============================================
// Composable: calendarId가 동적으로 변하는 경우
// ============================================

/**
 * calendarId 기반으로 모든 뮤테이션을 한 번에 제공하는 합성 훅
 *
 * @example
 * ```tsx
 * const { createEvent, updateEvent, deleteEvent } = useCalendarMutations(calendarId);
 * ```
 */
export function useCalendarMutations(
  calendarId: string | undefined,
  visibleCalendarIds?: string[] | null,
) {
  const safeCalendarId = calendarId ?? '';
  const optimistic = useOptimisticCalendarUpdate(safeCalendarId, visibleCalendarIds);

  const createEvent = useCreateCalendarEvent(safeCalendarId);
  const createStudyEvent = useCreateStudyEvent(safeCalendarId);
  const updateEvent = useUpdateCalendarEvent(safeCalendarId, optimistic);
  const updateStudyData = useUpdateStudyData(safeCalendarId, optimistic);
  const updateEventStatus = useUpdateEventStatus(safeCalendarId, optimistic);
  const deleteEvent = useDeleteCalendarEvent(safeCalendarId, optimistic);
  const moveEvent = useMoveCalendarEvent(safeCalendarId, optimistic);

  return {
    createEvent,
    createStudyEvent,
    updateEvent,
    updateStudyData,
    updateEventStatus,
    deleteEvent,
    moveEvent,
    isAnyMutating:
      createEvent.isPending ||
      createStudyEvent.isPending ||
      updateEvent.isPending ||
      updateStudyData.isPending ||
      updateEventStatus.isPending ||
      deleteEvent.isPending ||
      moveEvent.isPending,
  };
}
