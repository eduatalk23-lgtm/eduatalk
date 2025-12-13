"use client";

export function ScheduleLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
      <div className="flex flex-col rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
        </div>
        <div className="flex max-h-[600px] flex-col gap-2 overflow-y-auto p-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col gap-2 border-b border-gray-100 pb-4 last:border-b-0">
              <div className="h-12 w-full animate-pulse rounded bg-gray-100" />
              <div className="flex flex-col gap-2 pl-4">
                <div className="h-16 w-full animate-pulse rounded bg-gray-50" />
                <div className="h-16 w-full animate-pulse rounded bg-gray-50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

