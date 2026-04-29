"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  departmentSearchQueryOptions,
  bypassMajorKeys,
} from "@/lib/query-options/bypassMajor";
import type {
  UniversityDepartment,
  DepartmentSearchFilter,
} from "@/lib/domains/bypass-major/types";
import { Search, X, Building2 } from "lucide-react";

interface BypassTargetSelectorProps {
  value: UniversityDepartment | null;
  onChange: (dept: UniversityDepartment | null) => void;
}

export function BypassTargetSelector({
  value,
  onChange,
}: BypassTargetSelectorProps) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<DepartmentSearchFilter>({
    page: 1,
    pageSize: 15,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: searchRes, isFetching, refetch } = useQuery(
    departmentSearchQueryOptions(filter),
  );

  const results =
    searchRes?.success === true ? searchRes.data?.data ?? [] : [];
  const count =
    searchRes?.success === true ? searchRes.data?.count ?? 0 : 0;

  // 디바운스 검색
  const debouncedSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (q.trim().length < 1) return;
        const newFilter: DepartmentSearchFilter = {
          query: q.trim(),
          page: 1,
          pageSize: 15,
        };
        setFilter(newFilter);
        // 기존 캐시 제거 후 refetch
        queryClient.removeQueries({
          queryKey: bypassMajorKeys.search(newFilter),
        });
        setTimeout(() => refetch(), 0);
      }, 300);
    },
    [queryClient, refetch],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      setIsOpen(true);
      debouncedSearch(val);
    },
    [debouncedSearch],
  );

  const handleSelect = useCallback(
    (dept: UniversityDepartment) => {
      onChange(dept);
      setQuery("");
      setIsOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setQuery("");
    inputRef.current?.focus();
  }, [onChange]);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 선택된 상태 표시
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-900/20">
        <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-indigo-900 dark:text-indigo-200">
            {value.university_name} {value.department_name}
          </p>
          {value.college_name && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              {value.college_name}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 rounded-md p-1 text-indigo-400 transition-colors hover:bg-indigo-100 hover:text-indigo-600 dark:hover:bg-indigo-800"
          aria-label="선택 해제"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className="relative">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.trim().length >= 1 && setIsOpen(true)}
          placeholder="대학명 또는 학과명으로 검색..."
          className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {isFetching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </span>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && query.trim().length >= 1 && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-lg">
          {results.length === 0 && !isFetching ? (
            <p className="px-4 py-3 text-center text-sm text-[var(--text-tertiary)]">
              검색 결과가 없습니다.
            </p>
          ) : (
            <>
              {results.map((dept) => (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => handleSelect(dept)}
                  className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">{dept.university_name}</span>
                      {" "}
                      {dept.department_name}
                    </p>
                    <div className="flex flex-wrap gap-1.5 text-xs text-[var(--text-tertiary)]">
                      {dept.college_name && <span>{dept.college_name}</span>}
                      {dept.major_classification && (
                        <span className="rounded bg-bg-tertiary px-1.5 py-0.5 dark:bg-bg-secondary">
                          {dept.major_classification}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {typeof count === "number" && count > 15 && (
                <p className="border-t border-[var(--border-secondary)] px-4 py-2 text-center text-xs text-[var(--text-tertiary)]">
                  {count}건 중 상위 15건 표시 - 검색어를 더 입력해 주세요
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
