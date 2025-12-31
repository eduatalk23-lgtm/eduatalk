"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlanGroupStatus, checkPlansExistAction } from "@/lib/domains/plan";
import { PlanStatus } from "@/lib/types/plan";
import { PlanStatusManager } from "@/lib/plan/statusManager";
import { cn } from "@/lib/cn";

type PlanGroupStatusButtonsProps = {
  groupId: string;
  currentStatus: PlanStatus;
  canEdit: boolean;
};

// 상태별 버튼 라벨 (현재 상태에서 전이 가능한 상태의 라벨)
const getStatusButtonLabel = (fromStatus: PlanStatus, toStatus: PlanStatus): string => {
  const labels: Record<string, string> = {
    "draft->saved": "저장",
    "draft->paused": "중단", // 일시정지로 통합
    "saved->active": "활성화",
    "saved->draft": "초안으로 변경", // 저장된 플랜을 다시 수정 가능한 초안 상태로 되돌림
    "saved->paused": "중단", // 일시정지로 통합
    "active->paused": "일시정지",
    "active->completed": "완료",
    "paused->active": "재개",
    "cancelled->active": "재개", // 기존 데이터 호환성
  };
  
  return labels[`${fromStatus}->${toStatus}`] || toStatus;
};

export function PlanGroupStatusButtons({
  groupId,
  currentStatus,
  canEdit,
}: PlanGroupStatusButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const availableTransitions = PlanStatusManager.getAvailableTransitions(currentStatus);

  const handleStatusChange = (newStatus: PlanStatus) => {
    // 상태 전이는 canEdit과 무관하게 가능 (상태 전이 규칙만 확인)
    if (!PlanStatusManager.canTransition(currentStatus, newStatus)) {
      alert("이 상태로 전이할 수 없습니다.");
      return;
    }

    const buttonLabel = getStatusButtonLabel(currentStatus, newStatus);
    if (
      !confirm(
        `플랜 그룹 상태를 "${buttonLabel}"로 변경하시겠습니까?`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        // 활성화 시 플랜이 생성되었는지 확인
        if (newStatus === "active") {
          const checkResult = await checkPlansExistAction(groupId);
          if (!checkResult.hasPlans) {
            alert("플랜이 생성되지 않았습니다. 플랜을 먼저 생성해주세요.");
            return;
          }
        }

        await updatePlanGroupStatus(groupId, newStatus);
        router.refresh();
        // 활성화 성공 시 플랜 그룹 상세 페이지로 리다이렉트
        if (newStatus === "active") {
          router.push(`/plan/group/${groupId}`, { scroll: true });
        }
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "상태 변경에 실패했습니다."
        );
      }
    });
  };

  if (availableTransitions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-4">
        <p className="text-sm text-gray-800 dark:text-gray-200">
          현재 상태에서는 상태 변경이 불가능합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {availableTransitions.map((status) => {
        const buttonLabel = getStatusButtonLabel(currentStatus, status);
        const isDestructive = status === "cancelled";
        
        return (
          <button
            key={status}
            type="button"
            onClick={() => handleStatusChange(status)}
            disabled={isPending}
            className={cn(
              "inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
              isDestructive
                ? "border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
                : status === "active"
                ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40"
                : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            )}
          >
            {isPending ? "처리 중..." : buttonLabel}
          </button>
        );
      })}
    </div>
  );
}

