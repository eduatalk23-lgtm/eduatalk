"use client";

import { useState, useTransition } from "react";
import { toggleStudentStatus, deleteStudent } from "@/app/(admin)/actions/studentManagementActions";
import { useRouter } from "next/navigation";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleToggleStatus = () => {
    if (!confirm(`${studentName} 학생을 ${isActive ? "비활성화" : "활성화"}하시겠습니까?`)) {
      return;
    }

    startTransition(async () => {
      const result = await toggleStudentStatus(studentId, !isActive);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || "상태 변경에 실패했습니다.");
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`정말 ${studentName} 학생을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 모든 데이터가 삭제됩니다.`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteStudent(studentId);
      if (result.success) {
        router.push("/admin/students");
      } else {
        alert(result.error || "학생 삭제에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleStatus}
        disabled={isPending}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
          isActive
            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
            : "bg-green-100 text-green-800 hover:bg-green-200"
        } disabled:opacity-50`}
      >
        {isActive ? "비활성화" : "활성화"}
      </button>
      {isAdmin && (
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-200 disabled:opacity-50"
        >
          삭제
        </button>
      )}
    </div>
  );
}

