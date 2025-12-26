"use client";

/**
 * C1 개선: 캠프 템플릿 목록 스켈레톤 컴포넌트
 *
 * 캠프 템플릿 목록 로딩 시 표시되는 스켈레톤 UI
 */

import { cn } from "@/lib/cn";

type SkeletonProps = {
  className?: string;
};

function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gray-200 dark:bg-gray-700",
        className
      )}
    />
  );
}

/**
 * 템플릿 카드 스켈레톤
 */
function TemplateCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-4 md:gap-6">
        {/* 이름 */}
        <div className="flex-shrink-0 min-w-[120px] md:min-w-[150px]">
          <Skeleton className="h-5 w-24 md:w-32" />
        </div>

        {/* 유형 */}
        <div className="flex-shrink-0 hidden sm:block">
          <Skeleton className="h-4 w-16" />
        </div>

        {/* 설명 */}
        <div className="flex-1 min-w-0 hidden md:block">
          <Skeleton className="h-4 w-48" />
        </div>

        {/* 날짜 */}
        <div className="flex-shrink-0 ml-auto">
          <Skeleton className="h-3 w-20" />
        </div>

        {/* 상태 배지 및 메뉴 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Skeleton className="h-6 w-12 rounded-full" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/**
 * 검색 필터 스켈레톤
 */
function FilterSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-4">
        {/* 프로그램 유형 */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-28" />
        </div>

        {/* 상태 */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-10 w-20" />
        </div>

        {/* 검색 */}
        <div className="flex flex-col gap-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-10 w-48" />
        </div>

        {/* 버튼 */}
        <Skeleton className="h-10 w-16" />
        <Skeleton className="h-10 w-16" />
      </div>
    </div>
  );
}

type CampTemplatesListSkeletonProps = {
  /** 표시할 카드 개수 */
  count?: number;
  /** 필터 스켈레톤 표시 여부 */
  showFilter?: boolean;
};

/**
 * 캠프 템플릿 목록 스켈레톤
 */
export function CampTemplatesListSkeleton({
  count = 5,
  showFilter = true,
}: CampTemplatesListSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 검색 필터 스켈레톤 */}
      {showFilter && <FilterSkeleton />}

      {/* 결과 개수 스켈레톤 */}
      <div className="flex items-center gap-1">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-24" />
      </div>

      {/* 템플릿 카드 스켈레톤 */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <TemplateCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export default CampTemplatesListSkeleton;
