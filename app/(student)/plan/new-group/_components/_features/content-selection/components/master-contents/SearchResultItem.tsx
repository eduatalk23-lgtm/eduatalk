"use client";

import { cn } from "@/lib/cn";
import type { SearchResultItemProps } from "./types";

/**
 * 개별 검색 결과 아이템
 */
export function SearchResultItem({
  result,
  onSelect,
  disabled,
  alreadyAdded,
}: SearchResultItemProps) {
  return (
    <div className="flex items-start justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-semibold text-gray-900">{result.title}</h4>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              result.content_type === "book"
                ? "bg-blue-100 text-blue-800"
                : "bg-purple-100 text-purple-700"
            )}
          >
            {result.content_type === "book" ? "📚 교재" : "🎧 강의"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-800">
          {result.publisher_or_academy && (
            <span>{result.publisher_or_academy}</span>
          )}
          {result.subject && <span>· {result.subject}</span>}
          {result.revision && <span>· {result.revision}</span>}
          {result.total_pages && <span>· {result.total_pages}페이지</span>}
          {result.total_episodes && <span>· {result.total_episodes}회차</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onSelect(result)}
        disabled={disabled || alreadyAdded}
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors",
          disabled || alreadyAdded
            ? "cursor-not-allowed bg-gray-400"
            : "bg-indigo-600 hover:bg-indigo-700"
        )}
      >
        {alreadyAdded ? "추가됨" : "추가"}
      </button>
    </div>
  );
}
