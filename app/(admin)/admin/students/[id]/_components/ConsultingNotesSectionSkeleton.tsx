import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export function ConsultingNotesSectionSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 h-7 w-32 animate-pulse rounded bg-gray-200"></div>
      <div className="mb-6">
        <div className="h-24 w-full animate-pulse rounded-lg bg-gray-100"></div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

