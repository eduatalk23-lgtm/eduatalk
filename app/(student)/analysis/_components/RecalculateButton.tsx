"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { recalculateRiskIndex } from "../_actions";

export function RecalculateButton() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRecalculate = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await recalculateRiskIndex();
        if (result.success) {
          router.refresh();
        } else {
          setError(result.error ?? "재계산에 실패했습니다.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "재계산에 실패했습니다.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleRecalculate}
        disabled={isPending}
        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "재계산 중..." : "Risk Index 재계산"}
      </button>
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

