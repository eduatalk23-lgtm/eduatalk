"use client";

import React, { useState, useMemo } from "react";
import { Search, BookOpen, Video, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * ContentSelector - 콘텐츠 선택기
 * 
 * 학생의 교재/강의/커스텀 콘텐츠 선택
 */

type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  master_content_id?: string | null;
  subject?: string | null;
  subject_group_name?: string | null;
  curriculum_revision_name?: string | null;
  semester?: string | null;
  revision?: string | null;
  difficulty_level?: string | null;
  publisher?: string | null;
  platform?: string | null;
};

type ContentSelectorProps = {
  // 콘텐츠 목록
  books: ContentItem[];
  lectures: ContentItem[];
  custom: ContentItem[];
  
  // 이미 선택된 ID
  selectedIds: Set<string>;
  
  // 선택 핸들러
  onSelect: (contentId: string, type: "book" | "lecture" | "custom") => void;
  
  // 상태
  disabled?: boolean;
  maxReached?: boolean;
};

export const ContentSelector = React.memo(function ContentSelector({
  books,
  lectures,
  custom,
  selectedIds,
  onSelect,
  disabled = false,
  maxReached = false,
}: ContentSelectorProps) {
  const [activeTab, setActiveTab] = useState<"book" | "lecture" | "custom">("book");
  const [searchQuery, setSearchQuery] = useState("");

  // 필터링된 콘텐츠
  const filteredContents = useMemo(() => {
    const currentList =
      activeTab === "book"
        ? books
        : activeTab === "lecture"
        ? lectures
        : custom;

    if (!searchQuery.trim()) return currentList;

    const query = searchQuery.toLowerCase();
    return currentList.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.curriculum_revision_name?.toLowerCase().includes(query) ||
        item.subject_group_name?.toLowerCase().includes(query) ||
        item.subject?.toLowerCase().includes(query)
    );
  }, [activeTab, books, lectures, custom, searchQuery]);

  // 선택 가능한 콘텐츠 (이미 선택된 것 제외)
  const availableContents = useMemo(() => {
    return filteredContents.filter((item) => !selectedIds.has(item.id));
  }, [filteredContents, selectedIds]);

  // 탭별 개수
  const tabCounts = useMemo(() => {
    return {
      book: books.filter((b) => !selectedIds.has(b.id)).length,
      lecture: lectures.filter((l) => !selectedIds.has(l.id)).length,
      custom: custom.filter((c) => !selectedIds.has(c.id)).length,
    };
  }, [books, lectures, custom, selectedIds]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex flex-col gap-4">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            콘텐츠 추가
          </h3>
          {maxReached && (
            <span className="text-sm font-medium text-red-600">
              최대 개수 도달
            </span>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("book")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "book"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <BookOpen className="h-4 w-4" />
          <span>교재</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "book"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-600"
            )}
          >
            {tabCounts.book}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("lecture")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "lecture"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <Video className="h-4 w-4" />
          <span>강의</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "lecture"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-600"
            )}
          >
            {tabCounts.lecture}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            activeTab === "custom"
              ? "bg-gray-600 text-white"
              : "bg-gray-100 text-gray-800 hover:bg-gray-200",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <FileText className="h-4 w-4" />
          <span>커스텀</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              activeTab === "custom"
                ? "bg-blue-500 text-white"
                : "bg-gray-200 text-gray-600"
            )}
          >
            {tabCounts.custom}
          </span>
        </button>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="콘텐츠 검색..."
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-500 transition-colors",
            "focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500",
            disabled && "cursor-not-allowed bg-gray-50 opacity-50"
          )}
        />
      </div>

      {/* 콘텐츠 목록 */}
      <div className="flex flex-col gap-4 max-h-96 overflow-y-auto">
        {availableContents.length === 0 ? (
          <div className="flex flex-col gap-1 items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-3">
              {activeTab === "book" ? (
                <BookOpen className="h-6 w-6 text-gray-400" />
              ) : activeTab === "lecture" ? (
                <Video className="h-6 w-6 text-gray-400" />
              ) : (
                <Plus className="h-6 w-6 text-gray-400" />
              )}
            </div>
            <p className="text-sm font-medium text-gray-900">
              {searchQuery
                ? "검색 결과가 없습니다"
                : "선택 가능한 콘텐츠가 없습니다"}
            </p>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? "다른 검색어를 시도해보세요"
                : "모든 콘텐츠가 이미 선택되었습니다"}
            </p>
          </div>
        ) : (
          availableContents.map((item) => {
            // 메타데이터가 있는지 확인 (ContentCard와 동일한 기준)
            const hasMetadata = 
              activeTab === "custom" || 
              !!item.subject_group_name || 
              !!item.subject || 
              !!item.curriculum_revision_name ||
              !!item.semester ||
              !!item.revision ||
              !!item.difficulty_level ||
              !!item.publisher ||
              !!item.platform;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id, activeTab)}
                disabled={disabled || maxReached}
                className={cn(
                  "w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition-all hover:border-blue-500 hover:bg-blue-50",
                  (disabled || maxReached) &&
                    "cursor-not-allowed opacity-50 hover:border-gray-200 hover:bg-white"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {/* 콘텐츠명 */}
                    <h4 className="font-medium text-gray-900 truncate">
                      {item.title}
                    </h4>
                    {/* 부제목 (있는 경우) */}
                    {item.subtitle && (
                      <p className="text-sm text-gray-600 truncate">
                        {item.subtitle}
                      </p>
                    )}
                    {/* 메타데이터 (ContentCard와 동일한 순서) */}
                    {hasMetadata && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {/* 콘텐츠 타입 배지 (ContentCard와 동일) */}
                        {activeTab === "book" && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                            📚 교재
                          </span>
                        )}
                        {activeTab === "lecture" && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
                            🎧 강의
                          </span>
                        )}
                        {activeTab === "custom" && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-800">
                            📄 커스텀
                          </span>
                        )}
                        {/* 교과 그룹명 */}
                        {item.subject_group_name && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 font-medium text-blue-800">
                            {item.subject_group_name}
                          </span>
                        )}
                        {/* 세부 과목 */}
                        {item.subject && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                            {item.subject}
                          </span>
                        )}
                        {/* 학기 */}
                        {item.semester && (
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                            {item.semester}
                          </span>
                        )}
                        {/* 개정교육과정 (revision 우선, 없으면 curriculum_revision_name) */}
                        {(item.revision || item.curriculum_revision_name) && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 font-medium text-purple-800">
                            {item.revision || item.curriculum_revision_name}
                          </span>
                        )}
                        {/* 난이도 */}
                        {item.difficulty_level && (
                          <span className="rounded bg-indigo-100 px-2 py-0.5 text-indigo-800">
                            {item.difficulty_level}
                          </span>
                        )}
                        {/* 출판사 (교재만) */}
                        {activeTab === "book" && item.publisher && (
                          <span className="text-gray-600">{item.publisher}</span>
                        )}
                        {/* 플랫폼 (강의만) */}
                        {activeTab === "lecture" && item.platform && (
                          <span className="text-gray-600">{item.platform}</span>
                        )}
                      </div>
                    )}
                  </div>
                <div
                  className={cn(
                    "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                    activeTab === "book"
                      ? "bg-amber-100"
                      : activeTab === "lecture"
                      ? "bg-purple-100"
                      : "bg-gray-100"
                  )}
                >
                  {activeTab === "book" ? (
                    <BookOpen className="h-4 w-4 text-amber-600" />
                  ) : activeTab === "lecture" ? (
                    <Video className="h-4 w-4 text-purple-600" />
                  ) : (
                    <FileText className="h-4 w-4 text-gray-600" />
                  )}
                </div>
              </div>
            </button>
            );
          })
        )}
      </div>
      </div>
    </div>
  );
});

