'use client';

import { useState, useCallback, useEffect, useRef, useMemo, type MutableRefObject, type RefObject } from 'react';
import { timeToMinutes, minutesToTime } from '../utils/timeGridUtils';
import { createDragAutoScroll } from '../utils/dragAutoScroll';
import {
  pxToLogicalMinutes,
  logicalMinutesToPx,
  resolvePhysicalTime,
  EXTENSION_ZONE_END,
  type LogicalDayConfig,
} from '../utils/logicalDayUtils';
import { movePlanToDate } from '@/lib/domains/admin-plan/actions/movePlanToDate';
import { updateItemTime, createRecurringException } from '@/lib/domains/calendar/actions/calendarEventActions';
import type { PlanItemData } from '@/lib/types/planItem';
import type { UndoableAction } from '../undoTypes';

interface UseCrossDayDragInput {
  columnRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
  displayRange: { start: string; end: string };
  pxPerMinute: number;
  snapMinutes: number;
  enabled: boolean;
  /** 새벽 접기 상태 */
  deadZoneCollapsed: boolean;
  studentId: string;
  calendarId: string;
  onMoveComplete: (sourceDate: string, targetDate: string) => void;
  onUndoPush?: (action: UndoableAction) => void;
  /** 서버 호출 전 옵티미스틱 업데이트; rollback 함수를 반환 */
  onBeforeMove?: (params: {
    planId: string;
    sourceDate: string;
    targetDate: string;
    newStartTime: string;
    newEndTime: string;
    durationMinutes: number;
  }) => (() => void) | undefined;
  /** 서버 호출 실패 시 에러 콜백 */
  onError?: (message: string) => void;
}

interface GhostPosition {
  date: string;
  top: number;
  height: number;
  left: number;
  width: number;
  startTime: string;
  endTime: string;
  plan: PlanItemData;
}

export function useCrossDayDrag({
  columnRefs,
  scrollContainerRef,
  displayRange,
  pxPerMinute,
  snapMinutes,
  enabled,
  deadZoneCollapsed,
  studentId,
  calendarId,
  onMoveComplete,
  onUndoPush,
  onBeforeMove,
  onError,
}: UseCrossDayDragInput) {
  const [isDragging, setIsDragging] = useState(false);
  const [ghost, setGhost] = useState<GhostPosition | null>(null);
  const [draggingPlanId, setDraggingPlanId] = useState<string | null>(null);

  const logicalConfig: LogicalDayConfig = useMemo(
    () => ({ deadZoneCollapsed, pxPerMinute }),
    [deadZoneCollapsed, pxPerMinute],
  );

  const dragDataRef = useRef<{
    plan: PlanItemData;
    sourceDate: string;
    sourceDurationMin: number;
    sourceHeightPx: number;
    offsetY: number; // mousedown 위치와 블록 top 사이의 offset
  } | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof createDragAutoScroll> | null>(null);
  /** 마우스 거리 감지용 (GCal 데스크톱: 5px 움직임으로 드래그 시작) */
  const pendingDragRef = useRef<{
    plan: PlanItemData;
    sourceDate: string;
    durationMin: number;
    offsetY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const DRAG_DISTANCE_THRESHOLD = 5; // px
  /** biweekly 자동 스크롤: 현재 타겟 주의 스크롤 컨테이너 추적 */
  const autoScrollContainerRef = useRef<HTMLElement | null>(null);

  const getDateFromX = useCallback(
    (clientX: number, clientY?: number): string | null => {
      // clientY가 제공되면 X+Y 모두 확인 (biweekly: 같은 X에 2주치 컬럼이 겹침)
      // 컬럼 rect를 스크롤 컨테이너의 가시 영역으로 클리핑하여
      // overflow 밖으로 확장된 컬럼이 매칭되지 않도록 함
      if (clientY != null) {
        for (const [date, el] of columnRefs.current.entries()) {
          const rect = el.getBoundingClientRect();
          // 가장 가까운 스크롤 영역으로 Y 범위 클리핑
          const scrollArea = el.closest('[data-scroll-area]') as HTMLElement | null;
          const areaRect = scrollArea?.getBoundingClientRect();
          const visibleTop = areaRect ? Math.max(rect.top, areaRect.top) : rect.top;
          const visibleBottom = areaRect ? Math.min(rect.bottom, areaRect.bottom) : rect.bottom;

          if (clientX >= rect.left && clientX <= rect.right &&
              clientY >= visibleTop && clientY <= visibleBottom) {
            return date;
          }
        }
      }
      // fallback: X만으로 판별 (biweekly에서는 clientY가 항상 제공되므로 미도달)
      for (const [date, el] of columnRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return date;
        }
      }
      return null;
    },
    [columnRefs],
  );

  /** px → 논리적 분 (snap 적용, 클램프) */
  const getMinutesFromY = useCallback(
    (clientY: number, columnDate: string): number => {
      const colEl = columnRefs.current.get(columnDate);
      if (!colEl) return 0;
      const rect = colEl.getBoundingClientRect();
      const offsetY = clientY - rect.top;
      const logicalMin = pxToLogicalMinutes(offsetY, logicalConfig);
      const snapped = Math.floor(logicalMin / snapMinutes) * snapMinutes;
      return Math.max(0, Math.min(snapped, EXTENSION_ZONE_END));
    },
    [columnRefs, deadZoneCollapsed, pxPerMinute, snapMinutes],
  );

  /** 드래그 활성화 공통 로직 */
  const activateDrag = useCallback(
    (plan: PlanItemData, sourceDate: string, durationMin: number, offsetY: number) => {
      dragDataRef.current = {
        plan,
        sourceDate,
        sourceDurationMin: durationMin,
        sourceHeightPx: durationMin * pxPerMinute,
        offsetY,
      };
      setDraggingPlanId(plan.id);
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      // 자동 스크롤 시작
      const container = scrollContainerRef?.current;
      if (container) {
        autoScrollRef.current = createDragAutoScroll(container);
        autoScrollRef.current.start();
      }
    },
    [pxPerMinute, scrollContainerRef],
  );

  const startDrag = useCallback(
    (plan: PlanItemData, sourceDate: string, e: React.MouseEvent | React.TouchEvent) => {
      if (!enabled) return;

      const isTouch = 'touches' in e;
      const clientX = isTouch ? e.touches[0].clientX : e.clientX;
      const clientY = isTouch ? e.touches[0].clientY : e.clientY;

      // 블록 top 위치 기준 offset 계산
      const blockEl = (e.target as HTMLElement).closest('[data-grid-block]');
      const blockRect = blockEl?.getBoundingClientRect();
      const offsetY = blockRect ? clientY - blockRect.top : 0;

      // 물리적 시간차로 duration 계산 (자정 넘김: 음수면 +24h 보정)
      let durationMin = plan.estimatedMinutes ?? 60;
      if (plan.startTime && plan.endTime) {
        const physStart = timeToMinutes(plan.startTime);
        const physEnd = timeToMinutes(plan.endTime);
        let diff = physEnd - physStart;
        if (diff <= 0) diff += 24 * 60; // 자정 넘김 보정
        if (diff > 0 && diff < 24 * 60) durationMin = diff;
      }

      if (isTouch) {
        // 터치: 150ms 롱프레스 (GCal 모바일)
        longPressTimerRef.current = setTimeout(() => {
          pendingDragRef.current = null;
          activateDrag(plan, sourceDate, durationMin, offsetY);
        }, 150);
      } else {
        // 마우스: 5px 거리 임계값 (GCal 데스크톱 — 즉시에 가까운 시작)
        pendingDragRef.current = {
          plan, sourceDate, durationMin, offsetY,
          startX: clientX, startY: clientY,
        };
      }
    },
    [enabled, activateDrag],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      // GCal 데스크톱: 5px 거리 초과 시 드래그 활성화
      if (pendingDragRef.current && !isDragging) {
        const dx = e.clientX - pendingDragRef.current.startX;
        const dy = e.clientY - pendingDragRef.current.startY;
        if (Math.abs(dx) + Math.abs(dy) >= DRAG_DISTANCE_THRESHOLD) {
          const p = pendingDragRef.current;
          pendingDragRef.current = null;
          activateDrag(p.plan, p.sourceDate, p.durationMin, p.offsetY);
        }
        return;
      }

      if (!dragDataRef.current || !isDragging) return;

      const targetDate = getDateFromX(e.clientX, e.clientY);
      if (!targetDate) return;

      const colEl = columnRefs.current.get(targetDate);
      if (!colEl) return;

      // 자동 스크롤: biweekly에서는 타겟 컬럼의 스크롤 컨테이너로 전환
      const targetScrollArea = colEl.closest('[data-scroll-area]') as HTMLElement | null;
      if (targetScrollArea && targetScrollArea !== autoScrollContainerRef.current) {
        autoScrollRef.current?.stop();
        autoScrollRef.current = createDragAutoScroll(targetScrollArea);
        autoScrollRef.current.start();
        autoScrollContainerRef.current = targetScrollArea;
      }
      autoScrollRef.current?.update(e.clientY);

      const colRect = colEl.getBoundingClientRect();
      const scrollParent = targetScrollArea ?? scrollContainerRef?.current;
      const containerRect = (scrollParent as HTMLElement | null)?.getBoundingClientRect();

      // 드래그 중인 위치에서 논리적 분 계산 (GCal 스타일: 마우스 잡은 위치 유지)
      const topMinutesRaw = getMinutesFromY(
        e.clientY - dragDataRef.current.offsetY,
        targetDate,
      );
      const snappedTop = Math.floor(topMinutesRaw / snapMinutes) * snapMinutes;
      const clampedTop = Math.max(0, Math.min(snappedTop, EXTENSION_ZONE_END - dragDataRef.current.sourceDurationMin));

      // 논리적 분 → 물리적 시간으로 변환 (ghost 표시용)
      const startPhysical = resolvePhysicalTime(targetDate, clampedTop);
      const endPhysical = resolvePhysicalTime(targetDate, clampedTop + dragDataRef.current.sourceDurationMin);

      const topPx = logicalMinutesToPx(clampedTop, logicalConfig);
      const bottomPx = logicalMinutesToPx(clampedTop + dragDataRef.current.sourceDurationMin, logicalConfig);

      setGhost({
        date: targetDate,
        top: topPx,
        height: Math.max(bottomPx - topPx, 2),
        left: colRect.left - (containerRect?.left ?? 0),
        width: colRect.width,
        startTime: startPhysical.physicalTimeHHMM,
        endTime: endPhysical.physicalTimeHHMM,
        plan: dragDataRef.current.plan,
      });
    },
    [isDragging, activateDrag, getDateFromX, getMinutesFromY, columnRefs, scrollContainerRef, deadZoneCollapsed, pxPerMinute, snapMinutes],
  );

  const handleMouseUp = useCallback(
    async (e: MouseEvent) => {
      // long press 타이머 취소
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // pending 거리 감지 취소 (클릭으로 간주)
      pendingDragRef.current = null;

      // 자동 스크롤 정지
      autoScrollRef.current?.stop();
      autoScrollRef.current = null;
      autoScrollContainerRef.current = null;

      if (!dragDataRef.current || !isDragging) {
        dragDataRef.current = null;
        return;
      }

      const targetDate = getDateFromX(e.clientX, e.clientY);
      const data = dragDataRef.current;

      // 정리
      setIsDragging(false);
      setGhost(null);
      setDraggingPlanId(null);
      dragDataRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // ★ trailing click 방지: 드래그 종료 후 브라우저가 발생시키는 click 이벤트를
      // 한 번 소비하여 handleGridClick(퀵생성)과의 경합 방지
      const container = scrollContainerRef?.current;
      if (container) {
        const swallowClick = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        container.addEventListener('click', swallowClick, { capture: true, once: true });
        setTimeout(() => container.removeEventListener('click', swallowClick, { capture: true }), 300);
      }

      if (!targetDate || !data.plan.startTime) return;

      // 드롭 위치의 논리적 분 계산 → 물리적 날짜+시간으로 변환
      const dropTopMinutes = getMinutesFromY(e.clientY - data.offsetY, targetDate);
      const newStartMin = Math.round(dropTopMinutes / snapMinutes) * snapMinutes;
      const clampedStart = Math.max(0, Math.min(newStartMin, EXTENSION_ZONE_END - data.sourceDurationMin));
      const newEndMin = clampedStart + data.sourceDurationMin;

      // 논리적 분 → 물리적 날짜+시간 (연장 영역이면 다음날로 변환)
      const startPhysical = resolvePhysicalTime(targetDate, clampedStart);
      const endPhysical = resolvePhysicalTime(targetDate, newEndMin);
      const newStartTime = startPhysical.physicalTimeHHMM;
      const newEndTime = endPhysical.physicalTimeHHMM;
      // 실제 물리적 targetDate (연장 영역이면 다음날)
      const physicalTargetDate = startPhysical.physicalDate;

      // 이전 값 캡처 (undo용)
      const prevDate = data.sourceDate;
      const prevStartTime = data.plan.startTime!;
      const prevEndTime = data.plan.endTime ?? '';
      const prevEstimatedMinutes = data.plan.estimatedMinutes ?? undefined;

      // 반복 이벤트: 자동 'this' scope (GCal 동작 — 드래그 시 모달 없이 exception 생성)
      const isRecurring = !!(data.plan.rrule || data.plan.recurringEventId);
      const isRecurringInstance = isRecurring && !data.plan.isException;

      const rollback = onBeforeMove?.({
            planId: data.plan.id,
            sourceDate: data.sourceDate,
            targetDate: physicalTargetDate,
            newStartTime,
            newEndTime,
            durationMinutes: data.sourceDurationMin,
          });

      try {
        if (isRecurringInstance) {
          // 확장 인스턴스: exception 생성 + 시간/날짜 오버라이드
          const parentId = data.plan.recurringEventId ?? data.plan.id;
          const startAt = `${physicalTargetDate}T${newStartTime}:00+09:00`;
          const endAt = `${endPhysical.physicalDate}T${newEndTime}:00+09:00`;

          const result = await createRecurringException({
            parentEventId: parentId,
            instanceDate: data.sourceDate,
            overrides: {
              start_at: startAt,
              end_at: endAt,
              start_date: physicalTargetDate,
            },
          });
          if (!result.success) {
            rollback?.();
            onError?.(result.error || '반복 일정 이동에 실패했습니다.');
            return;
          }
          onMoveComplete(data.sourceDate, physicalTargetDate);

          onUndoPush?.({
            type: 'move-to-date',
            planId: data.plan.id,
            studentId,
            prev: {
              date: prevDate,
              startTime: prevStartTime,
              endTime: prevEndTime,
              estimatedMinutes: prevEstimatedMinutes,
            },
            description: '반복 일정이 이동되었습니다.',
          });
        } else if (physicalTargetDate !== data.sourceDate) {
          // 다른 날짜로 이동 (비반복 or exception)
          await movePlanToDate({
            planId: data.plan.id,
            studentId,
            targetDate: physicalTargetDate,
            newStartTime,
            newEndTime,
            estimatedMinutes: data.sourceDurationMin,
          });
          onMoveComplete(data.sourceDate, physicalTargetDate);

          onUndoPush?.({
            type: 'move-to-date',
            planId: data.plan.id,
            studentId,
            prev: {
              date: prevDate,
              startTime: prevStartTime,
              endTime: prevEndTime,
              estimatedMinutes: prevEstimatedMinutes,
            },
            description: '플랜이 이동되었습니다.',
          });
        } else {
          // 같은 날짜 내 시간만 변경
          const isSameDayRecurring = !!(data.plan.rrule || data.plan.recurringEventId) && !data.plan.isException;

          if (isSameDayRecurring) {
            // 반복 이벤트 가상 인스턴스: exception 생성 (GCal 동작 — "이 이벤트만")
            const parentId = data.plan.recurringEventId ?? data.plan.id;
            const startAt = `${physicalTargetDate}T${newStartTime}:00+09:00`;
            const endAt = `${endPhysical.physicalDate}T${newEndTime}:00+09:00`;

            const result = await createRecurringException({
              parentEventId: parentId,
              instanceDate: data.sourceDate,
              overrides: {
                start_at: startAt,
                end_at: endAt,
              },
            });
            if (!result.success) {
              rollback?.();
              onError?.(result.error || '반복 일정 시간 변경에 실패했습니다.');
              return;
            }
          } else {
            await updateItemTime({
              studentId,
              calendarId,
              planDate: physicalTargetDate,
              itemId: data.plan.id,
              itemType: 'plan',
              newStartTime,
              newEndTime,
              estimatedMinutes: data.sourceDurationMin,
            });
          }
          onMoveComplete(data.sourceDate, physicalTargetDate);

          // exception 생성 시 undo 불가 (새 ID로 생성되므로 부모 ID로 되돌릴 수 없음)
          if (!isSameDayRecurring) {
            onUndoPush?.({
              type: 'resize',
              planId: data.plan.id,
              studentId,
              calendarId,
              planDate: data.sourceDate,
              prev: {
                startTime: prevStartTime,
                endTime: prevEndTime,
                estimatedMinutes: prevEstimatedMinutes,
              },
              description: '시간이 변경되었습니다.',
            });
          }
        }
      } catch {
        rollback?.();
        onError?.('플랜 이동에 실패했습니다.');
      }
    },
    [
      isDragging,
      getDateFromX,
      getMinutesFromY,
      deadZoneCollapsed,
      snapMinutes,
      studentId,
      calendarId,
      onMoveComplete,
      onUndoPush,
      onBeforeMove,
      onError,
      scrollContainerRef,
    ],
  );

  // Escape 취소
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // pending drag 취소
        pendingDragRef.current = null;
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isDragging) {
          // 자동 스크롤 정지
          autoScrollRef.current?.stop();
          autoScrollRef.current = null;
          autoScrollContainerRef.current = null;
          // 상태 초기화 (서버 호출 없음)
          setIsDragging(false);
          setGhost(null);
          setDraggingPlanId(null);
          dragDataRef.current = null;
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      }
    },
    [isDragging],
  );

  // enabled가 false로 바뀌면 진행 중인 드래그/타이머 즉시 정리
  // (리사이즈 시작 시 isResizing=true → enabled=false → 여기서 드래그 상태 정리)
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    // enabled가 true→false로 전환될 때만 정리 (ref로 상태 체크)
    if (prevEnabledRef.current && !enabled) {
      // pending 거리 감지 취소
      pendingDragRef.current = null;
      // 롱프레스 타이머 취소
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      // 진행 중인 드래그 정리 (ref로 체크 — setState 직접호출 회피)
      if (dragDataRef.current) {
        autoScrollRef.current?.stop();
        autoScrollRef.current = null;
        autoScrollContainerRef.current = null;
        dragDataRef.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    }
    prevEnabledRef.current = enabled;
  }, [enabled]);

  // 마우스 이벤트 등록
  useEffect(() => {
    if (!enabled) return;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleMouseMove, handleMouseUp, handleKeyDown]);

  // 클린업
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      autoScrollRef.current?.stop();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  /** 외부에서 호출: 대기 중인 드래그 취소 + 진행 중 드래그 정리 */
  const cancelPendingDrag = useCallback(() => {
    // 마우스 거리 감지 pending 취소
    pendingDragRef.current = null;
    // 터치 롱프레스 타이머 취소
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    // 진행 중인 드래그도 정리 (이벤트 핸들러에서 호출되므로 setState 안전)
    if (dragDataRef.current) {
      autoScrollRef.current?.stop();
      autoScrollRef.current = null;
      autoScrollContainerRef.current = null;
      setIsDragging(false);
      setGhost(null);
      setDraggingPlanId(null);
      dragDataRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, []);

  return {
    isDragging,
    startDrag,
    ghost,
    draggingPlanId,
    targetDate: ghost?.date ?? null,
    cancelPendingDrag,
  };
}
