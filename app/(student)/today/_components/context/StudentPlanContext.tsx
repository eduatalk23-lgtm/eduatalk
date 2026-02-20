'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { DockType } from '@/components/planner/CollapsedDockCard';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';

interface StudentPlanContextValue {
  studentId: string;
  tenantId: string;
  planners: Planner[];
  selectedPlannerId: string | undefined;
  setSelectedPlannerId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  expandedDock: DockType;
  setExpandedDock: (dock: DockType) => void;
  /** SSR 프리페치 데이터 (initialDate에 대한 데이터) */
  initialDockData?: PrefetchedDockData;
  /** SSR 프리페치 시점의 초기 날짜 */
  initialDate: string;
  /** SSR 프리페치 시점의 초기 플래너 ID */
  initialPlannerId: string | undefined;
}

const StudentPlanContext = createContext<StudentPlanContextValue | null>(null);

interface StudentPlanProviderProps {
  children: ReactNode;
  studentId: string;
  tenantId: string;
  planners: Planner[];
  initialPlannerId?: string;
  initialDate: string;
  initialDockData?: PrefetchedDockData;
}

export function StudentPlanProvider({
  children,
  studentId,
  tenantId,
  planners,
  initialPlannerId,
  initialDate,
  initialDockData,
}: StudentPlanProviderProps) {
  const [selectedPlannerId, setSelectedPlannerId] = useState<string | undefined>(initialPlannerId);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [expandedDock, setExpandedDock] = useState<DockType>('daily');

  const value = useMemo<StudentPlanContextValue>(() => ({
    studentId,
    tenantId,
    planners,
    selectedPlannerId,
    setSelectedPlannerId,
    selectedDate,
    setSelectedDate,
    expandedDock,
    setExpandedDock,
    initialDockData,
    initialDate,
    initialPlannerId,
  }), [studentId, tenantId, planners, selectedPlannerId, selectedDate, expandedDock, initialDockData, initialDate, initialPlannerId]);

  return (
    <StudentPlanContext.Provider value={value}>
      {children}
    </StudentPlanContext.Provider>
  );
}

export function useStudentPlan() {
  const ctx = useContext(StudentPlanContext);
  if (!ctx) {
    throw new Error('useStudentPlan must be used within StudentPlanProvider');
  }
  return ctx;
}
