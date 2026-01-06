"use client";

/**
 * 학생 선택 테이블 래퍼 컴포넌트
 * 기존 StudentTable을 재사용하면서 plan-creation에 맞게 래핑
 */

import { StudentTable } from "@/app/(admin)/admin/students/_components/StudentTable";
import type { StudentListRow } from "@/app/(admin)/admin/students/_components/types";

interface StudentSelectionTableProps {
  students: StudentListRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
}

export function StudentSelectionTable({
  students,
  selectedIds,
  onToggleSelect,
  onSelectAll,
}: StudentSelectionTableProps) {
  return (
    <StudentTable
      students={students}
      isAdmin={true} // plan-creation 페이지는 admin 전용
      selectedIds={selectedIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
    />
  );
}
