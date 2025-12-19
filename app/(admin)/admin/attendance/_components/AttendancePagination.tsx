"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textSecondary,
} from "@/lib/utils/darkMode";

type AttendancePaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
};

export function AttendancePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  searchParams,
}: AttendancePaginationProps) {
  if (totalPages <= 1 && totalItems === 0) {
    return null;
  }

  const buildUrl = (page: number) => {
    const params = new URLSearchParams({
      ...searchParams,
      page: String(page),
    });
    return `/admin/attendance?${params.toString()}`;
  };

  const startItem = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        {currentPage > 1 && (
          <Link
            href={buildUrl(currentPage - 1)}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover
            )}
          >
            이전
          </Link>
        )}
        <span className={cn("text-sm", textSecondary)}>
          {currentPage} / {totalPages}
        </span>
        {currentPage < totalPages && (
          <Link
            href={buildUrl(currentPage + 1)}
            className={cn(
              "rounded-lg border px-4 py-2 text-sm font-semibold transition",
              borderInput,
              bgSurface,
              textSecondary,
              bgHover
            )}
          >
            다음
          </Link>
        )}
      </div>
      <div className="text-center">
        <span className={cn("text-sm", textSecondary)}>
          {startItem}-{endItem} / 총 {totalItems}개
        </span>
      </div>
    </div>
  );
}

