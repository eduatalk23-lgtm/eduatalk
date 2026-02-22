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

// ============================================
// Mutation Hooks
// ============================================

/**
 * 일반 이벤트 생성 뮤테이션
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
 * 이벤트 수정 뮤테이션
 */
export function useUpdateCalendarEvent(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateEventInput }) =>
      updateEventAction(eventId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 학습 추적 데이터 수정 뮤테이션
 */
export function useUpdateStudyData(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, updates }: { eventId: string; updates: UpdateStudyDataInput }) =>
      updateStudyDataAction(eventId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 이벤트 상태 변경 뮤테이션 (간편)
 */
export function useUpdateEventStatus(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, status }: { eventId: string; status: EventStatus }) =>
      updateEventStatusAction(eventId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 이벤트 삭제 뮤테이션 (soft delete)
 */
export function useDeleteCalendarEvent(calendarId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => deleteEventAction(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
    },
  });
}

/**
 * 이벤트 이동 뮤테이션 (DnD)
 *
 * startAt/endAt만 업데이트합니다.
 * 다른 calendarId로 이동하는 경우 소스/타겟 모두 무효화합니다.
 */
export function useMoveCalendarEvent(calendarId: string) {
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
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: calendarEventKeys.events(calendarId),
      });
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
export function useCalendarMutations(calendarId: string | undefined) {
  const safeCalendarId = calendarId ?? '';

  const createEvent = useCreateCalendarEvent(safeCalendarId);
  const createStudyEvent = useCreateStudyEvent(safeCalendarId);
  const updateEvent = useUpdateCalendarEvent(safeCalendarId);
  const updateStudyData = useUpdateStudyData(safeCalendarId);
  const updateEventStatus = useUpdateEventStatus(safeCalendarId);
  const deleteEvent = useDeleteCalendarEvent(safeCalendarId);
  const moveEvent = useMoveCalendarEvent(safeCalendarId);

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
