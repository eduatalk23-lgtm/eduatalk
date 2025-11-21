"use client";

type PlanGroupStatsCardProps = {
  totalGroups: number;
  activeCount: number;
  pausedCount: number;
  completedCount: number;
};

export function PlanGroupStatsCard({
  totalGroups,
  activeCount,
  pausedCount,
  completedCount,
}: PlanGroupStatsCardProps) {
  if (totalGroups === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col">
          <dt className="text-xs font-medium text-gray-500">전체</dt>
          <dd className="mt-1 text-2xl font-semibold text-gray-900">{totalGroups}개</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs font-medium text-gray-500">활성</dt>
          <dd className="mt-1 text-2xl font-semibold text-green-600">{activeCount}개</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs font-medium text-gray-500">일시정지</dt>
          <dd className="mt-1 text-2xl font-semibold text-yellow-600">{pausedCount}개</dd>
        </div>
        <div className="flex flex-col">
          <dt className="text-xs font-medium text-gray-500">완료</dt>
          <dd className="mt-1 text-2xl font-semibold text-purple-600">{completedCount}개</dd>
        </div>
      </div>
    </div>
  );
}

