"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCampTemplates } from "@/lib/hooks/useCampTemplates";
import { TemplateCard } from "./TemplateCard";
import { CampTemplatesPagination } from "./CampTemplatesPagination";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";

type CampTemplatesListContainerProps = {
  tenantId: string;
  initialPage?: number;
  initialPageSize?: number;
  initialFilters?: {
    search?: string;
    status?: string;
    programType?: string;
  };
};

export function CampTemplatesListContainer({
  tenantId,
  initialPage = 1,
  initialPageSize = 20,
  initialFilters = {},
}: CampTemplatesListContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 파라미터에서 필터 값 읽기
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || initialFilters.search || "",
    status: searchParams.get("status") || initialFilters.status || "",
    programType: searchParams.get("program_type") || initialFilters.programType || "",
  });

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 필터 옵션 구성
  const filterOptions = useMemo(
    () => ({
      search: filters.search || undefined,
      status: filters.status || undefined,
      programType: filters.programType || undefined,
    }),
    [filters]
  );

  // 템플릿 목록 조회
  const { data: templatesData, isLoading } = useCampTemplates({
    tenantId,
    page,
    pageSize,
    filters: filterOptions,
  });

  // 검색 폼 제출 핸들러
  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFilters = {
      search: formData.get("search")?.toString() || "",
      status: formData.get("status")?.toString() || "",
      programType: formData.get("program_type")?.toString() || "",
    };

    setFilters(newFilters);
    setPage(1); // 검색 시 첫 페이지로 리셋

    // URL 업데이트
    const params = new URLSearchParams();
    if (newFilters.search) params.set("search", newFilters.search);
    if (newFilters.status) params.set("status", newFilters.status);
    if (newFilters.programType) params.set("program_type", newFilters.programType);
    router.push(`/admin/camp-templates?${params.toString()}`);
  };

  const templates = templatesData?.items || [];
  const total = templatesData?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // 로딩 상태
  if (isLoading) {
    return <SuspenseFallback />;
  }

  return (
    <>
      {/* 검색 필터 */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-wrap items-end gap-4"
        >
          {/* 프로그램 유형 필터 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">
              프로그램 유형
            </label>
            <select
              name="program_type"
              defaultValue={filters.programType}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="윈터캠프">윈터캠프</option>
              <option value="썸머캠프">썸머캠프</option>
              <option value="파이널캠프">파이널캠프</option>
              <option value="기타">기타</option>
            </select>
          </div>

          {/* 상태 필터 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">상태</label>
            <select
              name="status"
              defaultValue={filters.status}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="draft">초안</option>
              <option value="active">활성</option>
              <option value="archived">보관</option>
            </select>
          </div>

          {/* 검색어 */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-700">검색</label>
            <input
              type="text"
              name="search"
              defaultValue={filters.search}
              placeholder="템플릿명 또는 설명 검색"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {/* 검색 버튼 */}
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            검색
          </button>

          {/* 초기화 버튼 */}
          <Link
            href="/admin/camp-templates"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            초기화
          </Link>
        </form>
      </div>

      {/* 결과 개수 */}
      <div className="text-sm text-gray-600">
        총 <span className="font-semibold">{total}</span>
        개의 템플릿이 표시됩니다.
      </div>

      {/* 템플릿 목록 */}
      <div>
        {templates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center">
            <div className="mx-auto flex max-w-md flex-col gap-6">
              <div className="text-6xl">🏕️</div>
              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  템플릿이 없습니다
                </h3>
                <p className="text-sm text-gray-500">
                  새로운 캠프 템플릿을 생성해보세요.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {templates.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
            {/* 페이지네이션 */}
            <CampTemplatesPagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
            />
          </>
        )}
      </div>
    </>
  );
}

