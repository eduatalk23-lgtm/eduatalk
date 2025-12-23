"use client";

import { useState, useCallback } from "react";
import { searchContentMastersAction } from "@/lib/domains/content";

/**
 * 마스터 콘텐츠 검색 결과 타입
 */
export type MasterContentResult = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject?: string | null;
  subject_category?: string | null;
  publisher_or_academy?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
};

type UseMasterContentSearchOptions = {
  /** 검색 결과 최대 개수 */
  limit?: number;
};

type UseMasterContentSearchReturn = {
  /** 검색 결과 */
  results: MasterContentResult[];
  /** 검색어 */
  searchQuery: string;
  /** 검색어 설정 */
  setSearchQuery: (query: string) => void;
  /** 검색 중 여부 */
  isSearching: boolean;
  /** 검색 수행 여부 */
  hasSearched: boolean;
  /** 검색 실행 */
  search: (contentType: "book" | "lecture") => Promise<void>;
  /** 상태 초기화 */
  reset: () => void;
  /** 에러 메시지 */
  error: string | null;
};

/**
 * 마스터 콘텐츠 검색 훅
 *
 * 마스터 교재/강의 검색 기능을 제공합니다.
 *
 * @example
 * ```tsx
 * const { results, searchQuery, setSearchQuery, search, isSearching } = useMasterContentSearch();
 *
 * // 검색 실행
 * await search("book");
 * ```
 */
export function useMasterContentSearch(
  options: UseMasterContentSearchOptions = {}
): UseMasterContentSearchReturn {
  const { limit = 20 } = options;

  const [results, setResults] = useState<MasterContentResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (contentType: "book" | "lecture") => {
      if (!searchQuery.trim()) return;

      setIsSearching(true);
      setHasSearched(true);
      setError(null);

      try {
        const result = await searchContentMastersAction({
          content_type: contentType,
          search: searchQuery.trim(),
          limit,
        });

        if (result && "data" in result) {
          setResults(result.data as MasterContentResult[]);
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error("[useMasterContentSearch] 검색 실패:", err);
        setError("마스터 콘텐츠 검색에 실패했습니다.");
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [searchQuery, limit]
  );

  const reset = useCallback(() => {
    setResults([]);
    setSearchQuery("");
    setIsSearching(false);
    setHasSearched(false);
    setError(null);
  }, []);

  return {
    results,
    searchQuery,
    setSearchQuery,
    isSearching,
    hasSearched,
    search,
    reset,
    error,
  };
}
