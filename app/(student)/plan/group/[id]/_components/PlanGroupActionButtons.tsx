"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Copy, Trash2 } from "lucide-react";
import { PlanStatus } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { deletePlanGroupAction, copyPlanGroupAction } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";
import { PlanGroupDeleteDialog } from "@/app/(student)/plan/_components/PlanGroupDeleteDialog";

type PlanGroupActionButtonsProps = {
  groupId: string;
  groupName: string | null;
  groupStatus: PlanStatus;
  canEdit: boolean;
  canDelete: boolean;
};

export function PlanGroupActionButtons({
  groupId,
  groupName,
  groupStatus,
  canEdit,
  canDelete,
}: PlanGroupActionButtonsProps) {
  const router = useRouter();
  const toast = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleCopy = () => {
    if (
      !confirm(
        "플랜 그룹을 복사하시겠습니까? 복사된 플랜 그룹은 초안 상태로 생성되며, 플랜은 복사되지 않습니다."
      )
    ) {
      return;
    }

    setCopyPending(true);
    startTransition(async () => {
      try {
        const result = await copyPlanGroupAction(groupId);
        toast.showSuccess("플랜 그룹이 복사되었습니다.");
        router.push(`/plan/group/${result.groupId}/edit`);
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "플랜 그룹 복사에 실패했습니다."
        );
        setCopyPending(false);
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {canEdit && (
          <Link
            href={`/plan/group/${groupId}/edit`}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            title="수정"
            aria-label="플랜 그룹 수정"
          >
            <Pencil className="h-4 w-4" />
          </Link>
        )}

        <button
          type="button"
          onClick={handleCopy}
          disabled={copyPending || isPending}
          className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="복사하기"
          aria-label="플랜 그룹 복사하기"
        >
          <Copy className="h-4 w-4" />
        </button>

        {canDelete && (
          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
            title="삭제"
            aria-label="플랜 그룹 삭제"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <PlanGroupDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        groupId={groupId}
        groupName={groupName}
        groupStatus={groupStatus}
      />
    </>
  );
}

