"use client";

/**
 * WebSearchResultsPanel - 웹 검색 결과 패널
 *
 * Gemini Grounding을 통해 검색된 웹 콘텐츠를 표시합니다.
 * - 검색된 학습 자료 목록
 * - 라이브러리 저장 버튼
 * - 중복 표시
 */

import { useState } from "react";
import { cn } from "@/lib/cn";
import { textPrimary, textSecondary, textMuted } from "@/lib/utils/darkMode";
import type { WebSearchResult } from "@/lib/domains/plan/llm/providers/base";

// ============================================
// 타입 정의
// ============================================

export interface WebSearchResultsPanelProps {
  /** 웹 검색 결과 */
  results: WebSearchResult[];
  /** 검색 쿼리 */
  searchQueries?: string[];
  /** 저장 처리 콜백 */
  onSave?: (selectedUrls: string[]) => Promise<void>;
  /** 저장 완료 콜백 */
  onSaveComplete?: (savedCount: number) => void;
  /** 추가 클래스 */
  className?: string;
}

// ============================================
// 아이콘 컴포넌트
// ============================================

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
      />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

// ============================================
// 헬퍼 함수
// ============================================

function inferContentType(url: string, title: string): "lecture" | "book" | "article" {
  const lowerUrl = url.toLowerCase();
  const lowerTitle = title.toLowerCase();

  // 강의/동영상 콘텐츠 판별
  if (
    lowerUrl.includes("youtube") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("lecture") ||
    lowerUrl.includes("course") ||
    lowerUrl.includes("megastudy") ||
    lowerUrl.includes("etoos") ||
    lowerUrl.includes("ebsi") ||
    lowerTitle.includes("강의") ||
    lowerTitle.includes("강좌") ||
    lowerTitle.includes("인강") ||
    lowerTitle.includes("동영상")
  ) {
    return "lecture";
  }

  // 교재/문제집 콘텐츠 판별
  if (
    lowerTitle.includes("교재") ||
    lowerTitle.includes("문제집") ||
    lowerTitle.includes("기출") ||
    lowerTitle.includes("교과서") ||
    lowerUrl.includes("yes24") ||
    lowerUrl.includes("kyobobook") ||
    lowerUrl.includes("aladin")
  ) {
    return "book";
  }

  return "article";
}

function getContentIcon(type: "lecture" | "book" | "article") {
  switch (type) {
    case "lecture":
      return PlayIcon;
    case "book":
      return BookIcon;
    default:
      return DocumentIcon;
  }
}

function getContentTypeBadge(type: "lecture" | "book" | "article") {
  switch (type) {
    case "lecture":
      return { label: "강의", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" };
    case "book":
      return { label: "교재", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" };
    default:
      return { label: "자료", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" };
  }
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// ============================================
// 메인 컴포넌트
// ============================================

export function WebSearchResultsPanel({
  results,
  searchQueries = [],
  onSave,
  onSaveComplete,
  className,
}: WebSearchResultsPanelProps) {
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

  if (results.length === 0) {
    return null;
  }

  const handleToggleSelect = (url: string) => {
    setSelectedUrls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(url)) {
        newSet.delete(url);
      } else {
        newSet.add(url);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedUrls.size === results.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(results.map((r) => r.url)));
    }
  };

  const handleSave = async () => {
    if (!onSave || selectedUrls.size === 0) return;

    setIsSaving(true);
    setSaveStatus("idle");

    try {
      await onSave(Array.from(selectedUrls));
      setSaveStatus("success");
      onSaveComplete?.(selectedUrls.size);
      setSelectedUrls(new Set());
    } catch {
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-blue-200 dark:border-blue-800",
        "bg-blue-50/50 dark:bg-blue-900/10",
        className
      )}
    >
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GlobeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className={cn("font-medium", textPrimary)}>
              웹 검색 결과
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {results.length}개
            </span>
          </div>
          {onSave && (
            <button
              type="button"
              onClick={handleSelectAll}
              className={cn(
                "text-xs px-2 py-1 rounded transition-colors",
                "text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
              )}
            >
              {selectedUrls.size === results.length ? "전체 해제" : "전체 선택"}
            </button>
          )}
        </div>

        {/* 검색 쿼리 표시 */}
        {searchQueries.length > 0 && (
          <div className={cn("text-xs mt-1", textMuted)}>
            검색어: {searchQueries.join(", ")}
          </div>
        )}
      </div>

      {/* 결과 목록 */}
      <div className="divide-y divide-blue-100 dark:divide-blue-800/50">
        {results.map((result, index) => {
          const contentType = inferContentType(result.url, result.title);
          const Icon = getContentIcon(contentType);
          const badge = getContentTypeBadge(contentType);
          const isSelected = selectedUrls.has(result.url);

          return (
            <div
              key={`${result.url}-${index}`}
              className={cn(
                "px-4 py-3 transition-colors",
                isSelected && "bg-blue-100/50 dark:bg-blue-900/20",
                onSave && "cursor-pointer hover:bg-blue-100/30 dark:hover:bg-blue-900/10"
              )}
              onClick={onSave ? () => handleToggleSelect(result.url) : undefined}
            >
              <div className="flex items-start gap-3">
                {/* 선택 체크박스 */}
                {onSave && (
                  <div
                    className={cn(
                      "flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 transition-colors",
                      isSelected
                        ? "bg-blue-500 border-blue-500"
                        : "border-gray-300 dark:border-gray-600"
                    )}
                  >
                    {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                  </div>
                )}

                {/* 아이콘 */}
                <div
                  className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                    contentType === "lecture"
                      ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                      : contentType === "book"
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>

                {/* 콘텐츠 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4
                      className={cn(
                        "text-sm font-medium truncate",
                        textPrimary
                      )}
                      title={result.title}
                    >
                      {result.title}
                    </h4>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded flex-shrink-0", badge.color)}>
                      {badge.label}
                    </span>
                  </div>

                  {result.snippet && (
                    <p
                      className={cn("text-xs mt-1 line-clamp-2", textMuted)}
                      title={result.snippet}
                    >
                      {result.snippet}
                    </p>
                  )}

                  <div className={cn("text-xs mt-1", textSecondary)}>
                    {extractDomain(result.url)}
                  </div>
                </div>

                {/* 외부 링크 버튼 */}
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex-shrink-0 p-1.5 rounded transition-colors",
                    "text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* 저장 버튼 영역 */}
      {onSave && (
        <div className="px-4 py-3 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <span className={cn("text-sm", textSecondary)}>
              {selectedUrls.size > 0
                ? `${selectedUrls.size}개 선택됨`
                : "라이브러리에 저장할 항목을 선택하세요"}
            </span>
            <button
              type="button"
              onClick={handleSave}
              disabled={selectedUrls.size === 0 || isSaving}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                "bg-blue-500 text-white hover:bg-blue-600",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSaving
                ? "저장 중..."
                : saveStatus === "success"
                  ? "저장 완료!"
                  : "라이브러리에 저장"}
            </button>
          </div>

          {saveStatus === "error" && (
            <p className="text-xs text-red-500 mt-2">
              저장 중 오류가 발생했습니다. 다시 시도해주세요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default WebSearchResultsPanel;
