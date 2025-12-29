"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { WizardData } from "./types";

interface ContentSelectionStepProps {
  onSelect: (content: WizardData["content"]) => void;
  selectedContent: WizardData["content"];
}

interface ContentItem {
  id: string;
  name: string;
  type: "book" | "lecture" | "custom";
  totalUnits?: number;
  subject?: string;
  subjectCategory?: string;
}

export function ContentSelectionStep({
  onSelect,
  selectedContent,
}: ContentSelectionStepProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedContent?.id ?? null
  );
  const [contentType, setContentType] = useState<"book" | "lecture" | "custom">(
    "book"
  );

  // 콘텐츠 목록 조회 (React Query)
  const {
    data: contents = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ContentItem[]>({
    queryKey: ["student-contents", contentType],
    queryFn: async () => {
      const response = await fetch(
        `/api/student/contents?type=${contentType}`
      );
      if (!response.ok) {
        throw new Error("콘텐츠를 불러오는데 실패했습니다.");
      }
      return response.json();
    },
    retry: 1, // 한 번만 재시도
  });

  // 검색 필터링
  const filteredContents = contents.filter((content) =>
    content.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (content: ContentItem) => {
    setSelectedId(content.id);
  };

  const handleContinue = () => {
    const selected = contents.find((c) => c.id === selectedId);
    if (selected) {
      onSelect({
        id: selected.id,
        type: selected.type,
        name: selected.name,
        totalUnits: selected.totalUnits,
        subject: selected.subject,
        subjectCategory: selected.subjectCategory,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          학습할 콘텐츠를 선택하세요
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          내 콘텐츠 또는 마스터 콘텐츠에서 학습할 항목을 선택합니다.
        </p>
      </div>

      {/* Content Type Tabs */}
      <div className="flex gap-2">
        {(["book", "lecture", "custom"] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setContentType(type);
              setSelectedId(null);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              contentType === type
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {type === "book" ? "교재" : type === "lecture" ? "강의" : "기타"}
          </button>
        ))}
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="콘텐츠 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Content List */}
      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">로딩 중...</div>
        ) : isError ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-red-600 dark:text-red-400">
              {error instanceof Error
                ? error.message
                : "콘텐츠를 불러오는데 실패했습니다."}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        ) : filteredContents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {searchQuery
              ? "검색 결과가 없습니다."
              : "등록된 콘텐츠가 없습니다."}
          </div>
        ) : (
          filteredContents.map((content) => (
            <button
              key={content.id}
              onClick={() => handleSelect(content)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                selectedId === content.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                  : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {content.name}
                  </h3>
                  {content.subject && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {content.subject}
                    </p>
                  )}
                </div>
                {content.totalUnits && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {content.totalUnits}
                    {contentType === "book" ? "페이지" : "회"}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Continue Button */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={!selectedId}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          다음
        </button>
      </div>
    </div>
  );
}
