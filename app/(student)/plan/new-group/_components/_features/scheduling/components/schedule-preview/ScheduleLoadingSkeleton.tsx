"use client";

import { Skeleton } from "@/components/atoms/Skeleton";

/**
 * 스케줄 로딩 스켈레톤
 */
export function ScheduleLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* 헤더 스켈레톤 */}
      <div className="flex flex-col gap-1">
        <Skeleton variant="text" height={28} width="200px" />
        <Skeleton variant="text" height={16} width="300px" />
      </div>

      {/* 요약 통계 스켈레톤 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4"
          >
            <Skeleton variant="rectangular" height={20} width="60px" />
            <Skeleton variant="text" height={32} width="40px" />
            <Skeleton variant="text" height={14} width="20px" />
          </div>
        ))}
      </div>

      {/* 주차별 스케줄 스켈레톤 */}
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6">
        <Skeleton variant="text" height={20} width="120px" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, weekIndex) => (
            <div
              key={weekIndex}
              className="overflow-hidden rounded-lg border border-gray-200"
            >
              <div className="flex w-full items-center justify-between bg-gray-50 p-4">
                <Skeleton variant="text" height={20} width="150px" />
                <Skeleton variant="rectangular" height={20} width={20} />
              </div>
              <div className="space-y-2 p-4">
                {Array.from({ length: 3 }).map((_, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <Skeleton variant="text" height={20} width="200px" />
                      <Skeleton variant="text" height={16} width="60px" />
                    </div>
                    <Skeleton variant="rectangular" height={40} width="100%" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
