export function FamilySectionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="space-y-3">
        <div className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
