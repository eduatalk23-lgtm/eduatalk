"use client";

import { useState, useCallback, useMemo } from "react";
import { StudentTable } from "./StudentTable";
import { StudentBulkActions } from "./StudentBulkActions";
import { BatchAIPlanModal } from "./BatchAIPlanModal";
import type { StudentListRow } from "./types";

type StudentListClientProps = {
  students: StudentListRow[];
  isAdmin: boolean;
};

export function StudentListClient({
  students,
  isAdmin,
}: StudentListClientProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // 선택된 학생들
  const selectedStudents = useMemo(() => {
    return students.filter((s) => selectedIds.has(s.id));
  }, [students, selectedIds]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedIds(new Set(students.map((s) => s.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [students]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleOpenBatchAIPlan = useCallback(() => {
    setIsBatchModalOpen(true);
  }, []);

  const handleCloseBatchAIPlan = useCallback(() => {
    setIsBatchModalOpen(false);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <StudentBulkActions
        selectedIds={Array.from(selectedIds)}
        selectedStudents={selectedStudents}
        isAdmin={isAdmin}
        onClearSelection={handleClearSelection}
        onOpenBatchAIPlan={handleOpenBatchAIPlan}
      />

      <StudentTable
        students={students}
        isAdmin={isAdmin}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />

      {/* 배치 AI 플랜 생성 모달 */}
      <BatchAIPlanModal
        open={isBatchModalOpen}
        onClose={handleCloseBatchAIPlan}
        selectedStudents={selectedStudents}
      />
    </div>
  );
}

