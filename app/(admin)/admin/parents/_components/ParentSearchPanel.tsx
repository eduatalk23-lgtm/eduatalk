"use client";

import { Search, Loader2, UsersRound } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ParentSearchItem } from "@/lib/data/parents";

type ParentSearchPanelProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  parents: ParentSearchItem[];
  total: number;
  isLoading: boolean;
  selectedParentId: string | null;
  onSelectParent: (parentId: string) => void;
};

export function ParentSearchPanel({
  searchQuery,
  onSearchChange,
  parents,
  total,
  isLoading,
  selectedParentId,
  onSelectParent,
}: ParentSearchPanelProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="이름, 연락처, 이메일 검색"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* 검색결과 카운트 */}
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <UsersRound className="h-3.5 w-3.5" />
        <span>검색결과 {total}명</span>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {/* 학부모 리스트 */}
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[calc(100vh-280px)]">
        {parents.length === 0 && !isLoading && (
          <div className="py-8 text-center text-sm text-gray-400">
            {searchQuery ? "검색 결과가 없습니다" : "등록된 학부모가 없습니다"}
          </div>
        )}
        {parents.map((parent) => (
          <button
            key={parent.id}
            type="button"
            onClick={() => onSelectParent(parent.id)}
            className={cn(
              "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition",
              selectedParentId === parent.id
                ? "bg-indigo-50 ring-1 ring-indigo-200"
                : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    selectedParentId === parent.id
                      ? "text-indigo-700"
                      : "text-gray-900"
                  )}
                >
                  {parent.name ?? "이름 없음"}
                </span>
                {!parent.is_active && (
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                    비활성
                  </span>
                )}
              </span>
              {parent.linked_student_count > 0 && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  학생 {parent.linked_student_count}명
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {parent.phone && <span>{parent.phone}</span>}
              {parent.email && (
                <span className="max-w-[140px] truncate" title={parent.email}>
                  {parent.email}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
