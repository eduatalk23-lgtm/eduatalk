import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 flex flex-col gap-6">
      <LoadingSkeleton variant="stats" />
      <LoadingSkeleton variant="table" />
    </div>
  );
}
