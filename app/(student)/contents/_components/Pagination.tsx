"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  activeTab: "books" | "lectures" | "custom";
  filters: {
    search?: string;
    curriculum_revision_id?: string;
    subject_group_id?: string;
    subject_id?: string;
    publisher_id?: string;
    platform_id?: string;
    difficulty?: string;
  };
  sortBy: string;
};

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  activeTab,
  filters,
  sortBy,
}: PaginationProps) {
  const searchParams = useSearchParams();

  const buildUrl = (page: number) => {
    const params = new URLSearchParams();
    
    if (activeTab === "lectures") {
      params.set("tab", "lectures");
    } else if (activeTab === "custom") {
      params.set("tab", "custom");
    }
    
    if (filters.search) params.set("search", filters.search);
    if (filters.curriculum_revision_id) params.set("curriculum_revision_id", filters.curriculum_revision_id);
    if (filters.subject_group_id) params.set("subject_group_id", filters.subject_group_id);
    if (filters.subject_id) params.set("subject_id", filters.subject_id);
    if (filters.publisher_id) params.set("publisher_id", filters.publisher_id);
    if (filters.platform_id) params.set("platform_id", filters.platform_id);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (sortBy) params.set("sort", sortBy);
    if (page > 1) params.set("page", String(page));
    
    return `/contents${params.toString() ? `?${params.toString()}` : ""}`;
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("...");
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      <div className="text-sm text-gray-600">
        총 <span className="font-semibold text-gray-900">{totalItems}</span>개 중{" "}
        <span className="font-semibold text-gray-900">
          {(currentPage - 1) * 20 + 1}-{Math.min(currentPage * 20, totalItems)}
        </span>
        개 표시
      </div>
      
      <div className="flex items-center gap-2">
        {/* 이전 버튼 */}
        {currentPage > 1 ? (
          <Link
            href={buildUrl(currentPage - 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            이전
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed">
            이전
          </span>
        )}

        {/* 페이지 번호 */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, index) => {
            if (page === "...") {
              return (
                <span key={`ellipsis-${index}`} className="px-2 text-gray-400">
                  ...
                </span>
              );
            }
            
            const pageNum = page as number;
            const isActive = pageNum === currentPage;
            
            return (
              <Link
                key={pageNum}
                href={buildUrl(pageNum)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {pageNum}
              </Link>
            );
          })}
        </div>

        {/* 다음 버튼 */}
        {currentPage < totalPages ? (
          <Link
            href={buildUrl(currentPage + 1)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            다음
          </Link>
        ) : (
          <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-400 cursor-not-allowed">
            다음
          </span>
        )}
      </div>
    </div>
  );
}

