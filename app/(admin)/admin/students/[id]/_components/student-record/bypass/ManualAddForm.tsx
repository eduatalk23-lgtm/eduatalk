"use client";

import { useState, useTransition, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addManualCandidateAction } from "@/lib/domains/bypass-major/actions/bypass";
import {
  departmentSearchQueryOptions,
  bypassMajorKeys as bpKeys,
} from "@/lib/query-options/bypassMajor";
import type {
  UniversityDepartment,
  DepartmentSearchFilter,
} from "@/lib/domains/bypass-major/types";
import { Search, Building2 } from "lucide-react";

interface ManualAddFormProps {
  studentId: string;
  targetDeptId: string;
  schoolYear: number;
  tenantId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ManualAddForm({
  studentId,
  targetDeptId,
  schoolYear,
  tenantId,
  onSuccess,
  onCancel,
}: ManualAddFormProps) {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DepartmentSearchFilter>({
    page: 1,
    pageSize: 10,
  });
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: searchRes, isFetching, refetch } = useQuery(
    departmentSearchQueryOptions(filter),
  );

  const results =
    searchRes?.success === true ? searchRes.data?.data ?? [] : [];

  const debouncedSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (q.trim().length < 1) return;
        const newFilter: DepartmentSearchFilter = {
          query: q.trim(),
          page: 1,
          pageSize: 10,
        };
        setFilter(newFilter);
        queryClient.removeQueries({
          queryKey: bpKeys.search(newFilter),
        });
        setTimeout(() => refetch(), 0);
      }, 300);
    },
    [queryClient, refetch],
  );

  function handleSelect(dept: UniversityDepartment) {
    setIsOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await addManualCandidateAction({
        studentId,
        targetDeptId,
        candidateDeptId: dept.id,
        schoolYear,
        tenantId,
      });
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error ?? "추가에 실패했습니다.");
      }
    });
  }

  // 바깥 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          수동 후보 추가
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          취소
        </button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            debouncedSearch(e.target.value);
          }}
          onFocus={() => query.trim().length >= 1 && setIsOpen(true)}
          placeholder="대학명 또는 학과명 검색..."
          disabled={isPending}
          className="w-full rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] py-2 pl-8 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        {(isFetching || isPending) && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          </span>
        )}
      </div>

      {/* 드롭다운 */}
      {isOpen && query.trim().length >= 1 && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] shadow-md">
          {results.length === 0 && !isFetching ? (
            <p className="px-3 py-2 text-center text-xs text-[var(--text-tertiary)]">
              검색 결과 없음
            </p>
          ) : (
            results.map((dept) => (
              <button
                key={dept.id}
                type="button"
                onClick={() => handleSelect(dept)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--surface-hover)]"
              >
                <Building2 className="mt-0.5 h-3 w-3 shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-[var(--text-primary)]">
                    <span className="font-medium">{dept.university_name}</span>{" "}
                    {dept.department_name}
                  </p>
                  {dept.major_classification && (
                    <span className="text-3xs text-[var(--text-tertiary)]">
                      {dept.major_classification}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  );
}
