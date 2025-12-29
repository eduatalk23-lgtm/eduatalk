"use client";

import { SearchResultItem } from "./SearchResultItem";
import type { SearchResultsListProps } from "./types";

/**
 * 마스터 콘텐츠 검색 결과 목록
 */
export function SearchResultsList({
  results,
  isSearching,
  onSelect,
  maxReached,
  selectedMasterIds,
  editable,
}: SearchResultsListProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-gray-900">
        검색 결과 ({results.length}개)
      </h3>

      {isSearching ? (
        <div className="py-8 text-center text-sm text-gray-800">검색 중...</div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          {results.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              onSelect={onSelect}
              disabled={!editable || maxReached}
              alreadyAdded={selectedMasterIds.has(result.id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-gray-800">
          검색 결과가 없습니다.
        </div>
      )}
    </div>
  );
}
