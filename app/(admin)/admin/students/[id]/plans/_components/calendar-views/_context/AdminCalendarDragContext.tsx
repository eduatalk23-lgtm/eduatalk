"use client";

/**
 * 관리자 캘린더 드래그앤드롭 컨텍스트
 *
 * 캘린더 뷰에서 플랜을 드래그하여 날짜를 변경하는 기능을 제공합니다.
 * - 제외일 드롭 방지
 * - 시각적 피드백 (드래그 오버레이, 드롭 가능/불가능 표시)
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  ReactNode,
  useMemo,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
} from "@dnd-kit/core";
import { useToast } from "@/components/ui/ToastProvider";
import { movePlanToContainer } from "@/lib/domains/admin-plan/actions";
import DragOverlayContent from "../DragOverlayContent";
import type {
  DraggableAdminPlanData,
  DroppableTargetData,
  ExclusionsByDate,
} from "../_types/adminCalendar";

// ============================================
// Context 타입 정의
// ============================================

interface AdminCalendarDragContextValue {
  /** 현재 드래그 중인지 여부 */
  isDragging: boolean;
  /** 드래그 중인 플랜 데이터 */
  activePlan: DraggableAdminPlanData | null;
  /** 현재 오버 중인 타겟 */
  overTarget: DroppableTargetData | null;
  /** 서버 액션 진행 중 여부 */
  isPending: boolean;
  /** 드롭 가능 여부 체크 함수 */
  canDropOnDate: (date: string) => boolean;
}

const AdminCalendarDragContext = createContext<AdminCalendarDragContextValue>({
  isDragging: false,
  activePlan: null,
  overTarget: null,
  isPending: false,
  canDropOnDate: () => true,
});

export const useAdminCalendarDrag = () => useContext(AdminCalendarDragContext);

// ============================================
// Provider Props
// ============================================

interface AdminCalendarDragProviderProps {
  children: ReactNode;
  /** 학생 ID */
  studentId: string;
  /** 테넌트 ID */
  tenantId: string;
  /** 제외일 맵 (드롭 방지용) */
  exclusionsByDate: ExclusionsByDate;
  /** 데이터 새로고침 콜백 */
  onRefresh: () => void;
}

// ============================================
// Provider 구현
// ============================================

export function AdminCalendarDragProvider({
  children,
  studentId,
  tenantId,
  exclusionsByDate,
  onRefresh,
}: AdminCalendarDragProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activePlan, setActivePlan] = useState<DraggableAdminPlanData | null>(
    null
  );
  const [overTarget, setOverTarget] = useState<DroppableTargetData | null>(null);
  const [isPending, startTransition] = useTransition();

  const toast = useToast();

  // 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // 5px 이동 후 드래그 시작 (실수 클릭 방지)
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        // 터치: 150ms 롱프레스 후 드래그 시작
        delay: 150,
        tolerance: 5,
      },
    })
  );

  // 드롭 가능 여부 체크
  const canDropOnDate = useCallback(
    (date: string): boolean => {
      // 제외일이면 드롭 불가
      return !exclusionsByDate[date];
    },
    [exclusionsByDate]
  );

  // 드래그 시작
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as
      | DraggableAdminPlanData
      | undefined;
    if (data) {
      setIsDragging(true);
      setActivePlan(data);
    }
  }, []);

  // 드래그 오버
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const data = event.over?.data.current as DroppableTargetData | undefined;
    if (data) {
      setOverTarget(data);
    } else {
      setOverTarget(null);
    }
  }, []);

  // 드래그 종료
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // 상태 초기화
      setIsDragging(false);
      setActivePlan(null);
      setOverTarget(null);

      if (!over) return;

      const planData = active.data.current as
        | DraggableAdminPlanData
        | undefined;
      const targetData = over.data.current as DroppableTargetData | undefined;

      if (!planData || !targetData) return;

      // 같은 날짜면 무시
      if (planData.originalDate === targetData.date) {
        return;
      }

      // 제외일 체크
      if (targetData.isExclusion) {
        const exclusion = exclusionsByDate[targetData.date];
        toast.showToast(
          `${targetData.date}는 제외일입니다: ${exclusion?.exclusion_type || "제외일"}`,
          "warning"
        );
        return;
      }

      // 서버 액션 호출 (관리자 버전 - 이벤트 로깅 포함)
      startTransition(async () => {
        try {
          const result = await movePlanToContainer({
            planId: planData.id,
            planType: "plan",
            fromContainer: "daily", // 캘린더 뷰는 daily 컨테이너에서 시작
            toContainer: "daily",
            studentId,
            tenantId,
            targetDate: targetData.date,
          });

          if (result.success) {
            toast.showToast(
              `"${planData.title}" 플랜이 ${targetData.date}로 이동되었습니다.`,
              "success"
            );
            onRefresh();
          } else {
            toast.showToast(
              result.error || "플랜 이동에 실패했습니다.",
              "error"
            );
          }
        } catch (error) {
          console.error("플랜 이동 오류:", error);
          toast.showToast("플랜 이동 중 오류가 발생했습니다.", "error");
        }
      });
    },
    [exclusionsByDate, toast, onRefresh, studentId, tenantId]
  );

  // 드래그 취소
  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActivePlan(null);
    setOverTarget(null);
  }, []);

  // Context 값 메모이제이션
  const value = useMemo<AdminCalendarDragContextValue>(
    () => ({
      isDragging,
      activePlan,
      overTarget,
      isPending,
      canDropOnDate,
    }),
    [isDragging, activePlan, overTarget, isPending, canDropOnDate]
  );

  return (
    <AdminCalendarDragContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        {/* 드래그 오버레이 - 향상된 시각적 피드백 */}
        <DragOverlay dropAnimation={null}>
          {activePlan && (
            <DragOverlayContent
              plan={activePlan}
              overTarget={overTarget}
              canDropOnDate={canDropOnDate}
              isPending={isPending}
            />
          )}
        </DragOverlay>
      </DndContext>
    </AdminCalendarDragContext.Provider>
  );
}
