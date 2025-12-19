"use client";

import type { CampAttendanceStats } from "@/lib/domains/camp/types";
import { Card } from "@/components/ui/Card";

type CampAttendanceStatsCardsProps = {
  stats: CampAttendanceStats;
};

export function CampAttendanceStatsCards({
  stats,
}: CampAttendanceStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 참여자</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.total_participants}명
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 일수</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.total_days}일
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">출석률</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.attendance_rate.toFixed(1)}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">지각률</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.late_rate.toFixed(1)}%
          </p>
        </div>
      </Card>
    </div>
  );
}

