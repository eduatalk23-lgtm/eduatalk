'use client';

/**
 * 캘린더 스와이프 네비게이션 훅
 *
 * 모바일에서 좌우 스와이프로 기간 이동을 지원합니다.
 * - 일간 뷰: 1일 이동
 * - 주간 뷰: 1주 이동
 * - 월간 뷰: 1개월 이동
 */

import { useCallback, useRef, type TouchEvent } from 'react';
import { shiftDay, shiftWeek, shiftMonth, shiftCustomDays } from '../utils/weekDateUtils';
import type { CalendarView } from '../CalendarNavHeader';

interface UseCalendarSwipeNavigationOptions {
  activeView: CalendarView;
  selectedDate: string;
  onNavigate: (date: string) => void;
  enabled?: boolean;
  /** 모바일 3일 뷰 활성화 여부 (weekly에서 3일씩 이동) */
  isMobile3Day?: boolean;
  /** 커스텀 일수 (2~7, 기본 7) */
  customDayCount?: number;
}

const MIN_SWIPE_DISTANCE = 60;
const HORIZONTAL_THRESHOLD = 1.5; // 수평 이동이 수직의 1.5배 이상일 때만 스와이프

export function useCalendarSwipeNavigation({
  activeView,
  selectedDate,
  onNavigate,
  enabled = true,
  isMobile3Day = false,
  customDayCount = 7,
}: UseCalendarSwipeNavigationOptions) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    },
    [enabled]
  );

  const onTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled || !touchStartRef.current) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      touchStartRef.current = null;

      // 수직 스크롤과 구분: 수평 이동이 수직 이동의 1.5배 미만이면 무시
      if (Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_THRESHOLD) return;
      // 최소 스와이프 거리 미만이면 무시
      if (Math.abs(deltaX) < MIN_SWIPE_DISTANCE) return;

      const direction = deltaX > 0 ? -1 : 1; // 오른쪽 스와이프 = 이전, 왼쪽 = 다음

      if (activeView === 'daily') {
        onNavigate(shiftDay(selectedDate, direction));
      } else if (activeView === 'weekly') {
        if (customDayCount < 7) {
          onNavigate(shiftCustomDays(selectedDate, direction, customDayCount));
        } else if (isMobile3Day) {
          // 모바일 3일 뷰에서는 3일씩 이동
          let result = selectedDate;
          for (let i = 0; i < 3; i++) result = shiftDay(result, direction);
          onNavigate(result);
        } else {
          onNavigate(shiftWeek(selectedDate, direction));
        }
      } else {
        onNavigate(shiftMonth(selectedDate, direction));
      }
    },
    [enabled, activeView, selectedDate, onNavigate, isMobile3Day, customDayCount]
  );

  return {
    swipeHandlers: enabled
      ? { onTouchStart, onTouchEnd }
      : {},
  };
}
