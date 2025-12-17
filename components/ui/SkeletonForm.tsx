/**
 * 폼 로딩 스켈레톤 UI
 */
export function SkeletonForm() {
  return (
    <div className="animate-pulse flex flex-col gap-4">
      {[1, 2, 3, 4, 5, 6, 7].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
          <div className="h-10 w-full bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded-lg" />
        </div>
      ))}
    </div>
  );
}

