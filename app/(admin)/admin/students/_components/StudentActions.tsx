"use client";

import { useState, useTransition } from "react";
import { toggleStudentStatus, deleteStudent } from "@/lib/domains/student";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";

type StudentActionsProps = {
  studentId: string;
  studentName: string;
  isActive: boolean;
  isAdmin: boolean;
};

export function StudentActions({
  studentId,
  studentName,
  isActive,
  isAdmin,
}: StudentActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showStatusConfirm, setShowStatusConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleToggleStatusConfirm = () => {
    startTransition(async () => {
      const result = await toggleStudentStatus(studentId, !isActive);
      if (result.success) {
        showSuccess(`${studentName} 학생이 ${isActive ? "비활성화" : "활성화"}되었습니다.`);
        router.refresh();
      } else {
        showError(result.error || "상태 변경에 실패했습니다.");
      }
      setShowStatusConfirm(false);
    });
  };

  const handleDeleteConfirm = () => {
    startTransition(async () => {
      const result = await deleteStudent(studentId);
      if (result.success) {
        showSuccess(`${studentName} 학생이 삭제되었습니다.`);
        router.push("/admin/students");
      } else {
        showError(result.error || "학생 삭제에 실패했습니다.");
      }
      setShowDeleteConfirm(false);
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowStatusConfirm(true)}
          disabled={isPending}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            isActive
              ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
              : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
          } disabled:opacity-50`}
        >
          {isActive ? "비활성화" : "활성화"}
        </button>
        {isAdmin && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isPending}
            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 disabled:opacity-50"
          >
            삭제
          </button>
        )}
      </div>

      {/* 상태 변경 확인 다이얼로그 */}
      <ConfirmDialog
        open={showStatusConfirm}
        onOpenChange={setShowStatusConfirm}
        title={isActive ? "학생 비활성화" : "학생 활성화"}
        description={`${studentName} 학생을 ${isActive ? "비활성화" : "활성화"}하시겠습니까?`}
        confirmLabel={isActive ? "비활성화" : "활성화"}
        cancelLabel="취소"
        onConfirm={handleToggleStatusConfirm}
        variant={isActive ? "destructive" : "default"}
        isLoading={isPending}
      />

      {/* 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="학생 삭제"
        description={`정말 ${studentName} 학생을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 모든 데이터가 삭제됩니다.`}
        confirmLabel="삭제"
        cancelLabel="취소"
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        isLoading={isPending}
      />
    </>
  );
}

