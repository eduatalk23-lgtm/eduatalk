"use client";

import { Card } from "@/components/ui/Card";
import type { ParticipantAttendanceStats } from "@/lib/domains/camp/types";
import type { ParticipantLearningStats } from "@/lib/domains/camp/types";

type CampParticipantStatsCardsProps = {
  attendanceStats: ParticipantAttendanceStats | null;
  learningStats: ParticipantLearningStats | null;
};

export function CampParticipantStatsCards({
  attendanceStats,
  learningStats,
}: CampParticipantStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">출석률</p>
          <p className="text-2xl font-semibold text-gray-900">
            {attendanceStats?.attendance_rate.toFixed(1) ?? "—"}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {learningStats?.study_minutes
              ? `${Math.floor(learningStats.study_minutes / 60)}시간 ${learningStats.study_minutes % 60}분`
              : "—"}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">플랜 완료율</p>
          <p className="text-2xl font-semibold text-gray-900">
            {learningStats?.plan_completion_rate ?? "—"}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">완료된 플랜</p>
          <p className="text-2xl font-semibold text-gray-900">
            {learningStats
              ? `${learningStats.completed_plans} / ${learningStats.total_plans}`
              : "—"}
          </p>
        </div>
      </Card>
    </div>
  );
}

