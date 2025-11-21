"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";
import { updatePlanGroupStatus, checkPlansExistAction } from "@/app/(student)/actions/planGroupActions";
import { useToast } from "@/components/ui/ToastProvider";

type PlanGroupActivationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  activeGroupNames: string[];
};

export function PlanGroupActivationDialog({
  open,
  onOpenChange,
  groupId,
  activeGroupNames,
}: PlanGroupActivationDialogProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  const handleActivate = () => {
    startTransition(async () => {
      try {
        // 플랜이 실제로 생성되었는지 확인
        const checkResult = await checkPlansExistAction(groupId);
        if (!checkResult.hasPlans) {
          toast.showError("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
          return;
        }

        // 활성화 시 다른 활성 플랜 그룹들이 자동으로 비활성화됨
        await updatePlanGroupStatus(groupId, "active");
        toast.showSuccess(
          activeGroupNames.length > 0
            ? `플랜 그룹이 활성화되었습니다. ${activeGroupNames.length}개의 다른 플랜 그룹이 비활성화되었습니다.`
            : "플랜 그룹이 활성화되었습니다."
        );
        onOpenChange(false);
        router.refresh();
        // 활성화 후 플랜 그룹 상세 페이지로 이동
        router.push(`/plan/group/${groupId}`);
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "플랜 그룹 활성화에 실패했습니다."
        );
      }
    });
  };

  const handleCancel = () => {
    // 취소 시 saved 상태로 저장
    startTransition(async () => {
      try {
        await updatePlanGroupStatus(groupId, "saved");
        toast.showSuccess("플랜 그룹이 저장되었습니다.");
        onOpenChange(false);
        router.refresh();
        // 저장 후 플랜 그룹 상세 페이지로 이동
        router.push(`/plan/group/${groupId}`);
      } catch (error) {
        toast.showError(
          error instanceof Error
            ? error.message
            : "플랜 그룹 저장에 실패했습니다."
        );
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="플랜 그룹 활성화"
      description="이 플랜 그룹을 활성화하시겠습니까?"
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {activeGroupNames.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <p className="mb-2 text-sm font-medium text-yellow-800">
                현재 활성화된 플랜 그룹이 있습니다.
              </p>
              <p className="mb-3 text-sm text-yellow-700">
                이 플랜 그룹을 활성화하면 다음 플랜 그룹이 자동으로 비활성화됩니다:
              </p>
              <ul className="ml-4 list-disc space-y-1">
                {activeGroupNames.map((name, index) => (
                  <li key={index} className="text-sm text-yellow-700">
                    {name || "플랜 그룹"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-sm text-gray-600">
            한 번에 하나의 플랜 그룹만 활성화할 수 있습니다. 활성화하시겠습니까?
          </p>
        </div>
      </DialogContent>
      <DialogFooter>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "저장 중..." : "취소 (저장)"}
        </button>
        <button
          type="button"
          onClick={handleActivate}
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-lg border border-green-300 bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "활성화 중..." : "활성화"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

