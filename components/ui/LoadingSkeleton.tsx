import { bgSurfaceVar, borderDefaultVar } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

/**
 * Suspense fallback 전용 로딩 컴포넌트
 * Suspense 경계에서 사용되는 기본 로딩 상태
 */
export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="animate-pulse flex flex-col gap-4 w-full max-w-md">
        <div className="h-4 w-3/4 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
        <div className="h-4 w-1/2 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
        <div className="h-4 w-5/6 rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] mx-auto"></div>
      </div>
    </div>
  );
}

/**
 * 기본 로딩 스켈레톤
 */
export function LoadingSkeleton({ variant = "default" }: { variant?: "default" | "card" | "table" | "page" | "schedule" | "tab" | "form" }) {
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
          <div key={i} className={cn("border-b p-4", "border-gray-100 dark:border-gray-700")}>
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
        <div className={cn("border-b px-4 py-3", borderDefaultVar, "bg-gray-50 dark:bg-gray-800")}>
          <div className="h-5 w-32 animate-pulse rounded bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
        </div>
        <div className="max-h-[600px] flex flex-col gap-2 overflow-y-auto p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn("flex flex-col gap-2 border-b pb-4 last:border-b-0", "border-gray-100 dark:border-gray-700")}>
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
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
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

