import { TableSkeleton } from "@/components/ui/LoadingSkeleton";

export function SessionListSectionSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-7 w-32 animate-pulse rounded bg-gray-200"></div>
      <TableSkeleton rows={5} />
    </div>
  );
}
