export function AnalysisReportSectionSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 h-7 w-32 animate-pulse rounded bg-gray-200"></div>
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-gray-50 p-4">
            <div className="mb-2 h-4 w-32 animate-pulse rounded bg-gray-200"></div>
            <div className="mb-2 h-8 w-24 animate-pulse rounded bg-gray-200"></div>
            <div className="h-3 w-40 animate-pulse rounded bg-gray-200"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
