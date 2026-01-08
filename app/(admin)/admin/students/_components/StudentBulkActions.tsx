"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ListPlus } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";
import type { StudentListRow } from "./types";

type StudentBulkActionsProps = {
  selectedIds: string[];
  selectedStudents: StudentListRow[];
  isAdmin: boolean;
  onClearSelection: () => void;
  onOpenBatchAIPlan: () => void;
};

type ConfirmAction = "activate" | "deactivate" | "delete" | null;

export function StudentBulkActions({
  selectedIds,
  selectedStudents,
  isAdmin,
  onClearSelection,
  onOpenBatchAIPlan,
}: StudentBulkActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const { showSuccess, showError } = useToast();
  const selectedCount = selectedIds.length;

  // 플랜 생성: 학생 상세 페이지 플랜 탭으로 이동
  const handleNavigateToPlanCreation = useCallback(() => {
    if (selectedCount === 0) return;

    if (selectedCount === 1) {
      // 단일 학생: 해당 학생의 플랜 탭으로 이동 (위저드 자동 오픈)
      router.push(`/admin/students/${selectedIds[0]}/plans?openWizard=true`);
    } else {
      // 다중 학생: 첫 번째 학생 페이지로 이동 + 배치 모드
      router.push(
        `/admin/students/${selectedIds[0]}/plans?batchStudentIds=${selectedIds.join(",")}`
      );
    }
  }, [selectedIds, selectedCount, router]);

  const handleConfirm = () => {
    if (!confirmAction || selectedCount === 0) return;

    startTransition(async () => {
      try {
        if (confirmAction === "activate") {
          const result = await bulkToggleStudentStatus(selectedIds, true);
          if (result.success) {
            showSuccess(`${selectedCount}명의 학생이 활성화되었습니다.`);
            onClearSelection();
            router.refresh();
          } else {
            showError(result.error || "활성화에 실패했습니다.");
          }
        } else if (confirmAction === "deactivate") {
          const result = await bulkToggleStudentStatus(selectedIds, false);
          if (result.success) {
            showSuccess(`${selectedCount}명의 학생이 비활성화되었습니다.`);
            onClearSelection();
            router.refresh();
          } else {
            showError(result.error || "비활성화에 실패했습니다.");
          }
        } else if (confirmAction === "delete") {
          const result = await bulkDeleteStudents(selectedIds);
          if (result.success) {
            showSuccess(`${selectedCount}명의 학생이 삭제되었습니다.`);
            onClearSelection();
            router.refresh();
          } else {
            showError(result.error || "삭제에 실패했습니다.");
          }
        }
      } finally {
        setConfirmAction(null);
      }
    });
  };

  const getConfirmDialogProps = () => {
    switch (confirmAction) {
      case "activate":
        return {
          title: "학생 활성화",
          description: `선택한 ${selectedCount}명의 학생을 활성화하시겠습니까?`,
          confirmLabel: "활성화",
          variant: "default" as const,
        };
      case "deactivate":
        return {
          title: "학생 비활성화",
          description: `선택한 ${selectedCount}명의 학생을 비활성화하시겠습니까?`,
          confirmLabel: "비활성화",
          variant: "destructive" as const,
        };
      case "delete":
        return {
          title: "학생 삭제",
          description: `정말 선택한 ${selectedCount}명의 학생을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 학생의 모든 데이터가 삭제됩니다.`,
          confirmLabel: "삭제",
          variant: "destructive" as const,
        };
      default:
        return {
          title: "",
          description: "",
          confirmLabel: "확인",
          variant: "default" as const,
        };
    }
  };

  const dialogProps = getConfirmDialogProps();

  return (
    <>
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
            onClick={() => setConfirmAction("activate")}
            disabled={isPending || selectedCount === 0}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
              "bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            활성화
          </button>

          <button
            onClick={() => setConfirmAction("deactivate")}
            disabled={isPending || selectedCount === 0}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
              "bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            비활성화
          </button>

          <button
            onClick={onOpenBatchAIPlan}
            disabled={isPending || selectedCount === 0}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
              "bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            AI 플랜 생성
          </button>

          <button
            onClick={handleNavigateToPlanCreation}
            disabled={isPending || selectedCount === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition",
              "bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ListPlus className="h-4 w-4" />
            플랜 생성
          </button>

          {isAdmin && (
            <button
              onClick={() => setConfirmAction("delete")}
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

      {/* 확인 다이얼로그 */}
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={dialogProps.title}
        description={dialogProps.description}
        confirmLabel={dialogProps.confirmLabel}
        cancelLabel="취소"
        onConfirm={handleConfirm}
        variant={dialogProps.variant}
        isLoading={isPending}
      />
    </>
  );
}

