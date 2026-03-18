"use client";

// ============================================
// 생기부 Context — studentId/tenantId 제공
// SidePanel 앱에서 AdminPlanContext 대신 사용
// ============================================

import { createContext, useContext } from "react";

interface StudentRecordContextValue {
  studentId: string;
  tenantId: string;
  studentName?: string;
}

const StudentRecordContext = createContext<StudentRecordContextValue | null>(null);

export function StudentRecordProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: StudentRecordContextValue;
}) {
  return (
    <StudentRecordContext.Provider value={value}>
      {children}
    </StudentRecordContext.Provider>
  );
}

export function useStudentRecordContext(): StudentRecordContextValue {
  const ctx = useContext(StudentRecordContext);
  if (!ctx)
    throw new Error("useStudentRecordContext must be used within StudentRecordProvider");
  return ctx;
}
