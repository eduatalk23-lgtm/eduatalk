"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export type ScoreSubTab = "analysis" | "list" | "input";

const SUB_TABS: { key: ScoreSubTab; label: string }[] = [
  { key: "analysis", label: "성적 분석" },
  { key: "list", label: "성적 조회" },
  { key: "input", label: "성적 입력" },
];

export function ScoreSubTabNav({ activeSubTab }: { activeSubTab: ScoreSubTab }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleSubTabChange = (subTab: ScoreSubTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "score");
    params.set("scoreSubTab", subTab);
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex gap-2">
      {SUB_TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => handleSubTabChange(tab.key)}
          disabled={isPending}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            activeSubTab === tab.key
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          } disabled:opacity-50`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
