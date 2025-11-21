/**
 * 폼 로딩 스켈레톤 UI
 */
export function SkeletonForm() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-200 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

