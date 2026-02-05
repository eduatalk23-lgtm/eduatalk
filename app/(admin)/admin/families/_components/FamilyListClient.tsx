"use client";

import { useState } from "react";
import Link from "next/link";
import type { FamilyListItem } from "@/lib/domains/family";
import { FamilyCard } from "./FamilyCard";

type Props = {
  initialFamilies: FamilyListItem[];
};

export function FamilyListClient({ initialFamilies }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "with-students" | "with-parents" | "empty">("all");

  const filteredFamilies = initialFamilies.filter((family) => {
    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameMatch = family.familyName?.toLowerCase().includes(query);
      const contactMatch = family.primaryContactName?.toLowerCase().includes(query);
      if (!nameMatch && !contactMatch) return false;
    }

    // 상태 필터
    switch (filter) {
      case "with-students":
        return family.studentCount > 0;
      case "with-parents":
        return family.parentCount > 0;
      case "empty":
        return family.studentCount === 0 && family.parentCount === 0;
      default:
        return true;
    }
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="가족 이름 또는 연락처 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pl-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:w-80"
          />
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { value: "all", label: "전체" },
            { value: "with-students", label: "학생 있음" },
            { value: "with-parents", label: "학부모 있음" },
            { value: "empty", label: "빈 가족" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as typeof filter)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                filter === tab.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Family Grid */}
      {filteredFamilies.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFamilies.map((family) => (
            <Link key={family.id} href={`/admin/families/${family.id}`}>
              <FamilyCard family={family} />
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-900/50">
          <svg
            className="mb-4 h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">
            {searchQuery || filter !== "all"
              ? "조건에 맞는 가족이 없습니다"
              : "등록된 가족이 없습니다"}
          </p>
          {!searchQuery && filter === "all" && (
            <Link
              href="/admin/families/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              첫 번째 가족 만들기
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
