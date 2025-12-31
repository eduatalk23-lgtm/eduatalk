"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStudentPlan } from "@/lib/domains/plan";

type DeletePlanButtonProps = {
  planId: string;
};

export function DeletePlanButton({ planId }: DeletePlanButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("정말로 이 플랜을 삭제하시겠습니까?")) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteStudentPlan(planId);
        router.refresh();
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "플랜 삭제에 실패했습니다."
        );
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "삭제 중..." : "삭제"}
    </button>
  );
}

