"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkToggleStudentStatus,
  bulkDeleteStudents,
} from "@/lib/domains/student";
import {
  bgHover,
  textSecondary,
  borderInput,
  bgSurface,
} from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type StudentBulkActionsProps = {
  selectedIds: string[];
  isAdmin: boolean;
  onClearSelection: () => void;
};

export function StudentBulkActions({
  selectedIds,
  isAdmin,
  onClearSelection,
}: StudentBulkActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const selectedCount = selectedIds.length;

  const handleBulkActivate = () => {
    if (selectedCount === 0) {
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedCount}명의 학생을 활성화하시겠습니까?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await bulkToggleStudentStatus(selectedIds, true);
      if (result.success) {
        onClearSelection();
        router.refresh();
      } else {
        alert(result.error || "활성화에 실패했습니다.");
      }
    });
  };

  const handleBulkDeactivate = () => {
    if (selectedCount === 0) {
      return;
    }

    if (
      !confirm(
        `선택한 ${selectedCount}명의 학생을 비활성화하시겠습니까?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await bulkToggleStudentStatus(selectedIds, false);
      if (result.success) {
        onClearSelection();
        router.refresh();
      } else {
        alert(result.error || "비활성화에 실패했습니다.");
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedCount === 0) {
      return;
    }

    if (
      !confirm(
        `정말 선택한 ${selectedCount}명의 학생을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 모든 데이터가 삭제됩니다.`
      )
    ) {
      return;
    }

    startTransition(async () => {
      const result = await bulkDeleteStudents(selectedIds);
      if (result.success) {
        onClearSelection();
        router.refresh();
      } else {
        alert(result.error || "삭제에 실패했습니다.");
      }
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-lg border p-4",
        borderInput,
        bgSurface
      )}
    >
      <span className={cn("text-sm font-semibold", textSecondary)}>
        {selectedCount > 0 ? `${selectedCount}개 선택됨` : "기능"}
      </span>

      <div className="flex items-center gap-2">
        <button
          onClick={handleBulkActivate}
          disabled={isPending || selectedCount === 0}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
            "bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          활성화
        </button>

        <button
          onClick={handleBulkDeactivate}
          disabled={isPending || selectedCount === 0}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
            "bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          비활성화
        </button>

        {isAdmin && (
          <button
            onClick={handleBulkDelete}
            disabled={isPending || selectedCount === 0}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
              "bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            삭제
          </button>
        )}

        {selectedCount > 0 && (
          <button
            onClick={onClearSelection}
            disabled={isPending}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover,
              "disabled:opacity-50"
            )}
          >
            선택 해제
          </button>
        )}
      </div>
    </div>
  );
}

