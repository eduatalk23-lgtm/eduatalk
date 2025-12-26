"use client";

import { useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import type { CampTemplate } from "@/lib/domains/camp/types";

type CampSelectorProps = {
  camps: CampTemplate[];
  selectedCampIds: string[];
  onSelectionChange: (campId: string, selected: boolean) => void;
  onSelectAll: (selectAll: boolean) => void;
};

export function CampSelector({
  camps,
  selectedCampIds,
  onSelectionChange,
  onSelectAll,
}: CampSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredCamps = camps.filter((camp) =>
    camp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected = camps.length > 0 && selectedCampIds.length === camps.length;
  const someSelected = selectedCampIds.length > 0 && selectedCampIds.length < camps.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">캠프 선택</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {selectedCampIds.length}/{camps.length}개 선택
          </span>
          <button
            onClick={() => onSelectAll(!allSelected)}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {allSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="캠프 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* 캠프 목록 */}
      <div
        className={cn(
          "grid gap-2 transition-all",
          isExpanded ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {filteredCamps.slice(0, isExpanded ? undefined : 8).map((camp) => {
          const isSelected = selectedCampIds.includes(camp.id);
          return (
            <button
              key={camp.id}
              onClick={() => onSelectionChange(camp.id, !isSelected)}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3 text-left transition",
                isSelected
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded border transition",
                  isSelected
                    ? "border-indigo-500 bg-indigo-500"
                    : "border-gray-300 bg-white"
                )}
              >
                {isSelected && <Check className="h-3 w-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    isSelected ? "text-indigo-900" : "text-gray-900"
                  )}
                >
                  {camp.name}
                </p>
                {camp.camp_start_date && camp.camp_end_date && (
                  <p className="truncate text-xs text-gray-500">
                    {camp.camp_start_date} ~ {camp.camp_end_date}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 더보기 버튼 */}
      {filteredCamps.length > 8 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          {isExpanded ? (
            <>
              접기 <ChevronDown className="h-4 w-4 rotate-180" />
            </>
          ) : (
            <>
              {filteredCamps.length - 8}개 더보기 <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}

      {filteredCamps.length === 0 && (
        <p className="text-center text-sm text-gray-500 py-4">
          검색 결과가 없습니다.
        </p>
      )}
    </div>
  );
}
