"use client";

export function TabLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
      <div className="space-y-3">
        <div className="h-32 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="h-64 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="h-24 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

