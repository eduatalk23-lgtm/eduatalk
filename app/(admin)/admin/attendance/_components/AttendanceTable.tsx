"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  bgSurface,
  textPrimary,
  textMuted,
  divideDefaultVar,
  tableRowBase,
  tableCellBase,
  tableHeaderBase,
  borderInput,
  getIndigoTextClasses,
} from "@/lib/utils/darkMode";
import {
  getAttendanceStatusBadgeClass,
  formatAttendanceTime,
  getCheckMethodLabel,
  getAttendanceStatusLabel,
} from "@/lib/utils/attendanceUtils";
import { ConfirmDialog } from "@/components/ui/Dialog";
import type { AttendanceTableRow } from "./types";

type AttendanceTableProps = {
  records: AttendanceTableRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete?: (recordId: string, studentId: string) => void;
};

export function AttendanceTable({
  records,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDelete,
}: AttendanceTableProps) {
  const allSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id));
  const someSelected = records.some((r) => selectedIds.has(r.id));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; studentId: string; studentName: string; date: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteClick = (record: AttendanceTableRow) => {
    setRecordToDelete({
      id: record.id,
      studentId: record.student_id,
      studentName: record.student_name ?? "이름 없음",
      date: record.attendance_date,
    });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!recordToDelete || !onDelete) return;

    setIsDeleting(true);
    try {
      await onDelete(recordToDelete.id, recordToDelete.studentId);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("삭제 실패:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  if (records.length === 0) {
    return (
      <div className={cn("rounded-lg border p-8 text-center", "bg-white dark:bg-gray-900")}>
        <p className={cn("text-sm", textMuted)}>출석 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg shadow-sm", "bg-white dark:bg-gray-900")}>
      <table className="w-full">
        <thead className={cn("bg-gray-50 dark:bg-gray-800")}>
          <tr>
            <th className={tableHeaderBase}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = someSelected && !allSelected;
                  }
                }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className={cn(
                  "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                  borderInput
                )}
              />
            </th>
            <th className={tableHeaderBase}>날짜</th>
            <th className={tableHeaderBase}>학생명</th>
            <th className={tableHeaderBase}>상태</th>
            <th className={tableHeaderBase}>입실시간</th>
            <th className={tableHeaderBase}>입실방법</th>
            <th className={tableHeaderBase}>퇴실시간</th>
            <th className={tableHeaderBase}>퇴실방법</th>
            <th className={tableHeaderBase}>비고</th>
            <th className={tableHeaderBase}>작업</th>
          </tr>
        </thead>
        <tbody className={cn("divide-y", divideDefaultVar, bgSurface)}>
          {records.map((record) => {
            const isSelected = selectedIds.has(record.id);
            return (
              <tr
                key={record.id}
                className={cn(
                  tableRowBase,
                  isSelected && "bg-indigo-50 dark:bg-indigo-950/20"
                )}
              >
                <td className={tableCellBase}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(record.id)}
                    className={cn(
                      "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500",
                      borderInput
                    )}
                  />
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {record.attendance_date}
                </td>
                <td className={cn(tableCellBase, "font-medium", textPrimary)}>
                  <Link
                    href={`/admin/students/${record.student_id}`}
                    className={cn(
                      getIndigoTextClasses("link"),
                      "hover:underline"
                    )}
                  >
                    {record.student_name ?? "이름 없음"}
                  </Link>
                </td>
                <td className={tableCellBase}>
                  <span
                    className={cn(
                      "rounded-full px-2 py-1 text-xs font-semibold",
                      getAttendanceStatusBadgeClass(record.status)
                    )}
                  >
                    {getAttendanceStatusLabel(record.status)}
                  </span>
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {formatAttendanceTime(record.check_in_time)}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {getCheckMethodLabel(record.check_in_method)}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {formatAttendanceTime(record.check_out_time)}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {getCheckMethodLabel(record.check_out_method)}
                </td>
                <td className={cn(tableCellBase, textMuted)}>
                  {record.notes ?? "-"}
                </td>
                <td className={tableCellBase}>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/attendance/${record.id}/edit`}
                      className={cn(
                        "text-sm",
                        getIndigoTextClasses("link"),
                        "hover:underline"
                      )}
                    >
                      수정
                    </Link>
                    {onDelete && (
                      <button
                        onClick={() => handleDeleteClick(record)}
                        className={cn(
                          "text-sm text-red-600 hover:text-red-700 hover:underline",
                          "dark:text-red-400 dark:hover:text-red-300"
                        )}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {recordToDelete && (
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="출석 기록 삭제"
          description={`${recordToDelete.studentName}의 ${recordToDelete.date} 출석 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
          confirmLabel="삭제"
          cancelLabel="취소"
          variant="destructive"
          onConfirm={handleDeleteConfirm}
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}

