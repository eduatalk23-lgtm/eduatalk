"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Search, X } from "lucide-react";

interface InstructorFiltersProps {
  platforms: string[];
  subjectCategories: string[];
  initialValues?: {
    search?: string;
    platform?: string;
    subjectCategory?: string;
    teachingStyle?: string;
    difficultyFocus?: string;
  };
}

const TEACHING_STYLES = [
  { value: "개념형", label: "개념형" },
  { value: "문풀형", label: "문풀형" },
  { value: "속성형", label: "속성형" },
  { value: "심화형", label: "심화형" },
  { value: "균형형", label: "균형형" },
];

const DIFFICULTY_FOCUSES = [
  { value: "개념", label: "개념" },
  { value: "기본", label: "기본" },
  { value: "심화", label: "심화" },
  { value: "최상위", label: "최상위" },
];

/**
 * 강사 필터 컴포넌트
 */
export function InstructorFilters({
  platforms,
  subjectCategories,
  initialValues = {},
}: InstructorFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(initialValues.search ?? "");

  // 필터 적용
  const applyFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      // 업데이트 적용
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      router.push(`/admin/master-instructors?${params.toString()}`);
    },
    [router, searchParams]
  );

  // 검색 실행
  const handleSearch = useCallback(() => {
    applyFilters({ search: search || undefined });
  }, [applyFilters, search]);

  // 엔터키 처리
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    },
    [handleSearch]
  );

  // 필터 초기화
  const clearFilters = useCallback(() => {
    setSearch("");
    router.push("/admin/master-instructors");
  }, [router]);

  // 활성 필터 여부
  const hasActiveFilters =
    initialValues.search ||
    initialValues.platform ||
    initialValues.subjectCategory ||
    initialValues.teachingStyle ||
    initialValues.difficultyFocus;

  return (
    <div className="flex flex-col gap-4">
      {/* 검색바 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="강사명 검색..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <button
          onClick={handleSearch}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          검색
        </button>
      </div>

      {/* 필터 옵션 */}
      <div className="flex flex-wrap gap-3">
        {/* 플랫폼 */}
        <select
          value={initialValues.platform ?? ""}
          onChange={(e) => applyFilters({ platform: e.target.value || undefined })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">모든 플랫폼</option>
          {platforms.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>

        {/* 교과 */}
        <select
          value={initialValues.subjectCategory ?? ""}
          onChange={(e) =>
            applyFilters({ subjectCategory: e.target.value || undefined })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">모든 교과</option>
          {subjectCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        {/* 강의 스타일 */}
        <select
          value={initialValues.teachingStyle ?? ""}
          onChange={(e) =>
            applyFilters({ teachingStyle: e.target.value || undefined })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">모든 스타일</option>
          {TEACHING_STYLES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* 주력 난이도 */}
        <select
          value={initialValues.difficultyFocus ?? ""}
          onChange={(e) =>
            applyFilters({ difficultyFocus: e.target.value || undefined })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">모든 난이도</option>
          {DIFFICULTY_FOCUSES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {/* 필터 초기화 */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            초기화
          </button>
        )}
      </div>
    </div>
  );
}
