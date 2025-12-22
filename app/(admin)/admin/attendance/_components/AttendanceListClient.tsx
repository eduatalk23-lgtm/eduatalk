"use client";

import { useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AttendanceTable } from "./AttendanceTable";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteAttendanceRecordAction } from "@/lib/domains/attendance";
import { ConfirmDialog } from "@/components/ui/Dialog";
import Button from "@/components/atoms/Button";
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
  const [isPending, startTransition] = useTransition();
  const [isBatchDeleteDialogOpen, setIsBatchDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    setIsBatchDeleteDialogOpen(true);
  }, [selectedIds]);

  const handleConfirmBatchDelete = useCallback(() => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      setIsDeleting(true);
      const recordIds = Array.from(selectedIds);
      
      // 각 기록의 studentId를 찾기 위해 records에서 매핑
      const recordsToDelete = records.filter((r) => recordIds.includes(r.id));
      const deletePromises = recordsToDelete.map((record) =>
        deleteAttendanceRecordAction(record.id, record.student_id)
      );

      try {
        const results = await Promise.allSettled(deletePromises);
        const successCount = results.filter(
          (r) => r.status === "fulfilled" && r.value.success
        ).length;
        const failureCount = results.length - successCount;

        if (successCount > 0) {
          showSuccess(
            `${successCount}개의 출석 기록이 삭제되었습니다.${
              failureCount > 0 ? ` (${failureCount}개 실패)` : ""
            }`
          );
          setSelectedIds(new Set());
          router.refresh();
        } else {
          showError("출석 기록 삭제에 실패했습니다.");
        }
      } catch (error) {
        console.error("일괄 삭제 실패:", error);
        showError("일괄 삭제 중 오류가 발생했습니다.");
      } finally {
        setIsDeleting(false);
        setIsBatchDeleteDialogOpen(false);
      }
    });
  }, [selectedIds, records, router, showSuccess, showError]);

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/20 p-4">
          <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
            {selectedIds.size}개 항목 선택됨
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBatchDelete}
              disabled={isPending || isDeleting}
            >
              선택 항목 삭제
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              disabled={isPending || isDeleting}
            >
              선택 해제
            </Button>
          </div>
        </div>
      )}
      <AttendanceTable
        records={records}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleSelect}
        onSelectAll={handleSelectAll}
        onDelete={handleDelete}
      />
      <ConfirmDialog
        open={isBatchDeleteDialogOpen}
        onOpenChange={setIsBatchDeleteDialogOpen}
        title="일괄 삭제 확인"
        description={`선택한 ${selectedIds.size}개의 출석 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        variant="destructive"
        onConfirm={handleConfirmBatchDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}

