"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePlanGroupAction } from "@/app/(student)/actions/planGroupActions";

type PlanGroupDeleteButtonProps = {
  groupId: string;
};

export function PlanGroupDeleteButton({ groupId }: PlanGroupDeleteButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (
      !confirm(
        "플랜 그룹을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        await deletePlanGroupAction(groupId);
        router.push("/plan", { scroll: true });
      } catch (error) {
        alert(
          error instanceof Error ? error.message : "플랜 그룹 삭제에 실패했습니다."
        );
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "삭제 중..." : "삭제"}
    </button>
  );
}

