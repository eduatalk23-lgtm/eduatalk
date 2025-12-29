import { bgSurfaceVar, borderDefaultVar } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

/**
 * Suspense fallback 전용 로딩 컴포넌트
 * Suspense 경계에서 사용되는 기본 로딩 상태
 */
export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-8 min-h-[200px]">
      <div className="animate-pulse flex flex-col gap-4 w-full max-w-md">
        <div className="h-4 w-3/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
        <div className="h-4 w-1/2 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
        <div className="h-4 w-5/6 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
      </div>
    </div>
  );
}

export type SkeletonVariant =
  | "default"
  | "card"
  | "table"
  | "page"
  | "schedule"
  | "tab"
  | "form"
  | "calendar"
  | "chart"
  | "stats";

/**
 * 기본 로딩 스켈레톤
 */
export function LoadingSkeleton({ variant = "default" }: { variant?: SkeletonVariant }) {
  switch (variant) {
    case "card":
      return <CardSkeleton />;
    case "table":
      return <TableSkeleton />;
    case "page":
      return <PageSkeleton />;
    case "schedule":
      return <ScheduleSkeleton />;
    case "tab":
      return <TabSkeleton />;
    case "form":
      return <FormSkeleton />;
    case "calendar":
      return <CalendarSkeleton />;
    case "chart":
      return <ChartSkeleton />;
    case "stats":
      return <StatsSkeleton />;
    default:
      return (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-4 w-3/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
          <div className="h-4 w-1/2 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
          <div className="h-4 w-5/6 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
        </div>
      );
  }
}

/**
 * 카드 형태 스켈레톤
 */
export function CardSkeleton() {
  return (
    <div className={cn("rounded-xl border p-6 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      <div className="animate-pulse flex flex-col gap-4">
        <div className="h-6 w-1/3 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
        <div className="h-4 w-full rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
        <div className="h-4 w-2/3 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
      </div>
    </div>
  );
}

/**
 * 테이블 형태 스켈레톤
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className={cn("rounded-xl border shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      <div className="animate-pulse">
        <div className={cn("border-b p-4", borderDefaultVar)}>
          <div className="h-4 w-1/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("border-b p-4", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
            <div className="flex gap-4">
              <div className="h-4 w-1/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
              <div className="h-4 w-1/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
              <div className="h-4 w-1/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
              <div className="h-4 w-1/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 페이지 전체 스켈레톤
 */
function PageSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-6">
          <div className="h-8 w-1/3 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
          <div className="flex flex-col gap-4">
            <div className="h-4 w-full rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
            <div className="h-4 w-5/6 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
            <div className="h-4 w-4/6 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]"></div>
            ))}
      </div>
    </div>
  );
}

/**
 * 스케줄 형태 스켈레톤
 */
function ScheduleSkeleton() {
  return (
    <div className="flex flex-col gap-4">
        <div className="h-6 w-48 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
      <div className={cn("rounded-lg border", borderDefaultVar, bgSurfaceVar)}>
        <div className={cn("border-b px-4 py-3", borderDefaultVar, "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]")}>
          <div className="h-5 w-32 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
        </div>
        <div className="max-h-[600px] flex flex-col gap-2 overflow-y-auto p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("flex flex-col gap-2 border-b pb-4 last:border-b-0", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
              <div className="h-12 w-full animate-pulse rounded bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-700))]" />
              <div className="ml-4 flex flex-col gap-2">
                <div className="h-16 w-full animate-pulse rounded bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-700))]" />
                <div className="h-16 w-full animate-pulse rounded bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-700))]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * 탭 형태 스켈레톤
 */
function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-8 w-48 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
      <div className="flex flex-col gap-3">
          <div className="h-32 w-full animate-pulse rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
          <div className="h-64 w-full animate-pulse rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-24 w-full animate-pulse rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
            <div className="h-24 w-full animate-pulse rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
        </div>
      </div>
    </div>
  );
}

/**
 * 폼 형태 스켈레톤
 */
function FormSkeleton() {
  return (
    <div className="animate-pulse flex flex-col gap-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
          <div className="h-10 w-full bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/**
 * 캘린더 형태 스켈레톤
 */
export function CalendarSkeleton({ weeks = 5 }: { weeks?: number }) {
  const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <div className={cn("rounded-xl border shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      {/* 헤더 */}
      <div className={cn("border-b p-4 flex items-center justify-between", borderDefaultVar)}>
        <div className="h-6 w-32 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
        <div className="flex gap-2">
          <div className="h-8 w-8 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
          <div className="h-8 w-8 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className={cn("grid grid-cols-7 border-b", borderDefaultVar)}>
        {daysOfWeek.map((day) => (
          <div key={day} className="p-2 text-center">
            <div className="h-4 w-6 mx-auto animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="animate-pulse">
        {Array.from({ length: weeks }).map((_, weekIndex) => (
          <div key={weekIndex} className={cn("grid grid-cols-7 border-b last:border-b-0", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div key={dayIndex} className="min-h-[80px] p-2 border-r last:border-r-0 border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]">
                <div className="h-5 w-5 mb-2 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
                {/* 일부 날짜에 이벤트 표시 */}
                {(weekIndex + dayIndex) % 3 === 0 && (
                  <div className="h-4 w-full rounded bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 차트 형태 스켈레톤
 */
export function ChartSkeleton({ type = "bar" }: { type?: "bar" | "line" | "pie" | "area" }) {
  const skeletonBg = "bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]";
  const skeletonBgLight = "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]";

  return (
    <div className={cn("rounded-xl border p-6 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      {/* 차트 제목 */}
      <div className="flex items-center justify-between mb-6">
        <div className={cn("h-6 w-32 animate-pulse rounded", skeletonBg)} />
        <div className="flex gap-2">
          <div className={cn("h-4 w-16 animate-pulse rounded", skeletonBgLight)} />
          <div className={cn("h-4 w-16 animate-pulse rounded", skeletonBgLight)} />
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="animate-pulse">
        {type === "pie" ? (
          /* 파이 차트 */
          <div className="flex items-center justify-center">
            <div className={cn("size-48 rounded-full", skeletonBg)} />
          </div>
        ) : type === "line" || type === "area" ? (
          /* 라인/영역 차트 */
          <div className="h-64 flex items-end gap-1">
            <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
              <path
                d="M0,180 Q50,120 100,140 T200,100 T300,130 T400,80"
                fill="none"
                stroke="rgb(var(--color-secondary-300))"
                strokeWidth="2"
                className="dark:stroke-[rgb(var(--color-secondary-600))]"
              />
            </svg>
          </div>
        ) : (
          /* 바 차트 (기본) */
          <div className="h-64 flex items-end justify-between gap-2">
            {[40, 65, 45, 80, 55, 70, 50, 90, 60, 75, 85, 45].map((height, i) => (
              <div
                key={i}
                className={cn("flex-1 rounded-t", skeletonBg)}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        )}

        {/* X축 레이블 */}
        <div className="flex justify-between mt-4 pt-4 border-t border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("h-3 w-8 rounded", skeletonBgLight)} />
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn("size-3 rounded", skeletonBg)} />
            <div className={cn("h-3 w-12 rounded", skeletonBgLight)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 통계 카드 형태 스켈레톤
 */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn("rounded-xl border p-4 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
          <div className="animate-pulse flex flex-col gap-3">
            {/* 아이콘 및 라벨 */}
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
              <div className="h-4 w-16 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
            </div>
            {/* 값 */}
            <div className="h-8 w-24 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
            {/* 변화율 */}
            <div className="h-4 w-20 rounded bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]" />
          </div>
        </div>
      ))}
    </div>
  );
}

