"use client";

/**
 * C1 개선: 캠프 참여자 목록 스켈레톤 컴포넌트
 *
 * 캠프 참여자 목록 로딩 시 표시되는 스켈레톤 UI
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
 * 통계 카드 스켈레톤
 */
function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

/**
 * 대시보드 스켈레톤
 */
function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* 통계 카드 그리드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* 빠른 액션 버튼 */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-36" />
      </div>
    </div>
  );
}

/**
 * 툴바 스켈레톤
 */
function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}

/**
 * 테이블 행 스켈레톤
 */
function TableRowSkeleton() {
  return (
    <tr className="border-b border-gray-100">
      <td className="p-4">
        <Skeleton className="h-5 w-5" />
      </td>
      <td className="p-4">
        <Skeleton className="h-5 w-24" />
      </td>
      <td className="p-4">
        <Skeleton className="h-5 w-16" />
      </td>
      <td className="p-4">
        <Skeleton className="h-6 w-16 rounded-full" />
      </td>
      <td className="p-4">
        <Skeleton className="h-5 w-32" />
      </td>
      <td className="p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </td>
    </tr>
  );
}

/**
 * 테이블 스켈레톤
 */
function TableSkeleton({ rowCount = 8 }: { rowCount?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-4 text-left">
              <Skeleton className="h-5 w-5" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-20" />
            </th>
            <th className="p-4 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type CampParticipantsListSkeletonProps = {
  /** 표시할 테이블 행 개수 */
  rowCount?: number;
};

/**
 * 캠프 참여자 목록 스켈레톤
 */
export function CampParticipantsListSkeleton({
  rowCount = 8,
}: CampParticipantsListSkeletonProps) {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* 헤더 스켈레톤 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-10 w-40" />
        </div>

        {/* 대시보드 스켈레톤 */}
        <DashboardSkeleton />

        {/* 툴바 스켈레톤 */}
        <ToolbarSkeleton />

        {/* 테이블 스켈레톤 */}
        <TableSkeleton rowCount={rowCount} />
      </div>
    </section>
  );
}

export default CampParticipantsListSkeleton;
