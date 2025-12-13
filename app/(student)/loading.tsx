import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";

export default function Loading() {
  return (
    <div className={getContainerClass("DASHBOARD", "lg")}>
      <LoadingSkeleton />
    </div>
  );
}

