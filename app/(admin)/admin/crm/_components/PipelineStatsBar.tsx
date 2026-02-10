import StatCard from "@/components/molecules/StatCard";
import type { StatCardColor } from "@/components/molecules/StatCard";
import { PIPELINE_STATUS_LABELS, PIPELINE_STATUS_ORDER } from "@/lib/domains/crm/constants";
import type { PipelineStats } from "@/lib/domains/crm/types";

const statusColorMap: Record<string, StatCardColor> = {
  new: "blue",
  contacted: "cyan",
  consulting_done: "teal",
  follow_up: "amber",
  registration_in_progress: "purple",
  converted: "emerald",
  lost: "red",
  spam: "pink",
};

type PipelineStatsBarProps = {
  stats: PipelineStats[];
  overdueCount: number;
  myPendingCount: number;
};

export function PipelineStatsBar({
  stats,
  overdueCount,
  myPendingCount,
}: PipelineStatsBarProps) {
  const countMap = new Map(stats.map((s) => [s.status, s.count]));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {PIPELINE_STATUS_ORDER.map((status) => (
          <StatCard
            key={status}
            label={PIPELINE_STATUS_LABELS[status]}
            value={countMap.get(status) ?? 0}
            color={statusColorMap[status] ?? "blue"}
          />
        ))}
      </div>
      {(overdueCount > 0 || myPendingCount > 0) && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overdueCount > 0 && (
            <StatCard label="기한초과 태스크" value={overdueCount} color="red" />
          )}
          {myPendingCount > 0 && (
            <StatCard label="내 대기 태스크" value={myPendingCount} color="amber" />
          )}
        </div>
      )}
    </div>
  );
}
