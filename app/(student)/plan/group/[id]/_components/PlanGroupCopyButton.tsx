"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { copyPlanGroupAction } from "@/lib/domains/plan";

type PlanGroupCopyButtonProps = {
  groupId: string;
};

export function PlanGroupCopyButton({ groupId }: PlanGroupCopyButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCopy = () => {
    if (
      !confirm(
        "플랜 그룹을 복사하시겠습니까? 복사된 플랜 그룹은 초안 상태로 생성되며, 플랜은 복사되지 않습니다."
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const result = await copyPlanGroupAction(groupId);
        router.push(`/plan/group/${result.groupId}/edit`, { scroll: true });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "플랜 그룹 복사에 실패했습니다."
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Copy className="h-4 w-4" />
        {isPending ? "복사 중..." : "복사하기"}
      </button>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

