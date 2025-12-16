"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { PlatformsManager } from "./PlatformsManager";
import { PublishersManager } from "./PublishersManager";
import { CareerFieldsManager } from "./CareerFieldsManager";
import { DifficultyLevelsManager } from "./DifficultyLevelsManager";

type TabKey = "platforms" | "publishers" | "career-fields" | "difficulty-levels";

const DEFAULT_TAB: TabKey = "platforms";

export function ContentMetadataTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabKey) || DEFAULT_TAB;

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "platforms", label: "플랫폼" },
    { key: "publishers", label: "출판사" },
    { key: "career-fields", label: "진로 계열" },
    { key: "difficulty-levels", label: "난이도" },
  ];

  function handleTabChange(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div>
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
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* 탭 컨텐츠 */}
      <div className="mt-6">
        {activeTab === "platforms" && <PlatformsManager />}
        {activeTab === "publishers" && <PublishersManager />}
        {activeTab === "career-fields" && <CareerFieldsManager />}
        {activeTab === "difficulty-levels" && <DifficultyLevelsManager />}
      </div>
    </div>
  );
}

