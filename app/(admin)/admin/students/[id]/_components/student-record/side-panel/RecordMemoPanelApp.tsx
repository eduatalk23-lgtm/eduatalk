"use client";

// ============================================
// 생기부 전용 메모 패널 앱
// MemoPanelApp에서 AdminPlanContext 의존을 제거하고 studentId를 prop으로 받음
// ============================================

import { useState } from "react";
import { cn } from "@/lib/cn";
import { MemoList } from "@/app/(admin)/admin/students/[id]/plans/_components/side-panel/apps/memo/MemoList";

type Tab = "student" | "admin";

export function RecordMemoPanelApp({ studentId }: { studentId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>("admin");
  const [searchQuery, setSearchQuery] = useState("");

  if (!studentId) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-[var(--text-tertiary)]">
        학생을 선택해주세요
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 탭 */}
      <div className="flex border-b border-[rgb(var(--color-secondary-200))] px-4">
        {([
          { id: "admin" as Tab, label: "컨설턴트 메모" },
          { id: "student" as Tab, label: "학생 메모" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.id
                ? "border-[rgb(var(--color-primary-600))] text-[rgb(var(--color-primary-700))]"
                : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="px-4 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="메모 검색..."
          className="w-full rounded-md border border-[rgb(var(--color-secondary-200))] bg-[var(--background)] px-3 py-1.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[rgb(var(--color-primary-400))] focus:outline-none"
        />
      </div>

      {/* 메모 목록 */}
      <div className="flex-1 overflow-y-auto">
        <MemoList
          studentId={studentId}
          authorRole={activeTab}
          searchQuery={searchQuery}
          isAdminMode={true}
        />
      </div>
    </div>
  );
}
