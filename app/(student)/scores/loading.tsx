import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { getContainerClass } from "@/lib/constants/layout";

export default function ScoresLoading() {
  return (
    <div className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col items-center justify-center gap-4 py-12">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            성적 대시보드로 이동 중...
          </p>
        </div>
        <SuspenseFallback />
      </div>
    </div>
  );
}
