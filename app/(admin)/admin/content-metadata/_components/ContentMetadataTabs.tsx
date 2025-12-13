"use client";

import { useState } from "react";
import { CurriculumHierarchyManager } from "./CurriculumHierarchyManager";
import { PlatformsManager } from "./PlatformsManager";
import { PublishersManager } from "./PublishersManager";
import { CareerFieldsManager } from "./CareerFieldsManager";

type TabKey = "hierarchy" | "platforms" | "publishers" | "career-fields";

export function ContentMetadataTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("hierarchy");

  const tabs = [
    { key: "hierarchy" as TabKey, label: "교육과정 계층" },
    { key: "platforms" as TabKey, label: "플랫폼" },
    { key: "publishers" as TabKey, label: "출판사" },
    { key: "career-fields" as TabKey, label: "진로 계열" },
  ];

  return (
    <div>
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="mt-6">
        {activeTab === "hierarchy" && <CurriculumHierarchyManager />}
        {activeTab === "platforms" && <PlatformsManager />}
        {activeTab === "publishers" && <PublishersManager />}
        {activeTab === "career-fields" && <CareerFieldsManager />}
      </div>
    </div>
  );
}

