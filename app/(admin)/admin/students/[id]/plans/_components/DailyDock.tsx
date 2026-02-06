'use client';

import { useState, useTransition, useMemo, useCallback, useEffect, memo, useRef } from 'react';
import { cn } from '@/lib/cn';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core';
import { DroppableContainer, SortablePlanItem, DraggableNonStudyItem, DroppableEmptySlot, type NonStudyDropData, type UnifiedReorderData } from './dnd';
import { SortableUnifiedItem, createUnifiedId } from './dnd/SortableUnifiedItem';
import type { UnifiedDragData, TimelineItemType } from '@/lib/types/unifiedTimeline';
import { usePlanToast } from './PlanToast';
import { BulkRedistributeModal } from './BulkRedistributeModal';
import { PlanItemCard, toPlanItemData, NonStudyTimeCard, EmptyTimeSlotCard } from './items';
import type { EmptySlot } from '@/lib/domains/admin-plan/utils/emptySlotCalculation';
import type { TimeSlot } from '@/lib/types/plan-generation';
import { useDailyDockQuery, useNonStudyTimeQuery } from '@/lib/hooks/useAdminDockQueries';
import { detectTimeConflicts } from '@/lib/domains/admin-plan/utils/conflictDetection';
import type { NonStudyItem } from '@/lib/query-options/adminDock';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { deletePlan, movePlanToContainer } from '@/lib/domains/plan/actions/dock';
import { reorderPlansWithTimeRecalculation } from '@/lib/domains/plan/actions/reorder';
import { executeUnifiedReorder, updateItemTime } from '@/lib/domains/plan/actions/unifiedReorder';
import type { TimeSlotBoundary, TimelineItem } from '@/lib/types/unifiedTimeline';
import { calculateUnifiedReorder, predictReorderMode } from '@/lib/domains/plan/utils/unifiedReorderCalculation';
import { parseUnifiedId } from './dnd/SortableUnifiedItem';
import { NonStudyTimeEditModal } from './modals/NonStudyTimeEditModal';
import { CollapsedDockCard } from './CollapsedDockCard';
import type { ContentTypeFilter } from './AdminPlanManagement';
import type { PlanStatus } from '@/lib/types/plan';

/** 스켈레톤 로딩 UI용 상수 배열 (매 렌더마다 새 배열 생성 방지) */
const SKELETON_ITEMS = [1, 2] as const;

interface DailyDockProps {
  studentId: string;
  tenantId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  selectedDate: string;
  /** 선택된 플랜 그룹 ID (null = 전체 보기) */
  selectedGroupId?: string | null;
  /** 콘텐츠 유형 필터 */
  contentTypeFilter?: ContentTypeFilter;
  /** 플래너에서 설정한 시간 슬롯 (학습시간, 점심시간, 학원일정 등) */
  timeSlots?: TimeSlot[];
  onRedistribute: (planId: string) => void;
  onEdit?: (planId: string) => void;
  onReorder?: () => void;
  onMoveToGroup?: (planIds: string[], currentGroupId?: string | null) => void;
  onCopy?: (planIds: string[]) => void;
  onStatusChange?: (planId: string, currentStatus: PlanStatus, title: string) => void;
  /** 전체 새로고침 (기본) */
  onRefresh: () => void;
  /** Daily + Weekly만 새로고침 (컨테이너 이동 시 사용) */
  onRefreshDailyAndWeekly?: () => void;
  /** 빈 시간 슬롯에 새 플랜 생성 */
  onCreatePlanAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  /** 빈 시간 슬롯에 미완료 플랜 배치 */
  onPlaceUnfinishedAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  /** 빈 시간 슬롯에 주간독 플랜 배치 */
  onPlaceWeeklyAtSlot?: (slotStartTime: string, slotEndTime: string) => void;
  /** 비학습시간 드래그로 시간 변경 가능 여부 */
  enableNonStudyDrag?: boolean;
  /** 통합 재정렬 활성화 (플랜 + 비학습시간 함께 재정렬) */
  enableUnifiedReorder?: boolean;
  /** 통합 재정렬 핸들러 */
  onUnifiedReorder?: (data: UnifiedReorderData) => Promise<void>;
  /** SSR 프리페치된 데이터 */
  initialData?: {
    plans?: import('@/lib/query-options/adminDock').DailyPlan[];
    adHocPlans?: import('@/lib/query-options/adminDock').AdHocPlan[];
    nonStudyItems?: import('@/lib/query-options/adminDock').NonStudyItem[];
  };
  /** 축소 상태 여부 (가로 아코디언 레이아웃용) */
  isCollapsed?: boolean;
  /** 확장 클릭 핸들러 (축소 상태에서만 사용) */
  onExpand?: () => void;
}

/**
 * DailyDock - 일일 플랜 Dock 컴포넌트
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const DailyDock = memo(function DailyDock({
  studentId,
  tenantId,
  plannerId,
  selectedDate,
  selectedGroupId,
  contentTypeFilter = 'all',
  timeSlots,
  onRedistribute,
  onEdit,
  onReorder,
  onMoveToGroup,
  onCopy,
  onStatusChange,
  onRefresh,
  onRefreshDailyAndWeekly,
  onCreatePlanAtSlot,
  onPlaceUnfinishedAtSlot,
  onPlaceWeeklyAtSlot,
  enableNonStudyDrag = false,
  enableUnifiedReorder = false,
  onUnifiedReorder,
  initialData,
  isCollapsed = false,
  onExpand,
}: DailyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지, SSR 프리페치 데이터 활용)
  const { plans: allPlans, adHocPlans, isLoading } = useDailyDockQuery(
    studentId,
    selectedDate,
    plannerId,
    initialData
  );

  // 비학습시간 데이터 조회 (SSR 프리페치 데이터 활용, 플랜 로딩 완료 후 실행)
  const { nonStudyItems } = useNonStudyTimeQuery(
    studentId,
    selectedDate,
    allPlans,
    !isLoading,
    plannerId,
    initialData?.nonStudyItems
  );

  // 디버깅: nonStudyItems에 UUID가 있는지 확인
  console.log('[DailyDock] nonStudyItems:', nonStudyItems.map(item => ({
    id: item.id,
    type: item.type,
    sourceIndex: item.sourceIndex,
    start_time: item.start_time,
  })));

  // 보기 모드: "all" = 플랜 + 비학습시간, "plans" = 플랜만
  // SSR hydration 안전: 항상 'all'로 시작, 클라이언트에서 localStorage 복원
  const [viewMode, setViewMode] = useState<'plans' | 'all'>('all');

  useEffect(() => {
    const saved = localStorage.getItem('dailyDock_viewMode');
    if (saved === 'plans' || saved === 'all') {
      setViewMode(saved);
    }
  }, []);

  const handleViewModeChange = useCallback((mode: 'plans' | 'all') => {
    setViewMode(mode);
    localStorage.setItem('dailyDock_viewMode', mode);
  }, []);

  // 그룹 필터링 적용
  const groupFilteredPlans = useMemo(() => {
    if (selectedGroupId === null || selectedGroupId === undefined) return allPlans;
    return allPlans.filter(plan => plan.plan_group_id === selectedGroupId);
  }, [allPlans, selectedGroupId]);

  // 콘텐츠 유형 필터 적용
  const plans = useMemo(() => {
    if (contentTypeFilter === 'all') return groupFilteredPlans;
    return groupFilteredPlans.filter(plan => plan.content_type === contentTypeFilter);
  }, [groupFilteredPlans, contentTypeFilter]);

  // Optimistic update를 위한 로컬 플랜 순서 (드래그 중 임시 순서 반영)
  const [localPlanOrder, setLocalPlanOrder] = useState<string[] | null>(null);

  // 통합 재정렬 Optimistic update를 위한 상태
  // { items: 재정렬된 MergedItem[], mode: 'push' | 'pull', emptySlot?: 빈 공간 }
  const [optimisticUnifiedOrder, setOptimisticUnifiedOrder] = useState<{
    items: Array<{
      id: string;
      kind: 'plan' | 'nonStudy' | 'timeSlot';
      startTime: string;
      endTime: string;
    }>;
    mode: 'push' | 'pull';
    emptySlot?: {
      start: string;
      end: string;
      durationMinutes: number;
    };
  } | null>(null);

  // plans 또는 nonStudyItems가 변경되면 optimistic 상태 초기화
  useEffect(() => {
    setLocalPlanOrder(null);
    setOptimisticUnifiedOrder(null);
  }, [plans, nonStudyItems]);

  // 실제 렌더링에 사용할 정렬된 플랜 목록
  const sortedPlans = useMemo(() => {
    if (!localPlanOrder) return plans;
    const planMap = new Map(plans.map(p => [p.id, p]));
    return localPlanOrder
      .map(id => planMap.get(id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  }, [plans, localPlanOrder]);

  // DnD 순서 변경 활성화 조건:
  // - 전체 보기 상태 (selectedGroupId가 null 또는 undefined)
  // - 전체 콘텐츠 유형 필터 (contentTypeFilter === 'all')
  // 필터링된 상태에서는 순서 변경 시 고려사항이 너무 많아 비활성화
  const isDndReorderEnabled = useMemo(
    () => (selectedGroupId === null || selectedGroupId === undefined) && contentTypeFilter === 'all',
    [selectedGroupId, contentTypeFilter]
  );

  // SortableContext에 전달할 플랜 ID 배열 (완료된 플랜 제외)
  // DnD 비활성화 시 빈 배열 반환
  const sortableIds = useMemo(
    () => isDndReorderEnabled
      ? sortedPlans.filter(p => p.status !== 'completed').map(p => p.id)
      : [],
    [sortedPlans, isDndReorderEnabled]
  );

  // 재정렬에 필요한 훅들
  const [isPending, startTransition] = useTransition();
  const { showToast } = usePlanToast();

  // 드래그앤드롭 순서 변경 핸들러
  const handleReorderPlans = useCallback(
    async (activeId: string, overId: string) => {
      // 같은 ID면 무시
      if (activeId === overId) return;

      const oldIndex = sortedPlans.findIndex(p => p.id === activeId);
      const newIndex = sortedPlans.findIndex(p => p.id === overId);

      if (oldIndex === -1 || newIndex === -1) return;

      // Optimistic update: UI 즉시 반영
      const newOrder = arrayMove(sortedPlans, oldIndex, newIndex);
      setLocalPlanOrder(newOrder.map(p => p.id));

      // Server Action 호출
      startTransition(async () => {
        const result = await reorderPlansWithTimeRecalculation({
          planIds: newOrder.map(p => p.id),
          studentId,
          planDate: selectedDate,
        });

        if (!result.success) {
          // 실패 시 롤백
          setLocalPlanOrder(null);
          showToast(result.error ?? '순서 변경 실패', 'error');
          return;
        }

        // 성공 시 새로고침하여 서버 데이터 반영
        showToast('순서가 변경되었습니다.', 'success');
        setLocalPlanOrder(null);
        onRefresh();
      });
    },
    [sortedPlans, studentId, selectedDate, showToast, onRefresh]
  );

  // 마지막으로 처리한 드래그 이벤트 ID (중복 처리 방지)
  const lastDragEventRef = useRef<string | null>(null);

  // 현재 드래그 오버 중인 빈 슬롯 ID (UI 피드백용)
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);

  // DnD 이벤트 모니터링 - 같은 컨테이너 내 재정렬 + 비학습시간 드롭 감지
  useDndMonitor({
    onDragOver: (event) => {
      const overId = event.over?.id ? String(event.over.id) : null;
      // unified-emptySlot- 접두사를 가진 슬롯만 추적
      if (overId?.startsWith('unified-emptySlot-')) {
        setDragOverSlotId(overId);
      } else {
        setDragOverSlotId(null);
      }
    },
    onDragCancel: () => {
      setDragOverSlotId(null);
    },
    onDragEnd: (event: DragEndEvent) => {
      setDragOverSlotId(null);
      const { active, over } = event;

      // DEBUG: 드래그 이벤트 로깅
      console.log('[DailyDock onDragEnd]', {
        activeId: active.id,
        overId: over?.id,
        enableUnifiedReorder,
        isDndReorderEnabled,
      });

      if (!over || active.id === over.id) return;

      // 이벤트 ID로 중복 처리 방지
      const eventId = `${active.id}-${over.id}`;
      if (lastDragEventRef.current === eventId) return;
      lastDragEventRef.current = eventId;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = active.data.current as { type?: string; nonStudyData?: NonStudyDropData & { itemType: string } } | undefined;

      // 비학습시간 드롭 처리
      if (activeData?.type === 'non_study' && activeData.nonStudyData && enableNonStudyDrag && plannerId) {
        // 빈 시간 슬롯에 드롭한 경우
        if (overId.startsWith('empty-slot-')) {
          const slotInfo = over.data.current as { type: string; slot?: { startTime: string; endTime: string } } | undefined;
          if (slotInfo?.slot) {
            handleNonStudyDrop({
              originalStartTime: activeData.nonStudyData.originalStartTime,
              originalEndTime: activeData.nonStudyData.originalEndTime,
              newStartTime: slotInfo.slot.startTime,
              itemType: activeData.nonStudyData.itemType,
              sourceIndex: activeData.nonStudyData.sourceIndex,
            });
          }
        }
        return;
      }

      // DnD 재정렬이 비활성화된 경우 여기서 종료
      if (!isDndReorderEnabled) return;

      // 통합 재정렬 모드: unified- 접두사로 시작하는 아이템
      if (enableUnifiedReorder && activeId.startsWith('unified-') && overId.startsWith('unified-')) {
        console.log('[DailyDock] Unified reorder mode triggered', { activeId, overId });

        const activeParsed = parseUnifiedId(activeId);
        console.log('[DailyDock] activeParsed:', activeParsed);

        // empty 타입은 드래그할 수 없음 (드롭 타겟만 가능)
        if (!activeParsed || activeParsed.type === 'empty') return;

        // movedItemType은 'plan' | 'nonStudy'만 가능
        const movedItemType = activeParsed.type as 'plan' | 'nonStudy';

        // 빈 슬롯에 드롭한 경우: unified-emptySlot-{startTime}-{endTime}
        console.log('[DailyDock] Checking emptySlot drop:', {
          startsWithEmptySlot: overId.startsWith('unified-emptySlot-'),
          overId
        });
        if (overId.startsWith('unified-emptySlot-')) {
          const emptySlotMatch = overId.match(/^unified-emptySlot-(\d{2}:\d{2})-(\d{2}:\d{2})$/);
          console.log('[DailyDock] emptySlotMatch:', emptySlotMatch);
          if (emptySlotMatch) {
            const [, slotStartTime, slotEndTime] = emptySlotMatch;
            handleUnifiedReorder({
              movedItemId: activeParsed.originalId,
              movedItemType,
              overItemId: `emptySlot-${slotStartTime}-${slotEndTime}`,
              overItemType: 'emptySlot' as const,
              targetSlotTime: { start: slotStartTime, end: slotEndTime },
            });
          }
          return;
        }

        const overParsed = parseUnifiedId(overId);

        if (overParsed) {
          // overItemType은 'plan' | 'nonStudy' | 'emptySlot' 가능
          // empty → emptySlot으로 매핑 (드롭 타겟으로서의 빈 슬롯)
          const overItemType = overParsed.type === 'empty' ? 'emptySlot' : overParsed.type as 'plan' | 'nonStudy';

          // empty 타입인 경우 targetSlotTime 추출 (ID 형식: empty-{startTime}-{endTime})
          let targetSlotTime: { start: string; end: string } | undefined;
          if (overParsed.type === 'empty') {
            const timeMatch = overParsed.originalId.match(/^empty-(\d{2}:\d{2})-(\d{2}:\d{2})$/);
            if (timeMatch) {
              targetSlotTime = { start: timeMatch[1], end: timeMatch[2] };
            }
          }

          handleUnifiedReorder({
            movedItemId: activeParsed.originalId,
            movedItemType,
            overItemId: overParsed.originalId,
            overItemType,
            targetSlotTime,
          });
        }
        return;
      }

      // 기존 플랜 재정렬: active와 over 모두 sortableIds에 포함된 경우만 처리 (같은 컨테이너 내 재정렬)
      const isActiveInDaily = sortableIds.includes(activeId);
      const isOverInDaily = sortableIds.includes(overId);

      if (isActiveInDaily && isOverInDaily) {
        handleReorderPlans(activeId, overId);
      }
    },
  });

  // 미완료 플랜 목록 (선택 모드에서 사용) - 매 렌더마다 필터링 방지
  const uncompletedPlans = useMemo(
    () => plans.filter((p) => p.status !== 'completed'),
    [plans]
  );

  // 시간 충돌 감지 (필터링된 플랜 기준)
  const conflictMap = useMemo(() => {
    const timeSlots = allPlans.map((plan) => ({
      id: plan.id,
      title: plan.content_title ?? plan.custom_title ?? '플랜',
      startTime: plan.start_time ?? null,
      endTime: plan.end_time ?? null,
    }));
    return detectTimeConflicts(timeSlots);
  }, [allPlans]);

  // 시간 파싱 헬퍼
  const parseTime = useCallback((t: string) => {
    const [h, m] = t.substring(0, 5).split(':').map(Number);
    return h * 60 + m;
  }, []);

  // 분을 HH:mm 형식으로 변환
  const formatMinutes = useCallback((minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }, []);

  // 플랜 + 비학습시간 + 빈 시간 슬롯 시간순 병합 아이템
  type MergedItem =
    | { kind: 'plan'; plan: typeof plans[number]; sortKey: number }
    | { kind: 'nonStudy'; item: NonStudyItem; sortKey: number }
    | { kind: 'emptySlot'; slot: EmptySlot; sortKey: number }
    | { kind: 'timeSlot'; slot: TimeSlot; sortKey: number; hasPlans: boolean };

  // 빈 시간을 1시간 단위로 분할하는 헬퍼 함수
  const splitEmptyTimeByHour = useCallback((startMinutes: number, endMinutes: number): EmptySlot[] => {
    const slots: EmptySlot[] = [];
    let current = startMinutes;

    while (current < endMinutes) {
      // 다음 정각 계산 (현재가 정각이면 +60분, 아니면 다음 정각까지)
      const currentHour = Math.floor(current / 60);
      const nextHourBoundary = (currentHour + 1) * 60;
      const slotEnd = Math.min(nextHourBoundary, endMinutes);

      slots.push({
        startTime: formatMinutes(current),
        endTime: formatMinutes(slotEnd),
        durationMinutes: slotEnd - current,
      });

      current = slotEnd;
    }

    return slots;
  }, [formatMinutes]);

  const mergedItems = useMemo<MergedItem[]>(() => {
    if (viewMode === 'plans') return [];

    const items: MergedItem[] = [];

    // timeSlots가 있으면 시간 슬롯 기반으로 UI 구성
    if (timeSlots && timeSlots.length > 0) {
      for (const slot of timeSlots) {
        const slotStart = parseTime(slot.start);
        const slotEnd = parseTime(slot.end);

        if (slot.type === '학습시간' || slot.type === '자율학습') {
          // 학습시간/자율학습 슬롯: 플랜과 빈 시간 계산

          // 렌더링용: 필터링된 플랜만 (시간순 정렬)
          const plansInSlot = plans
            .filter(plan => {
              if (!plan.start_time || !plan.end_time) return false;
              const planStart = parseTime(plan.start_time);
              const planEnd = parseTime(plan.end_time);
              // 플랜이 슬롯과 겹치는지 확인
              return planStart < slotEnd && planEnd > slotStart;
            })
            .sort((a, b) => parseTime(a.start_time!) - parseTime(b.start_time!));

          // 빈 시간 계산용: 전체 플랜의 occupied 구간 (parseTime 중복 호출 최적화)
          const allPlanOccupied = allPlans
            .reduce<{ start: number; end: number }[]>((acc, plan) => {
              if (!plan.start_time || !plan.end_time) return acc;
              const planStart = parseTime(plan.start_time);
              const planEnd = parseTime(plan.end_time);
              // 슬롯과 겹치는 플랜만 포함
              if (planStart < slotEnd && planEnd > slotStart) {
                acc.push({
                  start: Math.max(planStart, slotStart),
                  end: Math.min(planEnd, slotEnd),
                });
              }
              return acc;
            }, []);

          // 해당 슬롯과 겹치는 nonStudyItems의 occupied 구간 (parseTime 중복 호출 최적화)
          const nonStudyOccupied = nonStudyItems
            .reduce<{ start: number; end: number }[]>((acc, ns) => {
              const nsStart = parseTime(ns.start_time);
              const nsEnd = parseTime(ns.end_time);
              if (nsStart < slotEnd && nsEnd > slotStart) {
                acc.push({
                  start: Math.max(nsStart, slotStart),
                  end: Math.min(nsEnd, slotEnd),
                });
              }
              return acc;
            }, []);

          // 빈 시간 계산용: 전체 플랜 + nonStudyItems로 "occupied" 구간 생성
          // (특정 그룹 필터 시에도 실제 빈 시간만 표시하기 위함)
          const allOccupiedSlots = [...allPlanOccupied, ...nonStudyOccupied]
            .sort((a, b) => a.start - b.start);

          // 빈 시간 계산: allOccupiedSlots 기준 (전체 플랜 + 비학습시간)
          // 특정 그룹 필터 시에도 실제로 비어있는 시간만 빈 시간으로 표시
          let currentTimeForEmpty = slotStart;

          for (const occupied of allOccupiedSlots) {
            // occupied 시작 전 빈 시간이 있으면 1시간 단위로 분할하여 추가
            if (occupied.start > currentTimeForEmpty) {
              const emptySlots = splitEmptyTimeByHour(currentTimeForEmpty, occupied.start);
              for (const emptySlot of emptySlots) {
                items.push({
                  kind: 'emptySlot',
                  slot: emptySlot,
                  sortKey: parseTime(emptySlot.startTime),
                });
              }
            }
            currentTimeForEmpty = Math.max(currentTimeForEmpty, occupied.end);
          }

          // 슬롯 끝까지 남은 빈 시간을 1시간 단위로 분할하여 추가
          if (currentTimeForEmpty < slotEnd) {
            const emptySlots = splitEmptyTimeByHour(currentTimeForEmpty, slotEnd);
            for (const emptySlot of emptySlots) {
              items.push({
                kind: 'emptySlot',
                slot: emptySlot,
                sortKey: parseTime(emptySlot.startTime),
              });
            }
          }

          // 플랜 렌더링: 필터링된 플랜만 추가 (nonStudyItems는 아래에서 별도로 추가됨)
          for (const plan of plansInSlot) {
            items.push({
              kind: 'plan',
              plan,
              sortKey: parseTime(plan.start_time!),
            });
          }
        } else {
          // 비학습시간 슬롯 (점심시간, 학원일정, 이동시간 등)
          // 오버라이드가 적용된 경우: 원래 슬롯 위치는 빈 시간 슬롯으로 변환
          // nonStudyItems는 나중에 별도로 추가됨
          // 타입 매핑: 레거시 타입 → 새 타입 (동일 타입도 포함)
          const slotTypeToNonStudyType: Record<string, string> = {
            '점심시간': '점심식사',
            '점심식사': '점심식사', // 직접 매핑
            '학원일정': '학원',
            '학원': '학원', // 직접 매핑
            '이동시간': '이동시간',
          };
          const mappedType = slotTypeToNonStudyType[slot.type] ?? slot.type;

          // nonStudyItems에서 같은 타입의 항목 찾기
          const matchingNonStudyItem = nonStudyItems.find(
            (ns) => ns.type === mappedType
          );

          if (matchingNonStudyItem) {
            // 오버라이드가 적용된 경우: 시간이 다르면 원래 위치를 빈 시간 슬롯으로 변환
            const originalStart = parseTime(slot.start);
            const overrideStart = parseTime(matchingNonStudyItem.start_time);

            if (originalStart !== overrideStart) {
              // 시간이 변경됨 - 원래 슬롯 위치는 이제 학습 가능한 시간
              // 해당 시간대의 플랜도 표시해야 함

              // 1. 원래 비학습시간 슬롯 위치에 있는 플랜 추가
              const plansInOverriddenSlot = plans
                .filter(plan => {
                  if (!plan.start_time || !plan.end_time) return false;
                  const planStart = parseTime(plan.start_time);
                  const planEnd = parseTime(plan.end_time);
                  // 플랜이 원래 슬롯과 겹치는지 확인
                  return planStart < slotEnd && planEnd > slotStart;
                })
                .sort((a, b) => parseTime(a.start_time!) - parseTime(b.start_time!));

              // 2. 빈 시간 계산 (플랜이 차지하지 않는 구간)
              // 전체 플랜의 occupied 구간 계산 (빈 시간 표시용)
              const planOccupied = allPlans
                .reduce<{ start: number; end: number }[]>((acc, plan) => {
                  if (!plan.start_time || !plan.end_time) return acc;
                  const planStart = parseTime(plan.start_time);
                  const planEnd = parseTime(plan.end_time);
                  if (planStart < slotEnd && planEnd > slotStart) {
                    acc.push({
                      start: Math.max(planStart, slotStart),
                      end: Math.min(planEnd, slotEnd),
                    });
                  }
                  return acc;
                }, [])
                .sort((a, b) => a.start - b.start);

              // 빈 시간 슬롯 추가 (플랜 사이의 빈 공간)
              let currentTimeForEmpty = slotStart;
              for (const occupied of planOccupied) {
                if (occupied.start > currentTimeForEmpty) {
                  const emptySlots = splitEmptyTimeByHour(currentTimeForEmpty, occupied.start);
                  for (const emptySlot of emptySlots) {
                    items.push({
                      kind: 'emptySlot',
                      slot: emptySlot,
                      sortKey: parseTime(emptySlot.startTime),
                    });
                  }
                }
                currentTimeForEmpty = Math.max(currentTimeForEmpty, occupied.end);
              }

              // 슬롯 끝까지 남은 빈 시간 추가
              if (currentTimeForEmpty < slotEnd) {
                const emptySlots = splitEmptyTimeByHour(currentTimeForEmpty, slotEnd);
                for (const emptySlot of emptySlots) {
                  items.push({
                    kind: 'emptySlot',
                    slot: emptySlot,
                    sortKey: parseTime(emptySlot.startTime),
                  });
                }
              }

              // 3. 해당 시간대의 필터링된 플랜 추가
              for (const plan of plansInOverriddenSlot) {
                items.push({
                  kind: 'plan',
                  plan,
                  sortKey: parseTime(plan.start_time!),
                });
              }
            }
            // nonStudyItem은 아래에서 별도로 추가됨 (timeSlots 순회 후)
          } else {
            // nonStudyItems에 없으면 timeSlot 원본 사용
            items.push({
              kind: 'timeSlot',
              slot,
              sortKey: slotStart,
              hasPlans: false,
            });
          }
        }
      }

      // nonStudyItems 별도 추가 (오버라이드가 적용된 시간으로)
      for (const item of nonStudyItems) {
        items.push({
          kind: 'nonStudy',
          item,
          sortKey: parseTime(item.start_time),
        });
      }

      // 시간 미지정 플랜 최하단 추가 (어떤 슬롯에도 속하지 않는 플랜)
      for (const plan of plans) {
        if (!plan.start_time || !plan.end_time) {
          items.push({
            kind: 'plan',
            plan,
            sortKey: 9999,
          });
        }
      }
    } else {
      // timeSlots가 없으면 기존 방식 (플랜 + 비학습시간)
      for (const plan of plans) {
        items.push({
          kind: 'plan',
          plan,
          sortKey: plan.start_time ? parseTime(plan.start_time) : 9999,
        });
      }

      for (const item of nonStudyItems) {
        items.push({
          kind: 'nonStudy',
          item,
          sortKey: parseTime(item.start_time),
        });
      }
    }

    items.sort((a, b) => a.sortKey - b.sortKey);
    return items;
  }, [plans, nonStudyItems, viewMode, timeSlots, parseTime, formatMinutes, splitEmptyTimeByHour]);

  // Optimistic Update가 적용된 mergedItems
  // optimisticUnifiedOrder가 있으면 해당 시간으로 오버라이드하고 재정렬
  const optimisticMergedItems = useMemo<MergedItem[]>(() => {
    if (!optimisticUnifiedOrder) return mergedItems;

    // optimistic 아이템 ID → 시간 맵 생성
    const optimisticTimeMap = new Map(
      optimisticUnifiedOrder.items.map(item => [item.id, { startTime: item.startTime, endTime: item.endTime }])
    );

    // 헬퍼: MergedItem에서 ID 추출 (UUID 우선)
    const getItemId = (item: MergedItem): string | null => {
      if (item.kind === 'plan') return item.plan.id;
      if (item.kind === 'nonStudy') {
        // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex, 마지막으로 type-time 폴백
        return item.item.id ?? item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`;
      }
      if (item.kind === 'timeSlot') {
        return `slot-${item.slot.type}-${item.slot.start}`;
      }
      return null;
    };

    // mergedItems에 optimistic 시간 적용
    const updatedItems: MergedItem[] = mergedItems.map(item => {
      const itemId = getItemId(item);
      if (!itemId) return item;

      const optimisticTime = optimisticTimeMap.get(itemId);
      if (!optimisticTime) return item;

      // 시간 업데이트 및 sortKey 재계산
      if (item.kind === 'plan') {
        return {
          ...item,
          plan: {
            ...item.plan,
            start_time: optimisticTime.startTime,
            end_time: optimisticTime.endTime,
          },
          sortKey: parseTime(optimisticTime.startTime),
        };
      }
      if (item.kind === 'nonStudy') {
        return {
          ...item,
          item: {
            ...item.item,
            start_time: optimisticTime.startTime,
            end_time: optimisticTime.endTime,
          },
          sortKey: parseTime(optimisticTime.startTime),
        };
      }
      if (item.kind === 'timeSlot') {
        return {
          ...item,
          slot: {
            ...item.slot,
            start: optimisticTime.startTime,
            end: optimisticTime.endTime,
          },
          sortKey: parseTime(optimisticTime.startTime),
        };
      }
      return item;
    });

    // Push 모드에서 빈 공간(emptySlot) 추가
    if (optimisticUnifiedOrder.emptySlot && optimisticUnifiedOrder.mode === 'push') {
      const { start, end, durationMinutes } = optimisticUnifiedOrder.emptySlot;
      updatedItems.push({
        kind: 'emptySlot',
        slot: {
          startTime: start,
          endTime: end,
          durationMinutes,
        },
        sortKey: parseTime(start),
      });
    }

    // 시간순 재정렬
    return updatedItems.sort((a, b) => a.sortKey - b.sortKey);
  }, [mergedItems, optimisticUnifiedOrder, parseTime]);

  // 통합 재정렬용 ID 배열 (플랜 + 비학습시간 + 빈 시간 슬롯)
  const unifiedSortableIds = useMemo(() => {
    if (!enableUnifiedReorder || !isDndReorderEnabled) return [];

    return optimisticMergedItems
      .filter(item => {
        // 플랜: 완료되지 않은 것만
        if (item.kind === 'plan') {
          return item.plan.status !== 'completed';
        }
        // 비학습시간, timeSlot, emptySlot 포함
        return item.kind === 'nonStudy' || item.kind === 'timeSlot' || item.kind === 'emptySlot';
      })
      .map(item => {
        if (item.kind === 'plan') {
          return createUnifiedId('plan', item.plan.id);
        }
        if (item.kind === 'nonStudy') {
          // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex 폴백
          const itemId = item.item.id
            ?? (item.item.sourceIndex !== undefined ? item.item.sourceIndex.toString() : `${item.item.type}-${item.item.start_time}`);
          return createUnifiedId('nonStudy', itemId);
        }
        if (item.kind === 'timeSlot') {
          return createUnifiedId('nonStudy', `slot-${item.slot.type}-${item.slot.start}`);
        }
        if (item.kind === 'emptySlot') {
          return `unified-emptySlot-${item.slot.startTime}-${item.slot.endTime}`;
        }
        return '';
      })
      .filter(id => id !== '');
  }, [enableUnifiedReorder, isDndReorderEnabled, optimisticMergedItems]);

  // 통합 재정렬 예상 모드 계산 (시각적 피드백용)
  // 드래그 중에 slotBoundary와 items가 있으면 모드 예측
  const predictedReorderMode = useMemo<'push' | 'pull' | null>(() => {
    if (!enableUnifiedReorder || !isDndReorderEnabled) return null;

    // 첫 번째 학습시간 슬롯 찾기
    const learningSlot = timeSlots?.find(
      slot => slot.type === '학습시간' || slot.type === '자율학습'
    );
    if (!learningSlot) return null;

    // 현재 아이템들을 TimelineItem으로 변환
    const timelineItems: TimelineItem[] = optimisticMergedItems
      .filter(item => item.kind === 'plan' || item.kind === 'nonStudy' || item.kind === 'timeSlot')
      .map(item => {
        if (item.kind === 'plan') {
          return {
            id: item.plan.id,
            type: 'plan' as const,
            startTime: item.plan.start_time?.substring(0, 5) ?? '',
            endTime: item.plan.end_time?.substring(0, 5) ?? '',
            durationMinutes: item.plan.estimated_minutes ?? 30,
            planId: item.plan.id,
          };
        }
        if (item.kind === 'nonStudy') {
          const start = parseTime(item.item.start_time);
          const end = parseTime(item.item.end_time);
          return {
            id: item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`,
            type: 'nonStudy' as const,
            startTime: item.item.start_time.substring(0, 5),
            endTime: item.item.end_time.substring(0, 5),
            durationMinutes: end - start,
            nonStudyType: item.item.type,
            sourceIndex: item.item.sourceIndex,
          };
        }
        // timeSlot
        const start = parseTime(item.slot.start);
        const end = parseTime(item.slot.end);
        return {
          id: `slot-${item.slot.type}-${item.slot.start}`,
          type: 'nonStudy' as const,
          startTime: item.slot.start.substring(0, 5),
          endTime: item.slot.end.substring(0, 5),
          durationMinutes: end - start,
          nonStudyType: item.slot.type,
        };
      });

    if (timelineItems.length === 0) return null;

    const slotBoundary: TimeSlotBoundary = {
      type: learningSlot.type as '학습시간' | '자율학습',
      start: learningSlot.start,
      end: learningSlot.end,
      capacityMinutes: parseTime(learningSlot.end) - parseTime(learningSlot.start),
    };

    return predictReorderMode(timelineItems, slotBoundary);
  }, [enableUnifiedReorder, isDndReorderEnabled, timeSlots, optimisticMergedItems, parseTime]);

  // 헬퍼: MergedItem에서 ID 추출 (UUID 우선)
  const getItemId = useCallback((item: MergedItem): string => {
    if (item.kind === 'plan') return item.plan.id;
    if (item.kind === 'nonStudy') {
      // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex, 마지막으로 type-time 폴백
      return item.item.id ?? item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`;
    }
    if (item.kind === 'timeSlot') {
      return `slot-${item.slot.type}-${item.slot.start}`;
    }
    if (item.kind === 'emptySlot') {
      return `empty-${item.slot.startTime}-${item.slot.endTime}`;
    }
    return '';
  }, []);

  // 헬퍼: MergedItem에서 시간 추출
  const getItemTimes = useCallback((item: MergedItem) => {
    if (item.kind === 'plan') {
      return {
        startTime: item.plan.start_time?.substring(0, 5) ?? '',
        endTime: item.plan.end_time?.substring(0, 5) ?? '',
        durationMinutes: item.plan.estimated_minutes ?? 30,
      };
    }
    if (item.kind === 'nonStudy') {
      const start = parseTime(item.item.start_time);
      const end = parseTime(item.item.end_time);
      return {
        startTime: item.item.start_time.substring(0, 5),
        endTime: item.item.end_time.substring(0, 5),
        durationMinutes: end - start,
      };
    }
    if (item.kind === 'timeSlot') {
      const start = parseTime(item.slot.start);
      const end = parseTime(item.slot.end);
      return {
        startTime: item.slot.start.substring(0, 5),
        endTime: item.slot.end.substring(0, 5),
        durationMinutes: end - start,
      };
    }
    if (item.kind === 'emptySlot') {
      return {
        startTime: item.slot.startTime.substring(0, 5),
        endTime: item.slot.endTime.substring(0, 5),
        durationMinutes: item.slot.durationMinutes,
      };
    }
    return { startTime: '', endTime: '', durationMinutes: 0 };
  }, [parseTime]);

  // 헬퍼: MergedItem을 ReorderInputItem으로 변환
  const toReorderInputItem = useCallback((item: MergedItem) => {
    const times = getItemTimes(item);
    if (item.kind === 'plan') {
      return {
        id: item.plan.id,
        type: 'plan' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        planId: item.plan.id,
      };
    }
    if (item.kind === 'nonStudy') {
      // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex, 마지막으로 type-time 폴백
      const itemId = item.item.id ?? item.item.sourceIndex?.toString() ?? `${item.item.type}-${item.item.start_time}`;
      return {
        id: itemId,
        type: 'nonStudy' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        nonStudyData: {
          sourceIndex: item.item.sourceIndex ?? -1,
          originalType: item.item.type,
          originalStartTime: item.item.start_time.substring(0, 5),
          originalEndTime: item.item.end_time.substring(0, 5),
          recordId: item.item.id, // 새 테이블 레코드 ID (student_non_study_time.id)
        },
      };
    }
    if (item.kind === 'timeSlot') {
      return {
        id: `slot-${item.slot.type}-${item.slot.start}`,
        type: 'nonStudy' as const,
        startTime: times.startTime,
        endTime: times.endTime,
        durationMinutes: times.durationMinutes,
        nonStudyData: {
          sourceIndex: -1,
          originalType: item.slot.type,
          originalStartTime: item.slot.start.substring(0, 5),
          originalEndTime: item.slot.end.substring(0, 5),
        },
      };
    }
    // emptySlot (should not reach here in unified reorder)
    return {
      id: `empty-${times.startTime}`,
      type: 'nonStudy' as const,
      startTime: times.startTime,
      endTime: times.endTime,
      durationMinutes: times.durationMinutes,
    };
  }, [getItemTimes]);

  // 통합 재정렬 핸들러 (플랜 + 비학습시간) - Optimistic Update 적용
  const handleUnifiedReorder = useCallback(
    async (data: UnifiedReorderData) => {
      console.log('[handleUnifiedReorder] Called with data:', data);
      if (!plannerId) {
        console.log('[handleUnifiedReorder] No plannerId, returning');
        return;
      }

      // ============================================
      // 빈 시간 슬롯에 드롭한 경우
      // ============================================
      if (data.overItemType === 'emptySlot' && data.targetSlotTime) {
        console.log('[handleUnifiedReorder] Empty slot drop detected');
        const { start: slotStart } = data.targetSlotTime;

        // 이동한 아이템 찾기
        const movedItem = mergedItems.find(item => {
          if (data.movedItemType === 'plan' && item.kind === 'plan') {
            return item.plan.id === data.movedItemId;
          }
          if (data.movedItemType === 'nonStudy') {
            if (item.kind === 'nonStudy') {
              // UUID 직접 비교 우선, 그 다음 레거시 방식
              return item.item.id === data.movedItemId ||
                     item.item.sourceIndex?.toString() === data.movedItemId ||
                     `${item.item.type}-${item.item.start_time}` === data.movedItemId;
            }
            if (item.kind === 'timeSlot') {
              return `slot-${item.slot.type}-${item.slot.start}` === data.movedItemId;
            }
          }
          return false;
        });

        if (!movedItem) {
          console.log('[handleUnifiedReorder] Moved item not found');
          return;
        }

        console.log('[handleUnifiedReorder] Found moved item:', movedItem.kind);

        // 비학습시간인 경우: 직접 시간 업데이트 (플랜과 동일하게)
        if (data.movedItemType === 'nonStudy') {
          const itemTimes = getItemTimes(movedItem);
          const durationMinutes = itemTimes.durationMinutes;

          // 새 종료 시간 계산 (슬롯 시작 + duration)
          const slotStartMinutes = parseTime(slotStart);
          const newEndMinutes = slotStartMinutes + durationMinutes;
          const newEndTime = formatMinutes(newEndMinutes);

          // recordId 추출 (student_non_study_time.id)
          let recordId: string | undefined;
          let itemLabel = '비학습시간';
          if (movedItem.kind === 'nonStudy') {
            recordId = movedItem.item.id;
            itemLabel = movedItem.item.label ?? movedItem.item.type;
          }

          console.log('[handleUnifiedReorder] NonStudy update:', {
            movedItemId: data.movedItemId,
            recordId,
            slotStart,
            newEndTime,
          });

          // Optimistic Update
          setOptimisticUnifiedOrder({
            items: [{
              id: getItemId(movedItem),
              kind: 'nonStudy',
              startTime: slotStart,
              endTime: newEndTime,
            }],
            mode: 'push',
            emptySlot: undefined,
          });

          // 서버 액션 호출
          startTransition(async () => {
            const result = await updateItemTime({
              studentId,
              plannerId,
              planDate: selectedDate,
              itemId: data.movedItemId,
              itemType: 'nonStudy',
              newStartTime: slotStart,
              newEndTime: newEndTime,
              recordId,
            });

            if (!result.success) {
              setOptimisticUnifiedOrder(null);
              showToast(result.error ?? '시간 변경에 실패했습니다.', 'error');
              return;
            }

            showToast(`${itemLabel}이(가) ${slotStart}에 배치되었습니다.`, 'success');
            setOptimisticUnifiedOrder(null);
            onRefresh();
          });
          return;
        }

        // 플랜인 경우: 직접 시간 업데이트
        const itemTimes = getItemTimes(movedItem);
        const durationMinutes = itemTimes.durationMinutes;

        // 새 종료 시간 계산 (슬롯 시작 + duration)
        const slotStartMinutes = parseTime(slotStart);
        const newEndMinutes = slotStartMinutes + durationMinutes;
        const newEndTime = formatMinutes(newEndMinutes);

        // Optimistic Update
        setOptimisticUnifiedOrder({
          items: [{
            id: getItemId(movedItem),
            kind: 'plan',
            startTime: slotStart,
            endTime: newEndTime,
          }],
          mode: 'push',
          emptySlot: undefined,
        });

        // 서버 액션 호출
        startTransition(async () => {
          const result = await updateItemTime({
            studentId,
            plannerId,
            planDate: selectedDate,
            itemId: data.movedItemId,
            itemType: 'plan',
            newStartTime: slotStart,
            newEndTime: newEndTime,
          });

          if (!result.success) {
            setOptimisticUnifiedOrder(null);
            showToast(result.error ?? '시간 변경에 실패했습니다.', 'error');
            return;
          }

          showToast(`${slotStart}에 배치되었습니다.`, 'success');
          setOptimisticUnifiedOrder(null);
          onRefresh();
        });

        return;
      }

      // ============================================
      // 일반 재정렬 (Push/Pull)
      // ============================================

      // 현재 mergedItems에서 재정렬 대상 아이템만 추출 (emptySlot 포함)
      const sortableItems = mergedItems.filter(
        (item): item is MergedItem & { kind: 'plan' | 'nonStudy' | 'timeSlot' | 'emptySlot' } =>
          item.kind === 'plan' || item.kind === 'nonStudy' || item.kind === 'timeSlot' || item.kind === 'emptySlot'
      );

      // 이동한 아이템의 원래 인덱스 찾기 (UUID 우선 비교)
      const movedItemIndex = sortableItems.findIndex(item => {
        if (data.movedItemType === 'plan' && item.kind === 'plan') {
          return item.plan.id === data.movedItemId;
        }
        if (data.movedItemType === 'nonStudy') {
          if (item.kind === 'nonStudy') {
            // UUID 직접 비교 우선 (새 테이블), 그 다음 레거시 방식
            return item.item.id === data.movedItemId ||
                   item.item.sourceIndex?.toString() === data.movedItemId ||
                   `${item.item.type}-${item.item.start_time}` === data.movedItemId;
          }
          if (item.kind === 'timeSlot') {
            return `slot-${item.slot.type}-${item.slot.start}` === data.movedItemId;
          }
        }
        return false;
      });

      // 드롭 위치 아이템의 인덱스 찾기 (UUID 우선 비교)
      const overItemIndex = sortableItems.findIndex(item => {
        if (data.overItemType === 'plan' && item.kind === 'plan') {
          return item.plan.id === data.overItemId;
        }
        if (data.overItemType === 'nonStudy') {
          if (item.kind === 'nonStudy') {
            // UUID 직접 비교 우선 (새 테이블), 그 다음 레거시 방식
            return item.item.id === data.overItemId ||
                   item.item.sourceIndex?.toString() === data.overItemId ||
                   `${item.item.type}-${item.item.start_time}` === data.overItemId;
          }
          if (item.kind === 'timeSlot') {
            return `slot-${item.slot.type}-${item.slot.start}` === data.overItemId;
          }
        }
        return false;
      });

      if (movedItemIndex === -1 || overItemIndex === -1) return;

      // 아이템을 새 순서로 재배열
      const reorderedItems = arrayMove(sortableItems, movedItemIndex, overItemIndex);

      // 현재 시간 슬롯 경계 계산 (첫 번째 학습시간 슬롯 기준)
      const learningSlot = timeSlots?.find(slot => slot.type === '학습시간' || slot.type === '자율학습');
      if (!learningSlot) {
        showToast('학습시간 슬롯이 설정되지 않았습니다.', 'error');
        return;
      }

      const slotBoundary: TimeSlotBoundary = {
        type: learningSlot.type as '학습시간' | '자율학습',
        start: learningSlot.start,
        end: learningSlot.end,
        capacityMinutes: parseTime(learningSlot.end) - parseTime(learningSlot.start),
      };

      // MergedItem → TimelineItem 변환 헬퍼
      const toTimelineItem = (item: typeof sortableItems[number]): TimelineItem => {
        const times = getItemTimes(item);
        if (item.kind === 'emptySlot') {
          return {
            id: `empty-${item.slot.startTime}-${item.slot.endTime}`,
            type: 'empty',
            startTime: times.startTime,
            endTime: times.endTime,
            durationMinutes: times.durationMinutes,
          };
        }
        return {
          id: getItemId(item),
          type: item.kind === 'plan' ? 'plan' : 'nonStudy',
          startTime: times.startTime,
          endTime: times.endTime,
          durationMinutes: times.durationMinutes,
          planId: item.kind === 'plan' ? item.plan.id : undefined,
          nonStudyType: item.kind === 'nonStudy' ? item.item.type : item.kind === 'timeSlot' ? item.slot.type : undefined,
          sourceIndex: item.kind === 'nonStudy' ? item.item.sourceIndex : undefined,
        };
      };

      // TimelineItem 형식으로 변환 (클라이언트 계산용)
      const timelineItems: TimelineItem[] = reorderedItems.map(toTimelineItem);

      // 원본 TimelineItem (이동 전 순서)
      const originalTimelineItems: TimelineItem[] = sortableItems.map(toTimelineItem);

      // 클라이언트에서 새 시간 계산 (Optimistic Update용)
      const reorderResult = calculateUnifiedReorder(
        timelineItems,
        slotBoundary,
        data.movedItemId,
        originalTimelineItems
      );

      // Optimistic Update: UI 즉시 반영
      setOptimisticUnifiedOrder({
        items: reorderResult.items.map(item => ({
          id: item.id,
          kind: item.type === 'plan' ? 'plan' : 'nonStudy',
          startTime: item.startTime,
          endTime: item.endTime,
        })),
        mode: reorderResult.mode,
        emptySlot: reorderResult.emptySlot,
      });

      // 서버 액션에 전달할 orderedItems (드래그 후 순서)
      const orderedItems = reorderedItems.map(toReorderInputItem);

      // 서버 액션에 전달할 originalItems (드래그 전 순서)
      const originalItems = sortableItems.map(toReorderInputItem);

      startTransition(async () => {
        const result = await executeUnifiedReorder({
          studentId,
          plannerId,
          planDate: selectedDate,
          orderedItems,
          originalItems,
          slotBoundary,
          movedItemId: data.movedItemId,
          insertIndex: overItemIndex,
        });

        if (!result.success) {
          // 실패 시 롤백
          setOptimisticUnifiedOrder(null);
          showToast(result.error ?? '재정렬에 실패했습니다.', 'error');
          return;
        }

        // 성공 시 새로고침하여 서버 데이터 반영
        showToast(
          result.mode === 'push' ? '아이템이 밀렸습니다.' : '아이템이 당겨졌습니다.',
          'success'
        );
        setOptimisticUnifiedOrder(null);
        onRefresh();
      });
    },
    [plannerId, mergedItems, timeSlots, parseTime, studentId, selectedDate, showToast, onRefresh, getItemId, getItemTimes, toReorderInputItem]
  );

  // 선택 모드 상태 (기본: off → QuickComplete 버튼 표시)
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 선택 관련 상태
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 선택 모드 토글
  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      // 선택 모드 종료 시 선택 초기화
      setSelectedPlans(new Set());
    }
    setIsSelectionMode(!isSelectionMode);
  };

  // 삭제 확인 모달 상태
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    planId: string | null;
    isAdHoc: boolean;
  }>({ open: false, planId: null, isAdHoc: false });

  // 비학습시간 편집 모달 상태
  const [editingNonStudy, setEditingNonStudy] = useState<{
    open: boolean;
    item: NonStudyItem | null;
    sourceIndex?: number;
    initialStartTime?: string;
  }>({ open: false, item: null });

  // 비학습시간 클릭 핸들러
  const handleNonStudyTimeClick = useCallback((item: NonStudyItem, sourceIndex?: number) => {
    setEditingNonStudy({ open: true, item, sourceIndex });
  }, []);

  // 비학습시간 드래그 드롭 핸들러 (DndContext에서 호출)
  const handleNonStudyDrop = useCallback((dropData: NonStudyDropData) => {
    // 해당 item 찾기 (nonStudyItems에서)
    let foundItem = nonStudyItems.find(
      (item) =>
        item.start_time.substring(0, 5) === dropData.originalStartTime &&
        item.end_time.substring(0, 5) === dropData.originalEndTime
    );

    // nonStudyItems에서 못 찾으면 timeSlots (플래너 시간 슬롯)에서 찾기
    if (!foundItem && timeSlots) {
      const matchingSlot = timeSlots.find(
        (slot) =>
          slot.start.substring(0, 5) === dropData.originalStartTime &&
          slot.end.substring(0, 5) === dropData.originalEndTime
      );

      if (matchingSlot) {
        // 플래너 timeSlot을 NonStudyItem 형식으로 변환
        const typeMap: Record<string, NonStudyItem['type']> = {
          '점심시간': '점심식사',
          '학원일정': '학원',
          '이동시간': '이동시간',
        };
        foundItem = {
          type: typeMap[matchingSlot.type] ?? '기타',
          start_time: matchingSlot.start,
          end_time: matchingSlot.end,
          label: matchingSlot.label ?? matchingSlot.type,
        };
      }
    }

    if (foundItem) {
      setEditingNonStudy({
        open: true,
        item: foundItem,
        sourceIndex: dropData.sourceIndex,
        initialStartTime: dropData.newStartTime,
      });
    }
  }, [nonStudyItems, timeSlots]);

  // 비학습시간 편집 성공 핸들러
  const handleNonStudyEditSuccess = useCallback(() => {
    onRefresh();
  }, [onRefresh]);


  const handleMoveToWeekly = async (planId: string) => {
    startTransition(async () => {
      const result = await movePlanToContainer({
        planId,
        targetContainer: 'weekly',
        skipRevalidation: true,
      });

      if (!result.success) {
        showToast(result.error ?? '주간 플랜으로 이동 실패', 'error');
        return;
      }

      showToast('주간 플랜으로 이동했습니다.', 'success');
      // 타겟 새로고침: Daily + Weekly만 (Unfinished는 영향 없음)
      (onRefreshDailyAndWeekly ?? onRefresh)();
    });
  };

  // 삭제 확인 모달 열기
  const handleDeleteRequest = (planId: string, isAdHoc = false) => {
    setDeleteConfirm({ open: true, planId, isAdHoc });
  };

  // 삭제 실행
  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.planId) return;

    startTransition(async () => {
      const result = await deletePlan({
        planId: deleteConfirm.planId!,
        isAdHoc: deleteConfirm.isAdHoc,
        skipRevalidation: true,
      });

      if (!result.success) {
        showToast(result.error ?? '삭제 실패', 'error');
        setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
        return;
      }

      showToast('플랜이 삭제되었습니다.', 'success');
      setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
      onRefresh();
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}월 ${day}일 (${days[date.getDay()]})`;
  };

  // 선택 관련 핸들러
  const handleToggleSelect = (planId: string) => {
    setSelectedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    // 완료되지 않은 일반 플랜만 선택 (adhoc 제외)
    if (selectedPlans.size === uncompletedPlans.length) {
      setSelectedPlans(new Set());
    } else {
      setSelectedPlans(new Set(uncompletedPlans.map((p) => p.id)));
    }
  };

  const handleBulkRedistribute = () => {
    if (selectedPlans.size > 0) {
      setShowBulkModal(true);
    }
  };

  const handleBulkSuccess = () => {
    setShowBulkModal(false);
    setSelectedPlans(new Set());
    onRefresh();
  };

  // 빈 시간 슬롯 핸들러들
  const handleCreatePlanAtSlot = useCallback(
    (slot: EmptySlot) => {
      onCreatePlanAtSlot?.(slot.startTime, slot.endTime);
    },
    [onCreatePlanAtSlot]
  );

  const handlePlaceUnfinishedAtSlot = useCallback(
    (slot: EmptySlot) => {
      onPlaceUnfinishedAtSlot?.(slot.startTime, slot.endTime);
    },
    [onPlaceUnfinishedAtSlot]
  );

  const handlePlaceWeeklyAtSlot = useCallback(
    (slot: EmptySlot) => {
      onPlaceWeeklyAtSlot?.(slot.startTime, slot.endTime);
    },
    [onPlaceWeeklyAtSlot]
  );

  // 선택된 플랜 ID 배열 메모이제이션 (Array.from 반복 호출 방지)
  const selectedPlanIds = useMemo(
    () => Array.from(selectedPlans),
    [selectedPlans]
  );

  // 그룹 이동 핸들러 메모이제이션
  const handleMoveToGroupBulk = useCallback(() => {
    if (onMoveToGroup) {
      onMoveToGroup(selectedPlanIds);
    }
  }, [onMoveToGroup, selectedPlanIds]);

  // 복사 핸들러 메모이제이션
  const handleCopyBulk = useCallback(() => {
    if (onCopy) {
      onCopy(selectedPlanIds);
    }
  }, [onCopy, selectedPlanIds]);

  // 단일 플랜 그룹 이동 핸들러 메모이제이션
  const handleMoveToGroupSingle = useCallback(
    (id: string) => onMoveToGroup?.([id]),
    [onMoveToGroup]
  );

  // 단일 플랜 복사 핸들러 메모이제이션
  const handleCopySingle = useCallback(
    (id: string) => onCopy?.([id]),
    [onCopy]
  );

  const totalCount = plans.length + adHocPlans.length;

  // 완료된 플랜 수 메모이제이션
  const completedCount = useMemo(
    () =>
      plans.filter((p) => p.status === 'completed').length +
      adHocPlans.filter((p) => p.status === 'completed').length,
    [plans, adHocPlans]
  );

  // 축소 상태 (가로 아코디언 레이아웃)
  if (isCollapsed) {
    return (
      <CollapsedDockCard
        type="daily"
        icon="📦"
        title="오늘"
        count={totalCount}
        completedCount={completedCount}
        onClick={onExpand ?? (() => {})}
      />
    );
  }

  return (
    <DroppableContainer id="daily" className="h-full">
      <div
        className={cn(
          'bg-blue-50 rounded-lg border border-blue-200 h-full flex flex-col',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
      {/* 헤더 (고정) */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-medium text-blue-700">오늘 플랜</span>
          <span className="text-sm text-gray-600">
            {formatDateDisplay(selectedDate)}
          </span>
          {totalCount > 0 && (
            <span className="text-sm text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
              {completedCount}/{totalCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 선택 모드 토글 */}
          {uncompletedPlans.length > 0 && (
            <button
              onClick={handleToggleSelectionMode}
              className={cn(
                'px-2 py-1 text-xs rounded transition-colors',
                isSelectionMode
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {isSelectionMode ? '선택 모드 종료' : '선택'}
            </button>
          )}
          {/* 선택 모드일 때만 전체 선택/해제 버튼 표시 */}
          {isSelectionMode && uncompletedPlans.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
            >
              {selectedPlans.size === uncompletedPlans.length
                ? '전체 해제'
                : '전체 선택'}
            </button>
          )}
          {isSelectionMode && selectedPlans.size > 0 && (
            <>
              <button
                onClick={handleBulkRedistribute}
                className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600"
              >
                일괄 작업 ({selectedPlans.size})
              </button>
              {onMoveToGroup && (
                <button
                  onClick={handleMoveToGroupBulk}
                  className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
                >
                  그룹 이동
                </button>
              )}
              {onCopy && (
                <button
                  onClick={handleCopyBulk}
                  className="px-3 py-1.5 text-sm bg-teal-500 text-white rounded-md hover:bg-teal-600"
                >
                  복사
                </button>
              )}
            </>
          )}
          {onReorder && plans.length > 1 && (
            <button
              onClick={onReorder}
              className="px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
              title="순서 변경"
            >
              ↕️
            </button>
          )}
        </div>
      </div>

      {/* 보기 토글 (고정) */}
      {nonStudyItems.length > 0 && (
        <div className="flex-shrink-0 flex items-center justify-end px-4 py-1.5 border-b border-blue-100">
          <div className="flex rounded-md overflow-hidden border border-gray-200 text-xs">
            <button
              onClick={() => handleViewModeChange('all')}
              className={cn(
                'px-3 py-1 transition-colors',
                viewMode === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              전체 보기
            </button>
            <button
              onClick={() => handleViewModeChange('plans')}
              className={cn(
                'px-3 py-1 transition-colors',
                viewMode === 'plans'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              플랜만
            </button>
          </div>
        </div>
      )}

      {/* 플랜 목록 (스크롤 영역) */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-2">
            {SKELETON_ITEMS.map((i) => (
              <div key={i} className="h-16 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 && optimisticMergedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>이 날짜에 플랜이 없습니다</p>
            <p className="text-sm mt-1">플랜을 추가해주세요</p>
          </div>
        ) : viewMode === 'all' && optimisticMergedItems.length > 0 ? (
          <SortableContext
            items={enableUnifiedReorder ? unifiedSortableIds : sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {/* 시간순 병합 (플랜 + 비학습시간 + 빈 시간) - 플랜만 정렬 가능 */}
              {optimisticMergedItems.map((item) => {
                if (item.kind === 'nonStudy') {
                  // 비학습시간은 플래너가 선택된 경우에만 편집 가능
                  const canEdit = !!plannerId;
                  const canDrag = canEdit && (enableNonStudyDrag || enableUnifiedReorder);
                  const cardKey = `ns-${item.item.type}-${item.item.start_time}`;
                  // 새 테이블 레코드 ID(UUID) 우선, 없으면 sourceIndex 폴백
                  const itemId = item.item.id
                    ?? (item.item.sourceIndex !== undefined ? item.item.sourceIndex.toString() : `${item.item.type}-${item.item.start_time}`);
                  const unifiedId = createUnifiedId('nonStudy', itemId);

                  const card = (
                    <NonStudyTimeCard
                      item={item.item}
                      editable={canEdit && !canDrag}
                      onClick={canEdit && !canDrag ? () => handleNonStudyTimeClick(item.item, item.item.sourceIndex) : undefined}
                    />
                  );

                  // 통합 재정렬 모드: SortableUnifiedItem 사용
                  if (enableUnifiedReorder && canDrag) {
                    const unifiedDragData: UnifiedDragData = {
                      id: itemId,
                      type: 'nonStudy' as TimelineItemType,
                      durationMinutes: Math.round(
                        (parseTime(item.item.end_time) - parseTime(item.item.start_time))
                      ),
                      title: item.item.label ?? item.item.type,
                      startTime: item.item.start_time.substring(0, 5),
                      endTime: item.item.end_time.substring(0, 5),
                      nonStudyData: {
                        sourceIndex: item.item.sourceIndex ?? -1,
                        originalType: item.item.type as string,
                        recordId: item.item.id, // 새 테이블 레코드 ID
                      },
                    };

                    return (
                      <SortableUnifiedItem
                        key={unifiedId}
                        id={unifiedId}
                        disabled={isPending}
                        dragData={unifiedDragData}
                        reorderMode={predictedReorderMode}
                      >
                        {card}
                      </SortableUnifiedItem>
                    );
                  }

                  // 기존 드래그 모드: DraggableNonStudyItem 사용
                  if (canDrag && enableNonStudyDrag) {
                    return (
                      <DraggableNonStudyItem
                        key={cardKey}
                        id={cardKey}
                        dragData={{
                          title: item.item.label ?? item.item.type,
                          itemType: item.item.type,
                          originalStartTime: item.item.start_time.substring(0, 5),
                          originalEndTime: item.item.end_time.substring(0, 5),
                          sourceIndex: item.item.sourceIndex,
                          recordId: item.item.id, // 새 테이블 레코드 ID
                        }}
                      >
                        {card}
                      </DraggableNonStudyItem>
                    );
                  }

                  return <div key={cardKey}>{card}</div>;
                }

                if (item.kind === 'emptySlot') {
                  const emptySlotKey = `empty-${item.slot.startTime}-${item.slot.endTime}`;
                  const emptySlotUnifiedId = `unified-emptySlot-${item.slot.startTime}-${item.slot.endTime}`;

                  // 통합 재정렬 모드에서는 EmptyTimeSlotCard의 내부 droppable을 비활성화
                  // (SortableUnifiedItem이 드롭 타겟 역할을 대신함)
                  const useUnifiedDroppable = enableUnifiedReorder && isDndReorderEnabled;

                  // 외부에서 드래그 오버 상태 전달 (통합 재정렬 모드에서 UI 피드백용)
                  const isSlotDraggedOver = useUnifiedDroppable && dragOverSlotId === emptySlotUnifiedId;

                  const emptyCard = (
                    <EmptyTimeSlotCard
                      slot={item.slot}
                      droppable={!useUnifiedDroppable}
                      externalIsOver={isSlotDraggedOver}
                      onCreatePlan={onCreatePlanAtSlot ? handleCreatePlanAtSlot : undefined}
                      onPlaceUnfinished={onPlaceUnfinishedAtSlot ? handlePlaceUnfinishedAtSlot : undefined}
                      onPlaceFromWeekly={onPlaceWeeklyAtSlot ? handlePlaceWeeklyAtSlot : undefined}
                    />
                  );

                  // 통합 재정렬 모드: SortableUnifiedItem으로 래핑 (드롭 타겟으로 사용)
                  if (useUnifiedDroppable) {
                    const emptySlotDragData: UnifiedDragData = {
                      id: emptySlotKey,
                      type: 'empty' as TimelineItemType,
                      durationMinutes: item.slot.durationMinutes,
                      title: `빈 시간 ${item.slot.startTime}-${item.slot.endTime}`,
                      startTime: item.slot.startTime,
                      endTime: item.slot.endTime,
                    };

                    return (
                      <SortableUnifiedItem
                        key={emptySlotKey}
                        id={emptySlotUnifiedId}
                        disabled={true}  // 빈 슬롯은 드래그 불가, 드롭만 가능
                        dragData={emptySlotDragData}
                        reorderMode={predictedReorderMode}
                      >
                        {emptyCard}
                      </SortableUnifiedItem>
                    );
                  }

                  return <div key={emptySlotKey}>{emptyCard}</div>;
                }

                if (item.kind === 'timeSlot') {
                  // 플래너 시간 슬롯 (점심시간, 학원일정, 이동시간 등)
                  const typeMap: Record<string, NonStudyItem['type']> = {
                    '점심시간': '점심식사',
                    '학원일정': '학원',
                    '이동시간': '이동시간',
                  };
                  const nonStudyItem: NonStudyItem = {
                    type: typeMap[item.slot.type] ?? '기타',
                    start_time: item.slot.start,
                    end_time: item.slot.end,
                    label: item.slot.label ?? item.slot.type,
                  };
                  // 플래너가 선택된 경우에만 편집 가능
                  const canEdit = !!plannerId;
                  const canDrag = canEdit && (enableNonStudyDrag || enableUnifiedReorder);
                  const cardKey = `ts-${item.slot.type}-${item.slot.start}`;
                  const slotId = `slot-${item.slot.type}-${item.slot.start}`;
                  const unifiedId = createUnifiedId('nonStudy', slotId);

                  const card = (
                    <NonStudyTimeCard
                      item={nonStudyItem}
                      editable={canEdit && !canDrag}
                      onClick={canEdit && !canDrag ? () => handleNonStudyTimeClick(nonStudyItem) : undefined}
                    />
                  );

                  // 통합 재정렬 모드: SortableUnifiedItem 사용
                  if (enableUnifiedReorder && canDrag) {
                    const unifiedDragData: UnifiedDragData = {
                      id: slotId,
                      type: 'nonStudy' as TimelineItemType,
                      durationMinutes: Math.round(
                        (parseTime(item.slot.end) - parseTime(item.slot.start))
                      ),
                      title: nonStudyItem.label ?? nonStudyItem.type,
                      startTime: nonStudyItem.start_time.substring(0, 5),
                      endTime: nonStudyItem.end_time.substring(0, 5),
                      nonStudyData: {
                        sourceIndex: -1, // timeSlot은 sourceIndex가 없음
                        originalType: nonStudyItem.type as string,
                      },
                    };

                    return (
                      <SortableUnifiedItem
                        key={unifiedId}
                        id={unifiedId}
                        disabled={isPending}
                        dragData={unifiedDragData}
                        reorderMode={predictedReorderMode}
                      >
                        {card}
                      </SortableUnifiedItem>
                    );
                  }

                  // 기존 드래그 모드: DraggableNonStudyItem 사용
                  if (canDrag && enableNonStudyDrag) {
                    return (
                      <DraggableNonStudyItem
                        key={cardKey}
                        id={cardKey}
                        dragData={{
                          title: nonStudyItem.label ?? nonStudyItem.type,
                          itemType: nonStudyItem.type,
                          originalStartTime: nonStudyItem.start_time.substring(0, 5),
                          originalEndTime: nonStudyItem.end_time.substring(0, 5),
                          recordId: nonStudyItem.id, // 새 테이블 레코드 ID
                        }}
                      >
                        {card}
                      </DraggableNonStudyItem>
                    );
                  }

                  return <div key={cardKey}>{card}</div>;
                }

                const planData = toPlanItemData(item.plan, 'plan');
                const isCompleted = item.plan.status === 'completed' || (item.plan.progress ?? 0) >= 100;
                const conflictInfo = conflictMap.get(item.plan.id);

                // 완료된 플랜은 정렬 불가
                if (isCompleted) {
                  return (
                    <PlanItemCard
                      key={item.plan.id}
                      plan={planData}
                      container="daily"
                      showProgress={true}
                      showTime={true}
                      selectable={false}
                      isSelected={false}
                      conflictInfo={conflictInfo}
                      disableDrag={true}
                      onMoveToWeekly={handleMoveToWeekly}
                      onRedistribute={onRedistribute}
                      onEdit={onEdit}
                      onMoveToGroup={onMoveToGroup ? handleMoveToGroupSingle : undefined}
                      onCopy={onCopy ? handleCopySingle : undefined}
                      onStatusChange={onStatusChange}
                      onDelete={handleDeleteRequest}
                      onRefresh={onRefresh}
                    />
                  );
                }

                // 미완료 플랜: DnD 활성화 시 SortablePlanItem 또는 SortableUnifiedItem으로 래핑
                const planCard = (
                  <PlanItemCard
                    plan={planData}
                    container="daily"
                    showProgress={true}
                    showTime={true}
                    selectable={isSelectionMode && !isCompleted}
                    isSelected={selectedPlans.has(item.plan.id)}
                    conflictInfo={conflictInfo}
                    disableDrag={isDndReorderEnabled || enableUnifiedReorder}
                    onSelect={handleToggleSelect}
                    onMoveToWeekly={handleMoveToWeekly}
                    onRedistribute={onRedistribute}
                    onEdit={onEdit}
                    onMoveToGroup={onMoveToGroup ? handleMoveToGroupSingle : undefined}
                    onCopy={onCopy ? handleCopySingle : undefined}
                    onStatusChange={onStatusChange}
                    onDelete={handleDeleteRequest}
                    onRefresh={onRefresh}
                  />
                );

                // 통합 재정렬 모드: SortableUnifiedItem 사용
                if (enableUnifiedReorder && isDndReorderEnabled) {
                  const unifiedId = createUnifiedId('plan', item.plan.id);
                  const estimatedMinutes = item.plan.estimated_minutes ?? 30;
                  const unifiedDragData: UnifiedDragData = {
                    id: item.plan.id,
                    type: 'plan' as TimelineItemType,
                    durationMinutes: estimatedMinutes,
                    title: item.plan.content_title ?? item.plan.custom_title ?? '플랜',
                    startTime: item.plan.start_time?.substring(0, 5) ?? '',
                    endTime: item.plan.end_time?.substring(0, 5) ?? '',
                    planId: item.plan.id,
                  };

                  return (
                    <SortableUnifiedItem
                      key={unifiedId}
                      id={unifiedId}
                      disabled={isPending}
                      dragData={unifiedDragData}
                      reorderMode={predictedReorderMode}
                    >
                      {planCard}
                    </SortableUnifiedItem>
                  );
                }

                // 기존 재정렬 모드: SortablePlanItem 사용
                if (isDndReorderEnabled) {
                  return (
                    <SortablePlanItem
                      key={item.plan.id}
                      id={item.plan.id}
                      disabled={isPending}
                      dragData={{
                        type: 'plan',
                        containerId: 'daily',
                        title: item.plan.content_title ?? item.plan.custom_title ?? '플랜',
                        subject: item.plan.content_subject ?? undefined,
                        planDate: selectedDate,
                        planData: planData,
                      }}
                    >
                      {planCard}
                    </SortablePlanItem>
                  );
                }

                return <div key={item.plan.id}>{planCard}</div>;
              })}

              {/* Ad-hoc 플랜 (시간순 병합 대상 아님, 정렬 불가) */}
              {adHocPlans.map((adHoc) => {
                const planData = toPlanItemData(adHoc, 'adhoc');
                return (
                  <PlanItemCard
                    key={adHoc.id}
                    plan={planData}
                    container="daily"
                    showProgress={false}
                    disableDrag={true}
                    onDelete={(id) => handleDeleteRequest(id, true)}
                    onRefresh={onRefresh}
                  />
                );
              })}
            </div>
          </SortableContext>
        ) : (
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {/* 플랜만 보기 - 정렬 가능 */}
              {sortedPlans.map((plan) => {
                const planData = toPlanItemData(plan, 'plan');
                const isCompleted = plan.status === 'completed' || (plan.progress ?? 0) >= 100;
                const conflictInfo = conflictMap.get(plan.id);

                // 완료된 플랜은 정렬 불가
                if (isCompleted) {
                  return (
                    <PlanItemCard
                      key={plan.id}
                      plan={planData}
                      container="daily"
                      showProgress={true}
                      showTime={true}
                      selectable={false}
                      isSelected={false}
                      conflictInfo={conflictInfo}
                      disableDrag={true}
                      onMoveToWeekly={handleMoveToWeekly}
                      onRedistribute={onRedistribute}
                      onEdit={onEdit}
                      onMoveToGroup={onMoveToGroup ? handleMoveToGroupSingle : undefined}
                      onCopy={onCopy ? handleCopySingle : undefined}
                      onStatusChange={onStatusChange}
                      onDelete={handleDeleteRequest}
                      onRefresh={onRefresh}
                    />
                  );
                }

                // 미완료 플랜: DnD 활성화 시 SortablePlanItem으로 래핑
                const planCard = (
                  <PlanItemCard
                    plan={planData}
                    container="daily"
                    showProgress={true}
                    showTime={true}
                    selectable={isSelectionMode && !isCompleted}
                    isSelected={selectedPlans.has(plan.id)}
                    conflictInfo={conflictInfo}
                    disableDrag={isDndReorderEnabled}
                    onSelect={handleToggleSelect}
                    onMoveToWeekly={handleMoveToWeekly}
                    onRedistribute={onRedistribute}
                    onEdit={onEdit}
                    onMoveToGroup={onMoveToGroup ? handleMoveToGroupSingle : undefined}
                    onCopy={onCopy ? handleCopySingle : undefined}
                    onStatusChange={onStatusChange}
                    onDelete={handleDeleteRequest}
                    onRefresh={onRefresh}
                  />
                );

                if (isDndReorderEnabled) {
                  return (
                    <SortablePlanItem
                      key={plan.id}
                      id={plan.id}
                      disabled={isPending}
                      dragData={{
                        type: 'plan',
                        containerId: 'daily',
                        title: plan.content_title ?? plan.custom_title ?? '플랜',
                        subject: plan.content_subject ?? undefined,
                        planDate: selectedDate,
                        planData: planData,
                      }}
                    >
                      {planCard}
                    </SortablePlanItem>
                  );
                }

                return <div key={plan.id}>{planCard}</div>;
              })}

              {/* Ad-hoc 플랜 (정렬 대상 아님) */}
              {adHocPlans.map((adHoc) => {
                const planData = toPlanItemData(adHoc, 'adhoc');
                return (
                  <PlanItemCard
                    key={adHoc.id}
                    plan={planData}
                    container="daily"
                    showProgress={false}
                    disableDrag={true}
                    onDelete={(id) => handleDeleteRequest(id, true)}
                    onRefresh={onRefresh}
                  />
                );
              })}
            </div>
          </SortableContext>
        )}
      </div>
      </div>

      {/* 일괄 작업 모달 */}
      {showBulkModal && (
        <BulkRedistributeModal
          planIds={selectedPlanIds}
          studentId={studentId}
          tenantId={tenantId}
          onClose={() => setShowBulkModal(false)}
          onSuccess={handleBulkSuccess}
        />
      )}

      {/* 삭제 확인 모달 */}
      <ConfirmDialog
        open={deleteConfirm.open}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteConfirm({ open: false, planId: null, isAdHoc: false });
          }
        }}
        title="플랜 삭제"
        description="이 플랜을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        isLoading={isPending}
        onConfirm={handleDeleteConfirm}
      />

      {/* 비학습시간 편집 모달 */}
      {editingNonStudy.item && plannerId && (
        <NonStudyTimeEditModal
          isOpen={editingNonStudy.open}
          onClose={() => {
            setEditingNonStudy({ open: false, item: null });
            // 중복 처리 방지 ref 초기화 (같은 드래그 조합 재시도 허용)
            lastDragEventRef.current = null;
          }}
          item={editingNonStudy.item}
          sourceIndex={editingNonStudy.sourceIndex}
          plannerId={plannerId}
          selectedDate={selectedDate}
          onSuccess={handleNonStudyEditSuccess}
          initialStartTime={editingNonStudy.initialStartTime}
        />
      )}
    </DroppableContainer>
  );
});
