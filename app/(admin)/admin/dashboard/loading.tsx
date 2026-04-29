import { LoadingSkeleton } from "@/components/ui/LoadingSkeleton";

/**
 * Dashboard skeleton — 실제 page.tsx grid 형상과 1:1 매칭
 * (KPI 4 + Top 리스트 3 + 위험 + 상담 + 옵션 카드 그룹들)
 */
export default function Loading() {
  return (
    <div className="p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-6 md:gap-8">
        {/* PageHeader skeleton */}
        <div className="h-10 w-64 rounded-lg bg-bg-secondary animate-pulse" />

        {/* KPI 4 카드 */}
        <LoadingSkeleton variant="stats" />

        {/* Top5 학습시간 + 플랜 + 목표 + 위험 + 상담 — 5개 list 카드 */}
        <LoadingSkeleton variant="table" />
        <LoadingSkeleton variant="table" />
        <LoadingSkeleton variant="table" />
      </div>
    </div>
  );
}
