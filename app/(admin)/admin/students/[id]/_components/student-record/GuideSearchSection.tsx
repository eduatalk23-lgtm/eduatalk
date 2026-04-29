"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import {
  guideSearchQueryOptions,
  guideCareerFieldsQueryOptions,
} from "@/lib/query-options/explorationGuide";
import { GUIDE_TYPES, GUIDE_TYPE_LABELS } from "@/lib/domains/guide";
import type { GuideType, GuideListFilter } from "@/lib/domains/guide";
import { GuideCard } from "./GuideCard";
import { Search, X } from "lucide-react";

interface GuideSearchSectionProps {
  onSelectGuide: (guideId: string) => void;
  onAssignGuide: (guideId: string) => void;
  assignedGuideIds: Set<string>;
  studentClassificationId?: number;
  studentClassificationName?: string;
}

export function GuideSearchSection({
  onSelectGuide,
  onAssignGuide,
  assignedGuideIds,
  studentClassificationId,
  studentClassificationName,
}: GuideSearchSectionProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<GuideType | "">("");
  const [selectedCareerFieldId, setSelectedCareerFieldId] = useState<number | undefined>();
  const [classificationId, setClassificationId] = useState<number | undefined>(studentClassificationId);
  const [page, setPage] = useState(1);
  const [activeFilters, setActiveFilters] = useState<GuideListFilter>({
    status: "approved",
    page: 1,
    pageSize: 10,
  });

  const { data: careerFieldsRes } = useQuery(guideCareerFieldsQueryOptions());
  const careerFields = careerFieldsRes?.success ? careerFieldsRes.data ?? [] : [];

  const { data: searchRes, isLoading, refetch } = useQuery({
    ...guideSearchQueryOptions(activeFilters),
    enabled: activeFilters !== null && Object.keys(activeFilters).length > 2,
  });

  const results = searchRes?.success ? searchRes.data : null;

  const handleSearch = useCallback(() => {
    const filters: GuideListFilter = {
      status: "approved",
      page,
      pageSize: 10,
      ...(searchQuery && { searchQuery }),
      ...(selectedType && { guideType: selectedType }),
      ...(selectedCareerFieldId && { careerFieldId: selectedCareerFieldId }),
      ...(classificationId && { classificationId }),
    };
    setActiveFilters(filters);
    // refetch after state settles
    setTimeout(() => refetch(), 0);
  }, [searchQuery, selectedType, selectedCareerFieldId, classificationId, page, refetch]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const filters: GuideListFilter = {
      ...activeFilters,
      page: newPage,
    };
    setActiveFilters(filters);
    setTimeout(() => refetch(), 0);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-text-tertiary">검색</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="제목, 도서명 검색..."
              className="w-full rounded-md border py-1.5 pl-8 pr-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-tertiary">유형</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as GuideType | "")}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {GUIDE_TYPES.map((t) => (
              <option key={t} value={t}>
                {GUIDE_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-text-tertiary">계열</label>
          <select
            value={selectedCareerFieldId ?? ""}
            onChange={(e) =>
              setSelectedCareerFieldId(
                e.target.value ? Number(e.target.value) : undefined,
              )
            }
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {careerFields.map((cf) => (
              <option key={cf.id} value={cf.id}>
                {cf.name_kor}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleSearch}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          검색
        </button>
      </div>

      {/* 소분류 필터 칩 */}
      {classificationId && studentClassificationName && (
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            학과 분류: {studentClassificationName}
            <button
              type="button"
              onClick={() => {
                setClassificationId(undefined);
                handleSearch();
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-100"
              aria-label="소분류 필터 해제"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}
      {!classificationId && studentClassificationId && studentClassificationName && (
        <button
          type="button"
          onClick={() => {
            setClassificationId(studentClassificationId);
          }}
          className="text-xs text-blue-600 hover:underline"
        >
          학생 학과 분류({studentClassificationName}) 필터 적용
        </button>
      )}

      {/* 결과 */}
      {isLoading && (
        <p className="py-8 text-center text-sm text-text-tertiary">검색 중...</p>
      )}

      {results && (
        <>
          <p className="text-xs text-text-tertiary">
            {results.count.toLocaleString()}건 중 {results.data.length}건 표시
          </p>

          <div className="flex flex-col gap-1.5">
            {results.data.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                onSelect={onSelectGuide}
                onAssign={onAssignGuide}
                isAssigned={assignedGuideIds.has(guide.id)}
              />
            ))}
          </div>

          {results.count > 10 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  page <= 1
                    ? "text-text-disabled"
                    : "text-text-secondary hover:bg-bg-tertiary",
                )}
              >
                이전
              </button>
              <span className="text-xs text-text-tertiary">
                {page} / {Math.ceil(results.count / 10)}
              </span>
              <button
                type="button"
                disabled={page >= Math.ceil(results.count / 10)}
                onClick={() => handlePageChange(page + 1)}
                className={cn(
                  "rounded px-2 py-1 text-xs",
                  page >= Math.ceil(results.count / 10)
                    ? "text-text-disabled"
                    : "text-text-secondary hover:bg-bg-tertiary",
                )}
              >
                다음
              </button>
            </div>
          )}

          {results.data.length === 0 && (
            <p className="py-8 text-center text-sm text-text-tertiary">
              검색 결과가 없습니다.
            </p>
          )}
        </>
      )}

      {!results && !isLoading && (
        <p className="py-8 text-center text-sm text-text-tertiary">
          검색 조건을 입력하고 검색 버튼을 눌러주세요.
        </p>
      )}
    </div>
  );
}
