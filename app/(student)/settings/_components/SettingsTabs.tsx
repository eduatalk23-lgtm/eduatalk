"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type Tab = "basic" | "exam" | "career";

type SettingsTabsProps = {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "basic", label: "기본 정보" },
    { id: "exam", label: "입시 정보" },
    { id: "career", label: "진로 정보" },
  ];

  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition",
              activeTab === tab.id
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

