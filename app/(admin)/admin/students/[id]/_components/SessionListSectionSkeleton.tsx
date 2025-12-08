import { TableSkeleton } from "@/components/ui/LoadingSkeleton";

export function SessionListSectionSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 h-7 w-32 animate-pulse rounded bg-gray-200"></div>
      <TableSkeleton rows={5} />
    </div>
  );
}

