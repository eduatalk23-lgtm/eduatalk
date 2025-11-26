"use client";

import { useState } from "react";
import RegionFilter from "./RegionFilter";

type SchoolFilterPanelProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  regionId: string | null;
  onRegionChange: (regionId: string | null) => void;
  category?: string | null;
  onCategoryChange?: (category: string | null) => void;
  universityType?: string | null;
  onUniversityTypeChange?: (type: string | null) => void;
  universityOwnership?: string | null;
  onUniversityOwnershipChange?: (ownership: string | null) => void;
  schoolType: "중학교" | "고등학교" | "대학교";
  onReset: () => void;
};

export default function SchoolFilterPanel({
  searchQuery,
  onSearchChange,
  regionId,
  onRegionChange,
  category,
  onCategoryChange,
  universityType,
  onUniversityTypeChange,
  universityOwnership,
  onUniversityOwnershipChange,
  schoolType,
  onReset,
}: SchoolFilterPanelProps) {
  const hasActiveFilters =
    searchQuery ||
    regionId ||
    category ||
    universityType ||
    universityOwnership;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4">
        {/* 검색 및 필터 행 */}
        <div className="flex flex-wrap items-end gap-4">
          {/* 학교명 검색 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              학교명 검색
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="학교명 입력"
              className="w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* 지역 필터 */}
          <RegionFilter value={regionId} onChange={onRegionChange} />

          {/* 고등학교 유형 필터 */}
          {schoolType === "고등학교" && onCategoryChange && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                고등학교 유형
              </label>
              <select
                value={category || ""}
                onChange={(e) =>
                  onCategoryChange(e.target.value || null)
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="일반고">일반고</option>
                <option value="특목고">특목고</option>
                <option value="자사고">자사고</option>
                <option value="특성화고">특성화고</option>
              </select>
            </div>
          )}

          {/* 대학교 유형 필터 */}
          {schoolType === "대학교" && onUniversityTypeChange && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                대학교 유형
              </label>
              <select
                value={universityType || ""}
                onChange={(e) =>
                  onUniversityTypeChange(e.target.value || null)
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="4년제">4년제</option>
                <option value="2년제">2년제</option>
              </select>
            </div>
          )}

          {/* 대학교 설립 유형 필터 */}
          {schoolType === "대학교" && onUniversityOwnershipChange && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-700">
                설립 유형
              </label>
              <select
                value={universityOwnership || ""}
                onChange={(e) =>
                  onUniversityOwnershipChange(e.target.value || null)
                }
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">전체</option>
                <option value="국립">국립</option>
                <option value="사립">사립</option>
              </select>
            </div>
          )}

          {/* 초기화 버튼 */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              초기화
            </button>
          )}
        </div>

        {/* 활성 필터 배지 */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {searchQuery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                검색: {searchQuery}
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  ×
                </button>
              </span>
            )}
            {category && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                유형: {category}
                <button
                  type="button"
                  onClick={() => onCategoryChange?.(null)}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  ×
                </button>
              </span>
            )}
            {universityType && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                유형: {universityType}
                <button
                  type="button"
                  onClick={() => onUniversityTypeChange?.(null)}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  ×
                </button>
              </span>
            )}
            {universityOwnership && (
              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800">
                설립: {universityOwnership}
                <button
                  type="button"
                  onClick={() => onUniversityOwnershipChange?.(null)}
                  className="ml-1 text-indigo-600 hover:text-indigo-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}









