"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useAdminPlanBasic } from "../../../context/AdminPlanContext";
import { MemoList } from "./MemoList";

type MemoTab = "student" | "admin";

export function MemoPanelApp() {
  const { studentId, isAdminMode } = useAdminPlanBasic();
  const [activeTab, setActiveTab] = useState<MemoTab>("student");
  const [searchQuery, setSearchQuery] = useState("");

  if (!studentId) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-[var(--color-text-tertiary)]">
        학생을 선택해주세요
      </div>
    );
  }

  // 탭 라벨: 관리자 → "학생 메모 / 관리자 메모", 학생 → "내 메모 / 선생님 메모"
  const tabLabels = isAdminMode
    ? { student: "학생 메모", admin: "관리자 메모" }
    : { student: "내 메모", admin: "선생님 메모" };

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-2 flex-shrink-0">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="메모 검색..."
            className="w-full text-xs bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-md pl-7 pr-7 py-1.5 outline-none placeholder:text-[var(--color-text-tertiary)] focus:border-[rgb(var(--color-primary-400))]"
            style={{ color: 'var(--color-text-primary)', caretColor: 'var(--color-text-primary)' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-4 flex-shrink-0">
        <TabButton
          label={tabLabels.student}
          isActive={activeTab === "student"}
          onClick={() => setActiveTab("student")}
        />
        <TabButton
          label={tabLabels.admin}
          isActive={activeTab === "admin"}
          onClick={() => setActiveTab("admin")}
        />
      </div>

      {/* Memo List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <MemoList
          studentId={studentId}
          authorRole={activeTab}
          searchQuery={searchQuery}
          isAdminMode={isAdminMode}
        />
      </div>
    </div>
  );
}

function TabButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2.5 text-xs font-medium transition-colors relative",
        isActive
          ? "text-[rgb(var(--color-primary-700))]"
          : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
      )}
    >
      {label}
      {isActive && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary-600))]" />
      )}
    </button>
  );
}
