import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export function PlanListSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="h-7 w-24 animate-pulse rounded bg-bg-tertiary"></div>
        <div className="h-5 w-20 animate-pulse rounded bg-bg-tertiary"></div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
