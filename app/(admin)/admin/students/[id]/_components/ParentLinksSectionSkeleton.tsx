export function ParentLinksSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

