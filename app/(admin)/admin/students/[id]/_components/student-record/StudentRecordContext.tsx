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
  studentGrade: number;
  initialSchoolYear: number;
  schoolName?: string;
  /** G1: 현재 활성 과목 ID (세특 레이어 탭 ↔ 사이드 패널 연결용) */
  activeSubjectId?: string | null;
  setActiveSubjectId?: (id: string | null) => void;
  /** 컨텍스트 그리드: 활성 과목의 학년도 + 과목명 */
  activeSchoolYear?: number | null;
  setActiveSchoolYear?: (year: number | null) => void;
  activeSubjectName?: string | null;
  setActiveSubjectName?: (name: string | null) => void;
  /** 메인 스크롤 컨테이너 섹션 이동 (사이드 패널 → 메인 연결) */
  scrollToSection?: (sectionId: string) => void;
  /** 진로 설정 여부 (PipelinePanelApp 빈 상태 처리용) */
  hasTargetMajor?: boolean;
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
