"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

type PlanGroupActiveToggleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string | null;
  isActive: boolean;
  onConfirm: () => void;
  isPending: boolean;
};

export function PlanGroupActiveToggleDialog({
  open,
  onOpenChange,
  groupName,
  isActive,
  onConfirm,
  isPending,
}: PlanGroupActiveToggleDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={isActive ? "플랜 그룹 비활성화" : "플랜 그룹 활성화"}
      description={
        groupName
          ? `"${groupName}" 플랜 그룹을 ${isActive ? "비활성화" : "활성화"}하시겠습니까?`
          : `이 플랜 그룹을 ${isActive ? "비활성화" : "활성화"}하시겠습니까?`
      }
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {isActive ? (
            <p className="text-sm text-gray-700">
              플랜 그룹을 비활성화하면 일시정지 상태로 변경됩니다. 나중에 다시 활성화할 수 있습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-700">
                플랜 그룹을 활성화하면 현재 활성화된 다른 플랜 그룹이 자동으로 비활성화됩니다.
              </p>
              <p className="text-xs text-yellow-700">
                ⚠️ 한 번에 하나의 플랜 그룹만 활성화할 수 있습니다.
              </p>
            </div>
          )}
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
          onClick={onConfirm}
          disabled={isPending}
          className={`inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            isActive
              ? "border-orange-300 bg-orange-600 hover:bg-orange-700"
              : "border-green-300 bg-green-600 hover:bg-green-700"
          }`}
        >
          {isPending ? "처리 중..." : isActive ? "비활성화" : "활성화"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

