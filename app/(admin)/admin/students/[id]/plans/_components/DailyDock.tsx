'use client';

import { useState, useTransition, useMemo, useCallback, useEffect, memo, useRef } from 'react';
import { cn } from '@/lib/cn';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useDndMonitor, type DragEndEvent } from '@dnd-kit/core';
import { DroppableContainer, SortablePlanItem, DraggableNonStudyItem, type NonStudyDropData } from './dnd';
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
import { NonStudyTimeEditModal } from './modals/NonStudyTimeEditModal';
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
}: DailyDockProps) {
  // React Query 훅 사용 (캐싱 및 중복 요청 방지)
  const { plans: allPlans, adHocPlans, isLoading } = useDailyDockQuery(
    studentId,
    selectedDate,
    plannerId
  );

  // 비학습시간 데이터 조회 (플랜 로딩 완료 후에만 실행하여 플리커 방지)
  const { nonStudyItems } = useNonStudyTimeQuery(studentId, selectedDate, allPlans, !isLoading, plannerId);

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

  // plans가 변경되면 localPlanOrder 초기화
  useEffect(() => {
    setLocalPlanOrder(null);
  }, [plans]);

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

  // DnD 이벤트 모니터링 - 같은 컨테이너 내 재정렬 + 비학습시간 드롭 감지
  useDndMonitor({
    onDragEnd: (event: DragEndEvent) => {
      const { active, over } = event;

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

      // active와 over 모두 sortableIds에 포함된 경우만 처리 (같은 컨테이너 내 재정렬)
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

          // 해당 슬롯 내의 플랜들 (시간순 정렬)
          const plansInSlot = plans
            .filter(plan => {
              if (!plan.start_time || !plan.end_time) return false;
              const planStart = parseTime(plan.start_time);
              const planEnd = parseTime(plan.end_time);
              // 플랜이 슬롯과 겹치는지 확인
              return planStart < slotEnd && planEnd > slotStart;
            })
            .sort((a, b) => parseTime(a.start_time!) - parseTime(b.start_time!));

          // 해당 슬롯과 겹치는 nonStudyItems (빈 시간 계산에서 제외해야 함)
          const nonStudyInSlot = nonStudyItems
            .filter(ns => {
              const nsStart = parseTime(ns.start_time);
              const nsEnd = parseTime(ns.end_time);
              return nsStart < slotEnd && nsEnd > slotStart;
            })
            .map(ns => ({
              start: Math.max(parseTime(ns.start_time), slotStart),
              end: Math.min(parseTime(ns.end_time), slotEnd),
            }));

          // 플랜과 nonStudyItems를 합쳐서 "occupied" 구간 생성
          type OccupiedSlot = { start: number; end: number; plan?: typeof plansInSlot[number] };
          const occupiedSlots: OccupiedSlot[] = [
            ...plansInSlot.map(plan => ({
              start: Math.max(parseTime(plan.start_time!), slotStart),
              end: Math.min(parseTime(plan.end_time!), slotEnd),
              plan,
            })),
            ...nonStudyInSlot.map(ns => ({ start: ns.start, end: ns.end })),
          ].sort((a, b) => a.start - b.start);

          // 슬롯 내 시간을 순회하며 플랜과 빈 시간 배치
          let currentTime = slotStart;

          for (const occupied of occupiedSlots) {
            // occupied 시작 전 빈 시간이 있으면 1시간 단위로 분할하여 추가
            if (occupied.start > currentTime) {
              const emptySlots = splitEmptyTimeByHour(currentTime, occupied.start);
              for (const emptySlot of emptySlots) {
                items.push({
                  kind: 'emptySlot',
                  slot: emptySlot,
                  sortKey: parseTime(emptySlot.startTime),
                });
              }
            }

            // 플랜인 경우만 추가 (nonStudyItems는 별도로 추가됨)
            if (occupied.plan) {
              items.push({
                kind: 'plan',
                plan: occupied.plan,
                sortKey: occupied.start,
              });
            }

            currentTime = Math.max(currentTime, occupied.end);
          }

          // 슬롯 끝까지 남은 빈 시간을 1시간 단위로 분할하여 추가
          if (currentTime < slotEnd) {
            const emptySlots = splitEmptyTimeByHour(currentTime, slotEnd);
            for (const emptySlot of emptySlots) {
              items.push({
                kind: 'emptySlot',
                slot: emptySlot,
                sortKey: parseTime(emptySlot.startTime),
              });
            }
          }
        } else {
          // 비학습시간 슬롯 (점심시간, 학원일정, 이동시간 등)
          // 오버라이드가 적용된 경우: 원래 슬롯 위치는 빈 시간 슬롯으로 변환
          // nonStudyItems는 나중에 별도로 추가됨
          // 타입 매핑: 점심시간 → 점심식사, 학원일정 → 학원
          const slotTypeToNonStudyType: Record<string, string> = {
            '점심시간': '점심식사',
            '학원일정': '학원',
            '이동시간': '이동시간',
          };
          const mappedType = slotTypeToNonStudyType[slot.type];

          // nonStudyItems에서 같은 타입의 항목 찾기
          const matchingNonStudyItem = mappedType && nonStudyItems.find(
            (ns) => ns.type === mappedType
          );

          if (matchingNonStudyItem) {
            // 오버라이드가 적용된 경우: 시간이 다르면 원래 위치를 빈 시간 슬롯으로 변환
            const originalStart = parseTime(slot.start);
            const overrideStart = parseTime(matchingNonStudyItem.start_time);

            if (originalStart !== overrideStart) {
              // 시간이 변경됨 - 원래 슬롯 위치를 빈 시간 슬롯으로 변환
              const emptySlots = splitEmptyTimeByHour(slotStart, slotEnd);
              for (const emptySlot of emptySlots) {
                items.push({
                  kind: 'emptySlot',
                  slot: emptySlot,
                  sortKey: parseTime(emptySlot.startTime),
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
      });

      if (!result.success) {
        showToast(result.error ?? 'Weekly 이동 실패', 'error');
        return;
      }

      showToast('Weekly Dock으로 이동했습니다.', 'success');
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

  return (
    <DroppableContainer id="daily">
      <div
        className={cn(
          'bg-blue-50 rounded-lg border border-blue-200',
          isPending && 'opacity-50 pointer-events-none'
        )}
      >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <span className="text-lg">📦</span>
          <span className="font-medium text-blue-700">Daily Dock</span>
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

      {/* 보기 토글 */}
      {nonStudyItems.length > 0 && (
        <div className="flex items-center justify-end px-4 py-1.5 border-b border-blue-100">
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

      {/* 플랜 목록 */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {SKELETON_ITEMS.map((i) => (
              <div key={i} className="h-16 bg-blue-100 rounded animate-pulse" />
            ))}
          </div>
        ) : totalCount === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>이 날짜에 플랜이 없습니다</p>
            <p className="text-sm mt-1">플랜을 추가해주세요</p>
          </div>
        ) : viewMode === 'all' && mergedItems.length > 0 ? (
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {/* 시간순 병합 (플랜 + 비학습시간 + 빈 시간) - 플랜만 정렬 가능 */}
              {mergedItems.map((item) => {
                if (item.kind === 'nonStudy') {
                  // 비학습시간은 플래너가 선택된 경우에만 편집 가능
                  const canEdit = !!plannerId;
                  const canDrag = canEdit && enableNonStudyDrag;
                  const cardKey = `ns-${item.item.type}-${item.item.start_time}`;

                  const card = (
                    <NonStudyTimeCard
                      item={item.item}
                      editable={canEdit && !canDrag}
                      onClick={canEdit && !canDrag ? () => handleNonStudyTimeClick(item.item, item.item.sourceIndex) : undefined}
                    />
                  );

                  if (canDrag) {
                    return (
                      <DraggableNonStudyItem
                        key={cardKey}
                        id={cardKey}
                        dragData={{
                          title: item.item.label ?? item.item.type,
                          itemType: item.item.type,
                          originalStartTime: item.item.start_time.substring(0, 5),
                          originalEndTime: item.item.end_time.substring(0, 5),
                          sourceIndex: item.item.sourceIndex, // 원본 데이터의 sourceIndex 사용
                        }}
                      >
                        {card}
                      </DraggableNonStudyItem>
                    );
                  }

                  return <div key={cardKey}>{card}</div>;
                }

                if (item.kind === 'emptySlot') {
                  return (
                    <EmptyTimeSlotCard
                      key={`empty-${item.slot.startTime}-${item.slot.endTime}`}
                      slot={item.slot}
                      onCreatePlan={onCreatePlanAtSlot ? handleCreatePlanAtSlot : undefined}
                      onPlaceUnfinished={onPlaceUnfinishedAtSlot ? handlePlaceUnfinishedAtSlot : undefined}
                      onPlaceFromWeekly={onPlaceWeeklyAtSlot ? handlePlaceWeeklyAtSlot : undefined}
                    />
                  );
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
                  const canDrag = canEdit && enableNonStudyDrag;
                  const cardKey = `ts-${item.slot.type}-${item.slot.start}`;

                  const card = (
                    <NonStudyTimeCard
                      item={nonStudyItem}
                      editable={canEdit && !canDrag}
                      onClick={canEdit && !canDrag ? () => handleNonStudyTimeClick(nonStudyItem) : undefined}
                    />
                  );

                  if (canDrag) {
                    return (
                      <DraggableNonStudyItem
                        key={cardKey}
                        id={cardKey}
                        dragData={{
                          title: nonStudyItem.label ?? nonStudyItem.type,
                          itemType: nonStudyItem.type,
                          originalStartTime: nonStudyItem.start_time.substring(0, 5),
                          originalEndTime: nonStudyItem.end_time.substring(0, 5),
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

                // 미완료 플랜: DnD 활성화 시 SortablePlanItem으로 래핑
                const planCard = (
                  <PlanItemCard
                    plan={planData}
                    container="daily"
                    showProgress={true}
                    showTime={true}
                    selectable={isSelectionMode && !isCompleted}
                    isSelected={selectedPlans.has(item.plan.id)}
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
                      key={item.plan.id}
                      id={item.plan.id}
                      disabled={isPending}
                      dragData={{
                        type: 'plan',
                        containerId: 'daily',
                        title: item.plan.content_title ?? item.plan.custom_title ?? '플랜',
                        subject: item.plan.content_subject ?? undefined,
                        planDate: selectedDate,
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
          onClose={() => setEditingNonStudy({ open: false, item: null })}
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
