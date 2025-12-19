"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/organisms/Pagination";

type CampTemplatesPaginationProps = {
  currentPage: number;
  totalPages: number;
  pageSize: number;
};

export function CampTemplatesPagination({
  currentPage,
  totalPages,
  pageSize,
}: CampTemplatesPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/camp-templates?${params.toString()}`);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("limit", newPageSize);
    params.set("page", "1"); // 페이지 크기 변경 시 첫 페이지로
    router.push(`/admin/camp-templates?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-4">
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-700">페이지 크기:</label>
        <select
          value={pageSize.toString()}
          onChange={(e) => handlePageSizeChange(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1 text-sm"
        >
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>
  );
}

