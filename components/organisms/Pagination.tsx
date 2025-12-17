"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";
import Button from "@/components/atoms/Button";

export type PaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  showFirstLast?: boolean;
  className?: string;
};

function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount: number
): (number | "...")[] {
  const pages: (number | "...")[] = [];

  // 시작과 끝 범위 계산
  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 1;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    // 왼쪽에 dots 없음, 오른쪽에 있음
    const leftRange = 1 + 2 * siblingCount;
    for (let i = 1; i <= Math.min(leftRange, totalPages); i++) {
      pages.push(i);
    }
    if (totalPages > leftRange) {
      pages.push("...");
      pages.push(totalPages);
    }
  } else if (shouldShowLeftDots && !shouldShowRightDots) {
    // 왼쪽에 dots 있음, 오른쪽에 없음
    pages.push(1);
    pages.push("...");
    const rightRange = totalPages - 2 * siblingCount;
    for (let i = Math.max(rightRange, 1); i <= totalPages; i++) {
      pages.push(i);
    }
  } else if (shouldShowLeftDots && shouldShowRightDots) {
    // 양쪽에 dots
    pages.push(1);
    pages.push("...");
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      pages.push(i);
    }
    pages.push("...");
    pages.push(totalPages);
  } else {
    // dots 없음
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  }

  return pages;
}

function PaginationComponent({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  showFirstLast = true,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pageNumbers = generatePageNumbers(currentPage, totalPages, siblingCount);

  return (
    <nav
      className={cn("flex items-center justify-center gap-1", className)}
      aria-label="페이지 네비게이션"
    >
      {/* 처음으로 */}
      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label="처음 페이지"
        >
          ⟪
        </Button>
      )}

      {/* 이전 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="이전 페이지"
      >
        ←
      </Button>

      {/* 페이지 번호 */}
      {pageNumbers.map((page, index) =>
        page === "..." ? (
          <span
            key={`dots-${index}`}
            className="px-2 text-[var(--text-tertiary)]"
          >
            ...
          </span>
        ) : (
          <Button
            key={page}
            variant={currentPage === page ? "primary" : "ghost"}
            size="sm"
            onClick={() => onPageChange(page)}
            aria-current={currentPage === page ? "page" : undefined}
          >
            {page}
          </Button>
        )
      )}

      {/* 다음 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="다음 페이지"
      >
        →
      </Button>

      {/* 마지막으로 */}
      {showFirstLast && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label="마지막 페이지"
        >
          ⟫
        </Button>
      )}
    </nav>
  );
}

export const Pagination = memo(PaginationComponent);
export default Pagination;

