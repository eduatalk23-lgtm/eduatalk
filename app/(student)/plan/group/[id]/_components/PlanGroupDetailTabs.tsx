"use client";

import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

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
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex flex-wrap gap-2 pb-px" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              group relative inline-flex items-center gap-2 rounded-t-lg border-b-2 px-3 py-3 text-sm font-semibold transition-all
              ${
                currentTab === tab.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
              }
            `}
          >
            {tab.completed ? (
              <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${
                currentTab === tab.id ? "text-blue-600" : "text-green-500"
              }`} />
            ) : (
              <Circle className={`h-4 w-4 flex-shrink-0 ${
                currentTab === tab.id ? "text-blue-600" : "text-gray-400"
              }`} />
            )}
            <span className="whitespace-nowrap">{tab.label}</span>
            {currentTab === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

