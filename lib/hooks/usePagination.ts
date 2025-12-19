/**
 * 공통 페이지네이션 훅
 */

import { useState, useCallback } from "react";

type UsePaginationOptions = {
  initialPage?: number;
  initialPageSize?: number;
  onPageChange?: (page: number, pageSize: number) => void;
};

export function usePagination({
  initialPage = 1,
  initialPageSize = 20,
  onPageChange,
}: UsePaginationOptions = {}) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPage(newPage);
      onPageChange?.(newPage, pageSize);
    },
    [pageSize, onPageChange]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      setPage(1); // 페이지 사이즈 변경 시 첫 페이지로
      setPageSize(newPageSize);
      onPageChange?.(1, newPageSize);
    },
    [onPageChange]
  );

  const resetPage = useCallback(() => {
    setPage(1);
    onPageChange?.(1, pageSize);
  }, [pageSize, onPageChange]);

  const adjustPageAfterDeletion = useCallback(
    (deletedCount: number, totalItems: number) => {
      const remainingCount = totalItems - deletedCount;
      const currentPageStart = (page - 1) * pageSize;

      if (remainingCount <= currentPageStart && page > 1) {
        const newPage = page - 1;
        setPage(newPage);
        onPageChange?.(newPage, pageSize);
      } else {
        onPageChange?.(page, pageSize);
      }
    },
    [page, pageSize, onPageChange]
  );

  return {
    page,
    pageSize,
    setPage: handlePageChange,
    setPageSize: handlePageSizeChange,
    resetPage,
    adjustPageAfterDeletion,
  };
}

