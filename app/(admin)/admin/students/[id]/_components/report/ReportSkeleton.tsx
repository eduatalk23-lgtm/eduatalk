export function ReportSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-8 p-8">
      {/* Cover */}
      <div className="flex flex-col items-center gap-4 py-20">
        <div className="h-8 w-64 rounded bg-bg-tertiary" />
        <div className="h-6 w-48 rounded bg-bg-tertiary" />
        <div className="h-4 w-32 rounded bg-bg-tertiary" />
      </div>

      {/* Sections */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-3">
          <div className="h-6 w-40 rounded bg-bg-tertiary" />
          <div className="h-4 w-full rounded bg-bg-tertiary" />
          <div className="h-4 w-3/4 rounded bg-bg-tertiary" />
          <div className="h-32 w-full rounded bg-bg-secondary" />
        </div>
      ))}
    </div>
  );
}
