"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { deletePlanGroupAction } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";

type PlanGroupBulkDeleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupIds: string[];
  groupNames: (string | null)[];
};

export function PlanGroupBulkDeleteDialog({
  open,
  onOpenChange,
  groupIds,
  groupNames,
}: PlanGroupBulkDeleteDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (groupIds.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        // 여러 플랜 그룹을 순차적으로 삭제
        const results = await Promise.allSettled(
          groupIds.map((id) => deletePlanGroupAction(id))
        );

        const successCount = results.filter((r) => r.status === "fulfilled").length;
        const failureCount = results.filter((r) => r.status === "rejected").length;

        if (failureCount === 0) {
          toast.showSuccess(`${successCount}개의 플랜 그룹이 삭제되었습니다.`);
        } else if (successCount > 0) {
          toast.showInfo(`${successCount}개는 삭제되었고, ${failureCount}개는 삭제에 실패했습니다.`);
        } else {
          toast.showError("플랜 그룹 삭제에 실패했습니다.");
        }

        onOpenChange(false);
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
      title="플랜 그룹 다중 삭제"
      description={`${groupIds.length}개의 플랜 그룹을 삭제하시겠습니까?`}
      variant="destructive"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600">
            선택한 플랜 그룹을 모두 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
          </p>
          
          {groupNames.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
              <ul className="flex flex-col gap-1">
                {groupNames.map((name, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {name || "플랜 그룹"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-red-600">
            ⚠️ 플랜 그룹과 관련된 모든 플랜이 함께 삭제됩니다.
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
          disabled={isPending || groupIds.length === 0}
          className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "삭제 중..." : `${groupIds.length}개 삭제`}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

