"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { deletePlanGroupAction } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { PlanStatus } from "@/lib/types/plan";

type PlanGroupDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string | null;
  groupStatus?: PlanStatus;
};

export function PlanGroupDeleteDialog({
  open,
  onOpenChange,
  groupId,
  groupName,
  groupStatus,
}: PlanGroupDeleteDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const canDelete = groupStatus
    ? PlanStatusManager.canDelete(groupStatus)
    : true; // 상태 정보가 없으면 시도 (서버에서 체크)

  const handleDelete = () => {
    if (!canDelete && groupStatus) {
      toast.showError(
        `${PlanStatusManager.getConstraints(groupStatus).description}에서는 삭제할 수 없습니다.`
      );
      onOpenChange(false);
      return;
    }

    startTransition(async () => {
      try {
        await deletePlanGroupAction(groupId);
        toast.showSuccess("플랜 그룹이 삭제되었습니다.");
        onOpenChange(false);
        // 삭제 후 목록 페이지로 이동 및 새로고침
        router.push("/plan");
        router.refresh();
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "플랜 그룹 삭제에 실패했습니다."
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="플랜 그룹 삭제"
      description={
        groupName
          ? `"${groupName}" 플랜 그룹을 삭제하시겠습니까?`
          : "이 플랜 그룹을 삭제하시겠습니까?"
      }
      variant="destructive"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {!canDelete && groupStatus && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <p className="text-sm font-medium text-yellow-800">
                현재 상태에서는 삭제할 수 없습니다.
              </p>
              <p className="mt-1 text-xs text-yellow-700">
                {PlanStatusManager.getConstraints(groupStatus).description}
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600">
            이 작업은 되돌릴 수 없습니다. 플랜 그룹과 관련된 모든 플랜이 함께
            삭제됩니다.
          </p>
        </div>
      </DialogContent>
      <DialogFooter>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending || !canDelete}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "삭제 중..." : "삭제"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

