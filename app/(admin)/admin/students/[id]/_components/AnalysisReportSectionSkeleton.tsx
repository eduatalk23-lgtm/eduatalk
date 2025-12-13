export function AnalysisReportSectionSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-7 w-32 animate-pulse rounded bg-gray-200"></div>
      <div className="flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg bg-gray-50 p-4">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200"></div>
            <div className="h-8 w-24 animate-pulse rounded bg-gray-200"></div>
            <div className="h-3 w-40 animate-pulse rounded bg-gray-200"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
