'use client';

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react';
import type { CalendarSettings } from '@/lib/domains/admin-plan/types';
import type { PrefetchedDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';

interface StudentPlanContextValue {
  studentId: string;
  tenantId: string;
  calendars: CalendarSettings[];
  selectedCalendarId: string | undefined;
  setSelectedCalendarId: (id: string) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  /** SSR 프리페치 데이터 (initialDate에 대한 데이터) */
  initialDockData?: PrefetchedDockData;
  /** SSR 프리페치 시점의 초기 날짜 */
  initialDate: string;
  /** SSR 프리페치 시점의 초기 캘린더 ID */
  initialCalendarId: string | undefined;
}

const StudentPlanContext = createContext<StudentPlanContextValue | null>(null);

interface StudentPlanProviderProps {
  children: ReactNode;
  studentId: string;
  tenantId: string;
  calendars: CalendarSettings[];
  initialCalendarId?: string;
  initialDate: string;
  initialDockData?: PrefetchedDockData;
}

export function StudentPlanProvider({
  children,
  studentId,
  tenantId,
  calendars,
  initialCalendarId,
  initialDate,
  initialDockData,
}: StudentPlanProviderProps) {
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | undefined>(initialCalendarId);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const value = useMemo<StudentPlanContextValue>(() => ({
    studentId,
    tenantId,
    calendars,
    selectedCalendarId,
    setSelectedCalendarId,
    selectedDate,
    setSelectedDate,
    initialDockData,
    initialDate,
    initialCalendarId,
  }), [studentId, tenantId, calendars, selectedCalendarId, selectedDate, initialDockData, initialDate, initialCalendarId]);

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
