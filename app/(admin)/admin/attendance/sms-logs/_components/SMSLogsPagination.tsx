"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/atoms/Button";

type SMSLogsPaginationProps = {
  currentPage: number;
  totalPages: number;
};

export function SMSLogsPagination({
  currentPage,
  totalPages,
}: SMSLogsPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    router.push(`?${params.toString()}`);
  };

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        disabled={currentPage <= 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        이전
      </Button>
      <span className="text-sm text-gray-600">
        {currentPage} / {totalPages}
      </span>
      <Button
        variant="outline"
        disabled={currentPage >= totalPages}
        onClick={() => handlePageChange(currentPage + 1)}
      >
        다음
      </Button>
    </div>
  );
}

