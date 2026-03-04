import { bgSurfaceVar, borderDefaultVar } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

/** 스켈레톤 배경 (shimmer 효과) */
const shimmerBg = "skeleton-shimmer";
/** 스켈레톤 배경 (연한 버전 — 시각적 계층용) */
const shimmerBgLight = "bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))]";

/**
 * Suspense fallback 전용 로딩 컴포넌트
 * Suspense 경계에서 사용되는 기본 로딩 상태
 */
export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-8 min-h-[200px]" aria-busy="true" role="status">
      <span className="sr-only">화면을 불러오는 중입니다</span>
      <div className="flex flex-col gap-4 w-full max-w-md">
        <div className={cn("h-4 w-3/4 rounded mx-auto", shimmerBg)}></div>
        <div className={cn("h-4 w-1/2 rounded mx-auto", shimmerBg)}></div>
        <div className={cn("h-4 w-5/6 rounded mx-auto", shimmerBg)}></div>
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
  const renderContent = () => {
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
          <div className="flex flex-col gap-4">
            <div className={cn("h-4 w-3/4 rounded", shimmerBg)}></div>
            <div className={cn("h-4 w-1/2 rounded", shimmerBg)}></div>
            <div className={cn("h-4 w-5/6 rounded", shimmerBg)}></div>
          </div>
        );
    }
  };

  return (
    <div aria-busy="true" role="status">
      <span className="sr-only">화면을 불러오는 중입니다</span>
      {renderContent()}
    </div>
  );
}

/**
 * 카드 형태 스켈레톤
 */
export function CardSkeleton() {
  return (
    <div className={cn("rounded-xl border p-6 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      <div className="flex flex-col gap-4">
        <div className={cn("h-6 w-1/3 rounded", shimmerBg)}></div>
        <div className={cn("h-4 w-full rounded", shimmerBg)}></div>
        <div className={cn("h-4 w-2/3 rounded", shimmerBg)}></div>
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
      <div>
        <div className={cn("border-b p-4", borderDefaultVar)}>
          <div className={cn("h-4 w-1/4 rounded", shimmerBg)}></div>
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={cn("border-b p-4", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
            <div className="flex gap-4">
              <div className={cn("h-4 w-1/4 rounded", shimmerBg)}></div>
              <div className={cn("h-4 w-1/4 rounded", shimmerBg)}></div>
              <div className={cn("h-4 w-1/4 rounded", shimmerBg)}></div>
              <div className={cn("h-4 w-1/4 rounded", shimmerBg)}></div>
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
    <div className="flex flex-col gap-6">
      <div className={cn("h-8 w-1/3 rounded", shimmerBg)}></div>
      <div className="flex flex-col gap-4">
        <div className={cn("h-4 w-full rounded", shimmerBg)}></div>
        <div className={cn("h-4 w-5/6 rounded", shimmerBg)}></div>
        <div className={cn("h-4 w-4/6 rounded", shimmerBg)}></div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={cn("h-32 rounded-lg", shimmerBg)}></div>
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
        <div className={cn("h-6 w-48 rounded", shimmerBg)} />
      <div className={cn("rounded-lg border", borderDefaultVar, bgSurfaceVar)}>
        <div className={cn("border-b px-4 py-3", borderDefaultVar, "bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))]")}>
          <div className={cn("h-5 w-32 rounded", shimmerBg)} />
        </div>
        <div className="max-h-[600px] flex flex-col gap-2 overflow-y-auto p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("flex flex-col gap-2 border-b pb-4 last:border-b-0", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
              <div className={cn("h-12 w-full rounded", shimmerBg)} />
              <div className="ml-4 flex flex-col gap-2">
                <div className={cn("h-16 w-full rounded", shimmerBgLight)} />
                <div className={cn("h-16 w-full rounded", shimmerBgLight)} />
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
      <div className={cn("h-8 w-48 rounded", shimmerBg)} />
      <div className="flex flex-col gap-3">
          <div className={cn("h-32 w-full rounded-lg", shimmerBg)} />
          <div className={cn("h-64 w-full rounded-lg", shimmerBg)} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={cn("h-24 w-full rounded-lg", shimmerBg)} />
            <div className={cn("h-24 w-full rounded-lg", shimmerBg)} />
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
    <div className="flex flex-col gap-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className={cn("h-4 w-24 rounded", shimmerBg)} />
          <div className={cn("h-10 w-full rounded-lg", shimmerBg)} />
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
        <div className={cn("h-6 w-32 rounded", shimmerBg)} />
        <div className="flex gap-2">
          <div className={cn("h-8 w-8 rounded", shimmerBg)} />
          <div className={cn("h-8 w-8 rounded", shimmerBg)} />
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className={cn("grid grid-cols-7 border-b", borderDefaultVar)}>
        {daysOfWeek.map((day) => (
          <div key={day} className="p-2 text-center">
            <div className={cn("h-4 w-6 mx-auto rounded", shimmerBg)} />
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div>
        {Array.from({ length: weeks }).map((_, weekIndex) => (
          <div key={weekIndex} className={cn("grid grid-cols-7 border-b last:border-b-0", "border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]")}>
            {Array.from({ length: 7 }).map((_, dayIndex) => (
              <div key={dayIndex} className="min-h-[80px] p-2 border-r last:border-r-0 border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]">
                <div className={cn("h-5 w-5 mb-2 rounded", shimmerBg)} />
                {/* 일부 날짜에 이벤트 표시 */}
                {(weekIndex + dayIndex) % 3 === 0 && (
                  <div className={cn("h-4 w-full rounded", shimmerBgLight)} />
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
  return (
    <div className={cn("rounded-xl border p-6 shadow-[var(--elevation-1)]", borderDefaultVar, bgSurfaceVar)}>
      {/* 차트 제목 */}
      <div className="flex items-center justify-between mb-6">
        <div className={cn("h-6 w-32 rounded", shimmerBg)} />
        <div className="flex gap-2">
          <div className={cn("h-4 w-16 rounded", shimmerBgLight)} />
          <div className={cn("h-4 w-16 rounded", shimmerBgLight)} />
        </div>
      </div>

      {/* 차트 영역 */}
      <div>
        {type === "pie" ? (
          /* 파이 차트 */
          <div className="flex items-center justify-center">
            <div className={cn("size-48 rounded-full", shimmerBg)} />
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
                className={cn("flex-1 rounded-t", shimmerBg)}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        )}

        {/* X축 레이블 */}
        <div className="flex justify-between mt-4 pt-4 border-t border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-700))]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={cn("h-3 w-8 rounded", shimmerBgLight)} />
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="flex gap-4 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={cn("size-3 rounded", shimmerBg)} />
            <div className={cn("h-3 w-12 rounded", shimmerBgLight)} />
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
          <div className="flex flex-col gap-3">
            {/* 아이콘 및 라벨 */}
            <div className="flex items-center gap-2">
              <div className={cn("size-8 rounded-lg", shimmerBg)} />
              <div className={cn("h-4 w-16 rounded", shimmerBg)} />
            </div>
            {/* 값 */}
            <div className={cn("h-8 w-24 rounded", shimmerBg)} />
            {/* 변화율 */}
            <div className={cn("h-4 w-20 rounded", shimmerBgLight)} />
          </div>
        </div>
      ))}
    </div>
  );
}
