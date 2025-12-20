"use client";

import type {
  CampAttendanceStats,
  CampLearningStats,
} from "@/lib/domains/camp/types";
import { Card } from "@/components/ui/Card";

type CampReportSummaryCardsProps = {
  attendanceStats: CampAttendanceStats | null;
  learningStats: CampLearningStats | null;
};

export function CampReportSummaryCards({
  attendanceStats,
  learningStats,
}: CampReportSummaryCardsProps) {

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 참여자</p>
          <p className="text-2xl font-semibold text-gray-900">
            {attendanceStats?.total_participants || learningStats?.participant_stats.length || 0}명
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">출석률</p>
          <p className="text-2xl font-semibold text-gray-900">
            {attendanceStats?.attendance_rate.toFixed(1) || "0.0"}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {learningStats?.total_study_minutes
              ? `${Math.floor(learningStats.total_study_minutes / 60)}시간 ${learningStats.total_study_minutes % 60}분`
              : "0시간 0분"}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">평균 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {learningStats?.average_study_minutes_per_participant
              ? `${Math.floor(learningStats.average_study_minutes_per_participant / 60)}시간 ${learningStats.average_study_minutes_per_participant % 60}분`
              : "0시간 0분"}
          </p>
        </div>
      </Card>
    </div>
  );
}

