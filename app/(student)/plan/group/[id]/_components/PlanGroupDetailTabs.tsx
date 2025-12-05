"use client";

import { KeyboardEvent } from "react";

type Tab = {
  id: number;
  label: string;
  completed: boolean;
};

type PlanGroupDetailTabsProps = {
  currentTab: number;
  onTabChange: (tab: number) => void;
  tabs: Tab[];
};

export function PlanGroupDetailTabs({
  currentTab,
  onTabChange,
  tabs,
}: PlanGroupDetailTabsProps) {
  // 키보드 네비게이션 핸들러
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, tabId: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onTabChange(tabId);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === currentTab);
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
      onTabChange(tabs[prevIndex].id);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const currentIndex = tabs.findIndex((t) => t.id === currentTab);
      const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
      onTabChange(tabs[nextIndex].id);
    } else if (e.key === "Home") {
      e.preventDefault();
      onTabChange(tabs[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      onTabChange(tabs[tabs.length - 1].id);
    }
  };

  return (
    <div className="border-b border-gray-200">
      <nav
        className="-mb-px flex flex-wrap gap-2 pb-px"
        aria-label="플랜 그룹 상세 정보 탭"
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={currentTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={currentTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, tab.id)}
            className={`
              group relative inline-flex items-center rounded-t-lg border-b-2 px-3 py-3 text-sm font-semibold transition-all
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${
                currentTab === tab.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-transparent text-gray-800 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
              }
            `}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.completed && currentTab !== tab.id && (
              <span className="sr-only">완료됨</span>
            )}
            {currentTab === tab.id && (
              <>
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                <span className="sr-only">선택된 탭</span>
              </>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

