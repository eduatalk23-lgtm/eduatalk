"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useTransition,
  ReactNode,
} from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
  rescheduleOnDrop,
  PlanType,
} from "@/lib/domains/plan/actions/calendarDrag";

// Drag item data type
export interface DraggablePlanData {
  id: string;
  type: PlanType;
  title: string;
  originalDate: string;
  originalStartTime?: string | null;
  estimatedMinutes?: number | null;
}

// Drop target data type
export interface DroppableTargetData {
  targetType: "date" | "time-slot";
  date: string;
  startTime?: string;
}

interface CalendarDragContextValue {
  isDragging: boolean;
  activePlan: DraggablePlanData | null;
  overTarget: DroppableTargetData | null;
  isPending: boolean;
}

const CalendarDragContext = createContext<CalendarDragContextValue>({
  isDragging: false,
  activePlan: null,
  overTarget: null,
  isPending: false,
});

export const useCalendarDrag = () => useContext(CalendarDragContext);

interface CalendarDragProviderProps {
  children: ReactNode;
}

export function CalendarDragProvider({ children }: CalendarDragProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [activePlan, setActivePlan] = useState<DraggablePlanData | null>(null);
  const [overTarget, setOverTarget] = useState<DroppableTargetData | null>(null);
  const [isPending, startTransition] = useTransition();

  const router = useRouter();
  const { showToast } = useToast();

  // Configure sensors for drag-and-drop
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
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DraggablePlanData | undefined;
    if (data) {
      setIsDragging(true);
      setActivePlan(data);
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const data = event.over?.data.current as DroppableTargetData | undefined;
    if (data) {
      setOverTarget(data);
    } else {
      setOverTarget(null);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setIsDragging(false);
      setActivePlan(null);
      setOverTarget(null);

      if (!over) return;

      const planData = active.data.current as DraggablePlanData | undefined;
      const targetData = over.data.current as DroppableTargetData | undefined;

      if (!planData || !targetData) return;

      // 같은 날짜, 같은 시간이면 무시
      if (
        planData.originalDate === targetData.date &&
        planData.originalStartTime === targetData.startTime
      ) {
        return;
      }

      // 서버 액션 호출
      startTransition(async () => {
        const result = await rescheduleOnDrop(
          planData.id,
          planData.type,
          targetData.date,
          targetData.startTime
        );

        if (result.success) {
          showToast(
            `"${planData.title}" 플랜이 ${targetData.date}로 이동되었습니다.`,
            "success"
          );
          router.refresh();
        } else {
          showToast(result.error || "플랜 이동에 실패했습니다.", "error");
        }
      });
    },
    [router, showToast]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActivePlan(null);
    setOverTarget(null);
  }, []);

  const value: CalendarDragContextValue = {
    isDragging,
    activePlan,
    overTarget,
    isPending,
  };

  return (
    <CalendarDragContext.Provider value={value}>
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
      </DndContext>
    </CalendarDragContext.Provider>
  );
}
