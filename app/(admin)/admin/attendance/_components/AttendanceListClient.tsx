"use client";

import { useState, useCallback } from "react";
import { AttendanceTable } from "./AttendanceTable";
import type { AttendanceTableRow } from "./types";

type AttendanceListClientProps = {
  records: AttendanceTableRow[];
};

export function AttendanceListClient({
  records,
}: AttendanceListClientProps) {
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
        setSelectedIds(new Set(records.map((r) => r.id)));
      } else {
        setSelectedIds(new Set());
      }
    },
    [records]
  );

  return (
    <div className="flex flex-col gap-4">
      <AttendanceTable
        records={records}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
      />
    </div>
  );
}

