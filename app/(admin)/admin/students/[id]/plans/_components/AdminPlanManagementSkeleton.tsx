'use client';

export function AdminPlanManagementSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 상단 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
        <div className="h-10 bg-gray-200 rounded w-24" />
      </div>

      {/* 통계 카드 스켈레톤 */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg border border-gray-200 p-4 space-y-2"
          >
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded w-16" />
          </div>
        ))}
      </div>

      {/* 캘린더 뷰 스켈레톤 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="h-5 bg-gray-200 rounded w-24 mb-3" />
        <div className="grid grid-cols-7 gap-2">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded" />
          ))}
        </div>
      </div>

      {/* Dock 스켈레톤 */}
      <div className="grid grid-cols-2 gap-4">
        {/* Unfinished Dock */}
        <div className="bg-red-50 rounded-lg border border-red-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-red-200">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-red-200 rounded" />
              <div className="h-5 bg-red-200 rounded w-24" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 bg-red-100 rounded" />
            ))}
          </div>
        </div>

        {/* Daily Dock */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 bg-blue-200 rounded" />
              <div className="h-5 bg-blue-200 rounded w-24" />
            </div>
          </div>
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-blue-100 rounded" />
            ))}
          </div>
        </div>
      </div>

      {/* Weekly Dock 스켈레톤 */}
      <div className="bg-green-50 rounded-lg border border-green-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-200">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-green-200 rounded" />
            <div className="h-5 bg-green-200 rounded w-24" />
          </div>
        </div>
        <div className="p-4 space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-green-100 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
