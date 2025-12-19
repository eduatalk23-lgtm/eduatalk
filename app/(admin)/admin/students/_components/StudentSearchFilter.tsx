"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textPrimary,
  textSecondary,
  inlineButtonPrimary,
} from "@/lib/utils/darkMode";
import { STUDENT_SORT_OPTIONS, type StudentSortOption, type StudentDivision } from "@/lib/constants/students";
import { getActiveStudentDivisionsAction } from "@/app/actions/studentDivisionsActions";

type StudentSearchFilterProps = {
  searchQuery: string;
  gradeFilter: string;
  classFilter: string;
  divisionFilter?: StudentDivision;
  hasScoreFilter: boolean;
  showInactiveFilter: boolean;
  sortBy: StudentSortOption;
};

export function StudentSearchFilter({
  searchQuery,
  gradeFilter,
  classFilter,
  divisionFilter,
  hasScoreFilter,
  showInactiveFilter,
  sortBy,
}: StudentSearchFilterProps) {
  const [divisions, setDivisions] = useState<Array<{ value: StudentDivision; label: string }>>([]);
  const [loadingDivisions, setLoadingDivisions] = useState(true);

  useEffect(() => {
    async function loadDivisions() {
      try {
        const data = await getActiveStudentDivisionsAction();
        setDivisions(
          data.map((d) => ({
            value: d.name as StudentDivision,
            label: d.name,
          }))
        );
      } catch (error) {
        console.error("학생 구분 목록 로드 실패:", error);
      } finally {
        setLoadingDivisions(false);
      }
    }
    loadDivisions();
  }, []);

  const hasActiveFilters =
    searchQuery ||
    gradeFilter ||
    classFilter ||
    divisionFilter ||
    hasScoreFilter ||
    showInactiveFilter ||
    sortBy !== "name";

  return (
    <div className="flex flex-col gap-4">
      <form
        method="get"
        className="flex flex-col gap-4 md:flex-row md:items-end"
      >
        {/* 검색 */}
        <div className="flex flex-col gap-1 flex-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            검색 (이름 또는 연락처)
          </label>
          <input
            type="text"
            name="search"
            placeholder="이름 또는 연락처 4자리 이상으로 검색..."
            defaultValue={searchQuery}
            className={cn(
              "w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
          <p className={cn("text-xs", textSecondary)}>
            이름으로 검색하거나 연락처 4자리 이상을 입력하세요
          </p>
        </div>

        {/* 학년 필터 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            학년
          </label>
          <input
            type="text"
            name="grade"
            placeholder="전체"
            defaultValue={gradeFilter}
            className={cn(
              "w-24 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
        </div>

        {/* 반 필터 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            반
          </label>
          <input
            type="text"
            name="class"
            placeholder="전체"
            defaultValue={classFilter}
            className={cn(
              "w-24 rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
        </div>

        {/* 구분 필터 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            구분
          </label>
          <select
            name="division"
            defaultValue={divisionFilter || ""}
            className={cn(
              "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          >
            <option value="">전체</option>
            {loadingDivisions ? (
              <option disabled>로딩 중...</option>
            ) : (
              divisions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* 성적 입력 여부 필터 */}
        <div className="flex items-end">
          <label
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 transition",
              borderInput,
              bgSurface,
              bgHover
            )}
          >
            <input
              type="checkbox"
              name="has_score"
              value="true"
              defaultChecked={hasScoreFilter}
              className={cn(
                "rounded text-indigo-600 focus:ring-indigo-500",
                borderInput
              )}
            />
            <span className={cn("text-sm", textSecondary)}>
              성적 입력 학생만
            </span>
          </label>
        </div>

        {/* 비활성화 학생 표시 필터 */}
        <div className="flex items-end">
          <label
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 transition",
              borderInput,
              bgSurface,
              bgHover
            )}
          >
            <input
              type="checkbox"
              name="show_inactive"
              value="true"
              defaultChecked={showInactiveFilter}
              className={cn(
                "rounded text-indigo-600 focus:ring-indigo-500",
                borderInput
              )}
            />
            <span className={cn("text-sm", textSecondary)}>비활성화 포함</span>
          </label>
        </div>

        {/* 정렬 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            정렬
          </label>
          <select
            name="sort"
            defaultValue={sortBy}
            className={cn(
              "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          >
            {Object.values(STUDENT_SORT_OPTIONS).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* 검색 버튼 */}
        <button
          type="submit"
          className={cn(
            "rounded-lg px-6 py-2 text-sm font-semibold text-white transition",
            inlineButtonPrimary()
          )}
        >
          검색
        </button>

        {/* 초기화 */}
        {hasActiveFilters && (
          <Link
            href="/admin/students"
            className={cn(
              "rounded-lg border px-6 py-2 text-sm font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover
            )}
          >
            초기화
          </Link>
        )}
      </form>
    </div>
  );
}

