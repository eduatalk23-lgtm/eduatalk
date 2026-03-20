"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { curriculumCompareQueryOptions } from "@/lib/query-options/bypassMajor";
import { X, BookOpen } from "lucide-react";

interface CurriculumComparisonViewProps {
  deptIdA: string;
  deptIdB: string;
  onClose: () => void;
}

export function CurriculumComparisonView({
  deptIdA,
  deptIdB,
  onClose,
}: CurriculumComparisonViewProps) {
  const { data: res, isLoading, error } = useQuery(
    curriculumCompareQueryOptions(deptIdA, deptIdB),
  );

  const result = res?.success === true ? res.data : null;

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-6">
        <div className="flex items-center justify-center gap-2 py-8">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
          <span className="text-sm text-[var(--text-secondary)]">
            교육과정 비교 중...
          </span>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
        <div className="flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400">
            교육과정 비교 데이터를 불러올 수 없습니다.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const { departmentA, departmentB, sharedCourses, uniqueToA, uniqueToB, overlapScore, totalCoursesA, totalCoursesB } = result;

  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-[var(--border-secondary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-indigo-500" />
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
            교육과정 비교
          </h4>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)]"
          aria-label="비교 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 유사도 점수 바 */}
      <div className="border-b border-[var(--border-secondary)] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            교과목 겹침률
          </span>
          <span
            className={cn(
              "text-lg font-bold",
              overlapScore >= 30
                ? "text-emerald-600 dark:text-emerald-400"
                : overlapScore >= 15
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400",
            )}
          >
            {overlapScore}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              overlapScore >= 30
                ? "bg-emerald-500"
                : overlapScore >= 15
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
            style={{ width: `${Math.min(overlapScore, 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-[var(--text-tertiary)]">
          <span>공통 교과목 {sharedCourses.length}개</span>
          <span>
            A: {totalCoursesA}과목 / B: {totalCoursesB}과목
          </span>
        </div>
      </div>

      {/* 2열 비교 */}
      <div className="grid grid-cols-2 divide-x divide-[var(--border-secondary)]">
        {/* 좌: 대상 학과 (A) */}
        <div className="flex flex-col">
          <div className="border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {departmentA.universityName}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {departmentA.name}
            </p>
          </div>
          <div className="flex flex-col gap-0 px-1 py-1">
            {/* 공통 교과목 */}
            {sharedCourses.map((course) => (
              <span
                key={`a-shared-${course}`}
                className="rounded px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400"
              >
                {course}
              </span>
            ))}
            {/* A 고유 교과목 */}
            {uniqueToA.map((course) => (
              <span
                key={`a-unique-${course}`}
                className="rounded px-2 py-1 text-xs text-[var(--text-tertiary)]"
              >
                {course}
              </span>
            ))}
            {totalCoursesA === 0 && (
              <p className="px-2 py-4 text-center text-xs text-[var(--text-tertiary)]">
                교과목 데이터 없음
              </p>
            )}
          </div>
        </div>

        {/* 우: 우회 후보 학과 (B) */}
        <div className="flex flex-col">
          <div className="border-b border-[var(--border-secondary)] bg-[var(--surface-secondary)] px-3 py-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {departmentB.universityName}
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              {departmentB.name}
            </p>
          </div>
          <div className="flex flex-col gap-0 px-1 py-1">
            {/* 공통 교과목 */}
            {sharedCourses.map((course) => (
              <span
                key={`b-shared-${course}`}
                className="rounded px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400"
              >
                {course}
              </span>
            ))}
            {/* B 고유 교과목 */}
            {uniqueToB.map((course) => (
              <span
                key={`b-unique-${course}`}
                className="rounded px-2 py-1 text-xs text-[var(--text-tertiary)]"
              >
                {course}
              </span>
            ))}
            {totalCoursesB === 0 && (
              <p className="px-2 py-4 text-center text-xs text-[var(--text-tertiary)]">
                교과목 데이터 없음
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-4 border-t border-[var(--border-secondary)] px-4 py-2">
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-[var(--text-secondary)]">공통 교과목</span>
        </span>
        <span className="flex items-center gap-1.5 text-[10px]">
          <span className="inline-block h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
          <span className="text-[var(--text-secondary)]">고유 교과목</span>
        </span>
      </div>
    </div>
  );
}
