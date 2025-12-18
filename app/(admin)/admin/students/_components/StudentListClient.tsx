"use client";

import { useState, useCallback } from "react";
import { StudentTable } from "./StudentTable";
import { StudentBulkActions } from "./StudentBulkActions";
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

  return (
    <div className="flex flex-col gap-4">
      <StudentBulkActions
        selectedIds={Array.from(selectedIds)}
        isAdmin={isAdmin}
        onClearSelection={handleClearSelection}
      />

      <StudentTable
        students={students}
        isAdmin={isAdmin}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}

