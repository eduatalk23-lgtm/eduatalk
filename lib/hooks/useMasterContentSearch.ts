"use client";

import { useState, useCallback } from "react";

/**
 * 마스터 콘텐츠 검색 결과 타입
 */
export type MasterContentResult = {
  id: string;
  title: string;
  content_type: "book" | "lecture";
  subject_category?: string | null;
  subject?: string | null;
  publisher?: string | null;
  platform?: string | null;
  publisher_or_academy?: string | null;
  total_pages?: number | null;
  total_episodes?: number | null;
};

type UseMasterContentSearchOptions = {
  contentType?: "book" | "lecture";
  debounceMs?: number;
  limit?: number;
};

type UseMasterContentSearchReturn = {
  query: string;
  setQuery: (query: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  results: MasterContentResult[];
  isLoading: boolean;
  isSearching: boolean;
  hasSearched: boolean;
  error: string | null;
  search: (searchQuery: string) => Promise<void>;
  reset: () => void;
};

/**
 * 마스터 콘텐츠 검색 Hook
 *
 * TODO: 실제 검색 API 연동 필요
 */
export function useMasterContentSearch(
  _options?: UseMasterContentSearchOptions
): UseMasterContentSearchReturn {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<MasterContentResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (_searchQuery: string) => {
    setIsLoading(true);
    setIsSearching(true);
    setError(null);
    try {
      // TODO: 실제 검색 API 호출
      // const response = await searchMasterContents(searchQuery, options);
      // setResults(response);
      setResults([]);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setSearchQuery("");
    setResults([]);
    setError(null);
    setHasSearched(false);
  }, []);

  return {
    query,
    setQuery,
    searchQuery,
    setSearchQuery,
    results,
    isLoading,
    isSearching,
    hasSearched,
    error,
    search,
    reset,
  };
}
