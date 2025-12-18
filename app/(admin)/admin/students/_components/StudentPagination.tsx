"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  bgHover,
  textSecondary,
} from "@/lib/utils/darkMode";

type StudentPaginationProps = {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
};

export function StudentPagination({
  currentPage,
  totalPages,
  searchParams,
}: StudentPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const buildUrl = (page: number) => {
    const params = new URLSearchParams({
      ...searchParams,
      page: String(page),
    });
    return `/admin/students?${params.toString()}`;
  };

  return (
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
  );
}

