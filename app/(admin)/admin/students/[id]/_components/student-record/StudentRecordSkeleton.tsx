export function StudentRecordSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Year selector skeleton */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>

      {/* Sub-tabs skeleton */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>

      {/* Editor area skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <div className="space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-24 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
