import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export function TimeManagementSectionSkeleton() {
  return (
    <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* 서브탭 스켈레톤 */}
      <div className="flex gap-4 border-b border-gray-200 pb-2">
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
      </div>

      {/* 헤더 스켈레톤 */}
      <div className="flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-9 w-20 animate-pulse rounded bg-gray-200" />
      </div>

      {/* 콘텐츠 스켈레톤 */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
