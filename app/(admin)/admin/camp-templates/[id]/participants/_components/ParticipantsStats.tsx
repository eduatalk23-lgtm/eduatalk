import type { ParticipantsStats, Participant } from "./types";

type ParticipantsStatsProps = {
  stats: ParticipantsStats;
  participants: Participant[];
  needsActionCount: number;
};

export default function ParticipantsStats({
  stats,
  participants,
  needsActionCount,
}: ParticipantsStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">전체</div>
        <div className="text-2xl font-semibold text-gray-900">
          {stats.total}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">수락</div>
        <div className="text-2xl font-semibold text-green-600">
          {stats.accepted}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">대기중</div>
        <div className="text-2xl font-semibold text-yellow-600">
          {stats.pending}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">거절</div>
        <div className="text-2xl font-semibold text-red-600">
          {stats.declined}
        </div>
      </div>
      <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-sm text-gray-600">플랜 생성 완료</div>
        <div className="text-2xl font-semibold text-blue-600">
          {participants.filter((p) => p.hasPlans).length}
        </div>
      </div>
      <div
        className={`flex flex-col gap-1 rounded-lg border p-4 ${
          needsActionCount > 0
            ? "border-orange-200 bg-orange-50"
            : "border-gray-200 bg-white"
        }`}
      >
        <div className="text-sm text-gray-600">작업 필요</div>
        <div
          className={`text-2xl font-semibold ${
            needsActionCount > 0
              ? "text-orange-600"
              : "text-gray-900"
          }`}
        >
          {stats.needsAction}
        </div>
      </div>
    </div>
  );
}

