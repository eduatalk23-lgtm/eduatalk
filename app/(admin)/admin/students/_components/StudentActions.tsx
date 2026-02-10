"use client";

import { useState, useTransition } from "react";
import { deleteStudent } from "@/lib/domains/student";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";

type StudentActionsProps = {
  studentId: string;
  studentName: string;
  isAdmin: boolean;
};

export function StudentActions({
  studentId,
  studentName,
  isAdmin,
}: StudentActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { showSuccess, showError } = useToast();

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

  if (!isAdmin) return null;

  return (
    <>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        disabled={isPending}
        className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 disabled:opacity-50"
      >
        삭제
      </button>

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
