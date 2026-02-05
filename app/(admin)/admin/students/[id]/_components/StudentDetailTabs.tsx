"use client";

import React from "react";
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
  | "time";

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
];

export function StudentDetailTabs({
  defaultTab = "basic",
  children,
}: {
  defaultTab?: TabKey;
  children: React.ReactNode;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL에서 직접 탭 값을 읽어서 사용 (상태 동기화 불필요)
  const activeTab = (searchParams.get("tab") as TabKey) || defaultTab;

  const handleTabChange = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`, { scroll: false });
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

      {/* 탭 컨텐츠 */}
      <div>
        {React.Children.map(children, (child) => {
          if (
            React.isValidElement(child) &&
            typeof child.props === "object" &&
            child.props !== null &&
            "tab" in child.props &&
            (child.props as { tab?: TabKey }).tab === activeTab
          ) {
            return child;
          }
          return null;
        })}
      </div>
    </div>
  );
}

