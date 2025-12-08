import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export function ContentListSectionSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
