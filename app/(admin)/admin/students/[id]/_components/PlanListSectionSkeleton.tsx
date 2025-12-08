import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export function PlanListSectionSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-7 w-24 animate-pulse rounded bg-gray-200"></div>
        <div className="h-5 w-20 animate-pulse rounded bg-gray-200"></div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
