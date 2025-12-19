"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AttendanceTable } from "./AttendanceTable";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteAttendanceRecordAction } from "@/app/(admin)/actions/attendanceActions";
import type { AttendanceTableRow } from "./types";

type AttendanceListClientProps = {
  records: AttendanceTableRow[];
};

export function AttendanceListClient({
  records,
}: AttendanceListClientProps) {
  const router = useRouter();
  const { showSuccess, showError } = useToast();
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

  const handleDelete = useCallback(
    async (recordId: string, studentId: string) => {
      try {
        const result = await deleteAttendanceRecordAction(recordId, studentId);
        if (result.success) {
          showSuccess("출석 기록이 삭제되었습니다.");
          router.refresh();
        } else {
          showError(result.error || "출석 기록 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("출석 기록 삭제 실패:", error);
        showError("출석 기록 삭제 중 오류가 발생했습니다.");
      }
    },
    [router, showSuccess, showError]
  );

  return (
    <div className="flex flex-col gap-4">
      <AttendanceTable
        records={records}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onDelete={handleDelete}
      />
    </div>
  );
}

