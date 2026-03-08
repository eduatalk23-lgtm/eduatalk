'use client';

/**
 * GCal 스타일 캘린더 레이아웃 스켈레톤
 *
 * 실제 레이아웃: CalendarLayoutShell (사이드바 + 메인 캘린더 뷰)
 * - 모바일: 사이드바 숨김, 캘린더만 표시
 * - 태블릿: 220px 사이드바
 * - 데스크톱: 280px 사이드바
 */
export function AdminPlanManagementSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden animate-pulse">
      {/* 메인 레이아웃: 사이드바 + 캘린더 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 사이드바 (모바일 숨김) */}
        <div className="hidden md:flex flex-shrink-0 flex-col gap-4 p-4 border-r border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[var(--background)] w-[220px] lg:w-[280px]">
          {/* 미니 캘린더 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded w-20" />
              <div className="flex gap-1">
                <div className="h-6 w-6 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
                <div className="h-6 w-6 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[...Array(7)].map((_, i) => (
                <div key={`h-${i}`} className="h-4 bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] rounded text-center" />
              ))}
              {[...Array(35)].map((_, i) => (
                <div key={`d-${i}`} className="h-6 bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] rounded" />
              ))}
            </div>
          </div>

          {/* 캘린더 목록 */}
          <div className="space-y-2 pt-2 border-t border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
            <div className="h-4 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded w-16" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-4 w-4 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
                <div className="h-3 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* 캘린더 메인 영역 */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]">
            <div className="h-full flex flex-col rounded-lg border border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[var(--background)] overflow-hidden">
              {/* 요일 헤더 */}
              <div className="flex border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
                {/* 시간 구터 */}
                <div className="w-14 flex-shrink-0" />
                {/* 요일 칼럼 (주간 뷰 7칸) */}
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="flex-1 py-2 px-1 border-l border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-800))] first:border-l-0">
                    <div className="h-3 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded w-8 mx-auto mb-1" />
                    <div className="h-6 w-6 bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] rounded-full mx-auto" />
                  </div>
                ))}
              </div>

              {/* 시간 그리드 */}
              <div className="flex-1 overflow-hidden">
                <div className="flex h-full">
                  {/* 시간 라벨 */}
                  <div className="w-14 flex-shrink-0 flex flex-col">
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                      <div key={h} className="h-12 flex items-start justify-end pr-2 pt-0.5">
                        <div className="h-3 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded w-8" />
                      </div>
                    ))}
                  </div>
                  {/* 이벤트 영역 */}
                  <div className="flex-1 flex">
                    {[...Array(7)].map((_, col) => (
                      <div key={col} className="flex-1 border-l border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-800))] first:border-l-0">
                        {[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => (
                          <div key={h} className="h-12 border-b border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-800))]" />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
