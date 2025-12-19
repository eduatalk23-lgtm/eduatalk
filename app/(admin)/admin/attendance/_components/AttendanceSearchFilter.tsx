"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textPrimary,
  textSecondary,
  inlineButtonPrimary,
} from "@/lib/utils/darkMode";
import {
  ATTENDANCE_SORT_OPTIONS,
  type AttendanceSortOption,
} from "@/lib/constants/attendance";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/domains/attendance/types";
import type { AttendanceStatus } from "@/lib/domains/attendance/types";

type AttendanceSearchFilterProps = {
  studentNameFilter: string;
  startDateFilter: string;
  endDateFilter: string;
  statusFilter?: AttendanceStatus;
  checkInMethodFilter?: string;
  checkOutMethodFilter?: string;
  sortBy: AttendanceSortOption;
};

export function AttendanceSearchFilter({
  studentNameFilter,
  startDateFilter,
  endDateFilter,
  statusFilter,
  checkInMethodFilter,
  checkOutMethodFilter,
  sortBy,
}: AttendanceSearchFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasActiveFilters =
    studentNameFilter ||
    startDateFilter ||
    endDateFilter ||
    statusFilter ||
    checkInMethodFilter ||
    checkOutMethodFilter ||
    sortBy !== "date";

  // 기본 필터: 학생명, 날짜, 상태
  // 고급 필터: 입실 방법, 정렬

  return (
    <div className="flex flex-col gap-4">
      <form
        method="get"
        className="flex flex-col gap-4"
      >
        {/* 기본 필터 */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
        {/* 학생명 검색 */}
        <div className="flex flex-col gap-1 flex-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            학생명 검색
          </label>
          <input
            type="text"
            name="student_name"
            placeholder="학생명으로 검색..."
            defaultValue={studentNameFilter}
            className={cn(
              "w-full rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
        </div>

        {/* 시작 날짜 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            시작 날짜
          </label>
          <input
            type="date"
            name="start_date"
            defaultValue={startDateFilter}
            className={cn(
              "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
        </div>

        {/* 종료 날짜 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            종료 날짜
          </label>
          <input
            type="date"
            name="end_date"
            defaultValue={endDateFilter}
            className={cn(
              "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          />
        </div>

        {/* 상태 필터 */}
        <div className="flex flex-col gap-1">
          <label className={cn("text-sm font-medium", textSecondary)}>
            상태
          </label>
          <select
            name="status"
            defaultValue={statusFilter || ""}
            className={cn(
              "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
              borderInput,
              bgSurface,
              textPrimary,
              "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
            )}
          >
            <option value="">전체</option>
            {Object.entries(ATTENDANCE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
            href="/admin/attendance"
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
        </div>

        {/* 고급 필터 (접기/펼치기) */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "flex items-center justify-between rounded-lg border px-4 py-2 text-sm font-medium transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover
            )}
          >
            <span>고급 필터</span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {isExpanded && (
            <div className="flex flex-col gap-4 md:flex-row md:items-end">
              {/* 입실 방법 필터 */}
              <div className="flex flex-col gap-1">
                <label className={cn("text-sm font-medium", textSecondary)}>
                  입실 방법
                </label>
                <select
                  name="check_in_method"
                  defaultValue={checkInMethodFilter || ""}
                  className={cn(
                    "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                    borderInput,
                    bgSurface,
                    textPrimary,
                    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                  )}
                >
                  <option value="">전체</option>
                  <option value="manual">수동</option>
                  <option value="qr">QR코드</option>
                  <option value="location">위치기반</option>
                  <option value="auto">자동</option>
                </select>
              </div>

              {/* 퇴실 방법 필터 */}
              <div className="flex flex-col gap-1">
                <label className={cn("text-sm font-medium", textSecondary)}>
                  퇴실 방법
                </label>
                <select
                  name="check_out_method"
                  defaultValue={checkOutMethodFilter || ""}
                  className={cn(
                    "rounded-lg border px-4 py-2 focus:outline-none focus:ring-2",
                    borderInput,
                    bgSurface,
                    textPrimary,
                    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                  )}
                >
                  <option value="">전체</option>
                  <option value="manual">수동</option>
                  <option value="qr">QR코드</option>
                  <option value="location">위치기반</option>
                  <option value="auto">자동</option>
                </select>
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
                  {Object.values(ATTENDANCE_SORT_OPTIONS).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

