export function StudentRecordSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Year selector skeleton */}
      <div className="flex gap-1 rounded-lg bg-bg-tertiary p-1 dark:bg-bg-secondary">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-24 animate-pulse rounded-md bg-bg-tertiary dark:bg-bg-tertiary" />
        ))}
      </div>

      {/* Sub-tabs skeleton */}
      <div className="flex gap-1 rounded-lg bg-bg-tertiary p-1 dark:bg-bg-secondary">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-16 animate-pulse rounded-md bg-bg-tertiary dark:bg-bg-tertiary" />
        ))}
      </div>

      {/* Editor area skeleton */}
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-white p-4 dark:border-border dark:bg-bg-primary">
            <div className="space-y-3">
              <div className="h-4 w-1/3 animate-pulse rounded bg-bg-tertiary dark:bg-bg-tertiary" />
              <div className="h-24 w-full animate-pulse rounded bg-bg-tertiary dark:bg-bg-tertiary" />
              <div className="h-3 w-20 animate-pulse rounded bg-bg-tertiary dark:bg-bg-tertiary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
