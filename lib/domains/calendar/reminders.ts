'use client';

import { useEffect, useRef } from 'react';
import { clientNotificationRouter } from '@/lib/domains/notification/clientRouter';
import type { CalendarEventWithStudyData } from './types';

/** 리마인더 옵션 프리셋 (분 단위) */
export const REMINDER_PRESETS = [
  { label: '없음', value: null },
  { label: '5분 전', value: 5 },
  { label: '10분 전', value: 10 },
  { label: '30분 전', value: 30 },
  { label: '1시간 전', value: 60 },
] as const;

interface ScheduledTimer {
  eventId: string;
  reminderMinutes: number;
  timerId: ReturnType<typeof setTimeout>;
}

/**
 * 오늘의 캘린더 이벤트에 대해 클라이언트 사이드 리마인더를 스케줄합니다.
 *
 * - `reminder_minutes` 배열이 있는 이벤트에 대해 setTimeout 예약
 * - 브라우저 Notification API + 인앱 토스트로 알림
 * - 이벤트 목록 변경 시 타이머 재설정
 * - 마운트 해제 시 모든 타이머 정리
 */
export function useEventReminders(
  events: CalendarEventWithStudyData[],
  options?: {
    /** 인앱 토스트 콜백 (브라우저 알림 외 추가) */
    onReminder?: (event: CalendarEventWithStudyData, minutesBefore: number) => void;
    /** 비활성화 */
    enabled?: boolean;
  },
) {
  const timersRef = useRef<ScheduledTimer[]>([]);
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;

    // 기존 타이머 정리
    for (const t of timersRef.current) {
      clearTimeout(t.timerId);
    }
    timersRef.current = [];

    const now = Date.now();

    for (const event of events) {
      const reminders = event.reminder_minutes;
      if (!reminders || reminders.length === 0) continue;
      if (!event.start_at) continue;

      const eventStart = new Date(event.start_at).getTime();
      if (isNaN(eventStart)) continue;

      for (const minutesBefore of reminders) {
        const reminderTime = eventStart - minutesBefore * 60_000;
        const delay = reminderTime - now;

        // 과거 리마인더 건너뜀 (이미 지난 알림)
        if (delay < 0) continue;

        // 24시간 이내만 스케줄 (메모리 절약)
        if (delay > 24 * 60 * 60_000) continue;

        const timerId = setTimeout(() => {
          fireReminder(event, minutesBefore);
          options?.onReminder?.(event, minutesBefore);
        }, delay);

        timersRef.current.push({
          eventId: event.id,
          reminderMinutes: minutesBefore,
          timerId,
        });
      }
    }

    return () => {
      for (const t of timersRef.current) {
        clearTimeout(t.timerId);
      }
      timersRef.current = [];
    };
  }, [events, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * 통합 알림 라우터를 통해 리마인더 발송
 */
function fireReminder(event: CalendarEventWithStudyData, minutesBefore: number) {
  const timeLabel = minutesBefore >= 60
    ? `${Math.floor(minutesBefore / 60)}시간 전`
    : `${minutesBefore}분 전`;

  const startTime = event.start_at
    ? new Date(event.start_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : '';

  clientNotificationRouter.dispatch({
    type: 'event_reminder',
    title: `${event.title} - ${timeLabel}`,
    body: startTime ? `${startTime}에 시작합니다` : '곧 시작합니다',
    tag: `reminder-${event.id}-${minutesBefore}`,
    inApp: 'toast',
  });
}
