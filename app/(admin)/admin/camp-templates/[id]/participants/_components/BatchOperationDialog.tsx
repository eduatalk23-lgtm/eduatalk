"use client";

import { Dialog } from "@/components/ui/Dialog";

type BatchOperationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operationType: "activate" | "status_change";
  participantCount: number;
  status?: string;
  onConfirm: () => void;
  isPending?: boolean;
};

export function BatchOperationDialog({
  open,
  onOpenChange,
  operationType,
  participantCount,
  status,
  onConfirm,
  isPending = false,
}: BatchOperationDialogProps) {
  const getTitle = () => {
    if (operationType === "activate") {
      return "플랜 그룹 일괄 활성화";
    }
    return "플랜 그룹 상태 일괄 변경";
  };

  const getDescription = () => {
    if (operationType === "activate") {
      return `${participantCount}명의 참여자 플랜 그룹을 활성화하시겠습니까? 활성화된 플랜 그룹의 학생들은 학습을 시작할 수 있습니다.`;
    }
    
    const statusLabels: Record<string, string> = {
      active: "활성",
      saved: "저장됨",
      paused: "일시정지",
      completed: "완료",
      cancelled: "취소",
    };
    
    const statusLabel = status ? statusLabels[status] || status : "해당 상태";
    return `${participantCount}명의 참여자 플랜 그룹 상태를 "${statusLabel}"로 변경하시겠습니까?`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-900">{getTitle()}</h2>
        <p className="mt-2 text-sm text-gray-700">{getDescription()}</p>
        
        <div className="mt-6 flex justify-end gap-3">
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
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "처리 중..." : "확인"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}





