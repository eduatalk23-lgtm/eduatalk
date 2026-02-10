"use client";

import { useTransition } from "react";
import type { ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type TabKey =
  | "basic"
  | "plan"
  | "content"
  | "score"
  | "session"
  | "analysis"
  | "consulting"
  | "attendance"
  | "time"
  | "risk";

type Tab = {
  key: TabKey;
  label: string;
  icon: string;
};

const tabs: Tab[] = [
  { key: "basic", label: "기본정보", icon: "👤" },
  { key: "plan", label: "학습계획", icon: "📅" },
  { key: "content", label: "콘텐츠", icon: "📚" },
  { key: "score", label: "성적", icon: "📊" },
  { key: "session", label: "학습기록", icon: "⏱️" },
  { key: "analysis", label: "분석 리포트", icon: "📈" },
  { key: "consulting", label: "상담노트", icon: "📝" },
  { key: "attendance", label: "출석", icon: "✓" },
  { key: "time", label: "시간관리", icon: "⏰" },
  { key: "risk", label: "위험도/추천", icon: "⚠️" },
];

export function StudentDetailTabs({
  defaultTab = "basic",
  children,
}: {
  defaultTab?: TabKey;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // URL에서 직접 탭 값을 읽어서 사용 (상태 동기화 불필요)
  const activeTab = (searchParams.get("tab") as TabKey) || defaultTab;

  const handleTabChange = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <span className="pr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 - 서버에서 활성 탭만 렌더링됨 */}
      {isPending ? (
        <div className="space-y-4">
          <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

