"use client";

import { useState } from "react";
import { CurriculumRevisionsManager } from "./CurriculumRevisionsManager";
import { GradesManager } from "./GradesManager";
import { SemestersManager } from "./SemestersManager";
import { SubjectCategoriesManager } from "./SubjectCategoriesManager";
import { SubjectsManager } from "./SubjectsManager";
import { PlatformsManager } from "./PlatformsManager";
import { PublishersManager } from "./PublishersManager";

type TabKey = "revisions" | "grades" | "semesters" | "subject-categories" | "subjects" | "platforms" | "publishers";

export function ContentMetadataTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>("revisions");

  const tabs = [
    { key: "revisions" as TabKey, label: "개정교육과정" },
    { key: "grades" as TabKey, label: "학년" },
    { key: "semesters" as TabKey, label: "학기" },
    { key: "subject-categories" as TabKey, label: "교과" },
    { key: "subjects" as TabKey, label: "과목" },
    { key: "platforms" as TabKey, label: "플랫폼" },
    { key: "publishers" as TabKey, label: "출판사" },
  ];

  return (
    <div>
      {/* 탭 네비게이션 */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
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
        {activeTab === "revisions" && <CurriculumRevisionsManager />}
        {activeTab === "grades" && <GradesManager />}
        {activeTab === "semesters" && <SemestersManager />}
        {activeTab === "subject-categories" && <SubjectCategoriesManager />}
        {activeTab === "subjects" && <SubjectsManager />}
        {activeTab === "platforms" && <PlatformsManager />}
        {activeTab === "publishers" && <PublishersManager />}
      </div>
    </div>
  );
}

