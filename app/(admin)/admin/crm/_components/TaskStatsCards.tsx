import StatCard from "@/components/molecules/StatCard";

type TaskStatsCardsProps = {
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
};

export function TaskStatsCards({
  pending,
  inProgress,
  completed,
  overdue,
}: TaskStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="대기" value={pending} color="amber" />
      <StatCard label="진행중" value={inProgress} color="blue" />
      <StatCard label="완료" value={completed} color="green" />
      <StatCard label="기한초과" value={overdue} color="red" />
    </div>
  );
}
