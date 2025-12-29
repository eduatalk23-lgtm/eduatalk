"use client";

import { Dialog, DialogContent, DialogFooter } from "@/components/ui/Dialog";

type PlanGroupActiveToggleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string | null;
  isActive: boolean;
  /** 완료된 상태인지 여부 */
  isCompleted?: boolean;
  onConfirm: () => void;
  isPending: boolean;
  /** 현재 활성화된 다른 플랜 그룹 정보 */
  currentActiveGroup?: { id: string; name: string | null } | null;
};

export function PlanGroupActiveToggleDialog({
  open,
  onOpenChange,
  groupName,
  isActive,
  isCompleted = false,
  onConfirm,
  isPending,
  currentActiveGroup,
}: PlanGroupActiveToggleDialogProps) {
  // 제목과 설명 결정
  const dialogTitle = isActive
    ? "플랜 그룹 비활성화"
    : isCompleted
      ? "완료된 플랜 그룹 재개"
      : "플랜 그룹 활성화";

  const dialogDescription = groupName
    ? `"${groupName}" 플랜 그룹을 ${isActive ? "비활성화" : isCompleted ? "재개" : "활성화"}하시겠습니까?`
    : `이 플랜 그룹을 ${isActive ? "비활성화" : isCompleted ? "재개" : "활성화"}하시겠습니까?`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={dialogTitle}
      description={dialogDescription}
    >
      <DialogContent>
        <div className="flex flex-col gap-4">
          {isActive ? (
            <p className="text-sm text-gray-700">
              플랜 그룹을 비활성화하면 일시정지 상태로 변경됩니다. 나중에 다시 활성화할 수 있습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {/* 완료된 플랜 재개 안내 */}
              {isCompleted && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm text-green-800">
                    완료된 플랜 그룹을 다시 활성화하면 이전에 완료한 플랜들을 계속 진행하거나 복습할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 현재 활성화된 그룹이 있는 경우 */}
              {currentActiveGroup && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">
                    현재 활성화된 플랜 그룹:
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-800">
                    &quot;{currentActiveGroup.name || "이름 없는 플랜 그룹"}&quot;
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-700">
                {currentActiveGroup
                  ? `이 플랜 그룹을 ${isCompleted ? "재개" : "활성화"}하면 "${currentActiveGroup.name || "현재 플랜"}"이(가) 자동으로 일시정지됩니다.`
                  : `플랜 그룹을 ${isCompleted ? "재개" : "활성화"}하면 현재 활성화된 다른 플랜 그룹이 자동으로 비활성화됩니다.`
                }
              </p>

              <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3">
                <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-blue-800">
                  한 번에 하나의 플랜 그룹만 활성화할 수 있습니다. 이는 학습에 집중하기 위한 정책입니다.
                </p>
              </div>
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
          {isPending ? "처리 중..." : isActive ? "비활성화" : isCompleted ? "재개" : "활성화"}
        </button>
      </DialogFooter>
    </Dialog>
  );
}

