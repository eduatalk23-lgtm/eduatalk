"use client";

import type { AttendanceStatistics } from "@/lib/domains/attendance/types";
import { Card, CardContent, CardHeader } from "@/components/molecules/Card";

type AttendanceStatisticsProps = {
  statistics: AttendanceStatistics;
  title?: string;
};

export function AttendanceStatistics({
  statistics,
  title = "출석 통계",
}: AttendanceStatisticsProps) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">전체 일수</div>
            <div className="text-2xl font-bold text-gray-900">
              {statistics.total_days}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">출석률</div>
            <div className="text-2xl font-bold text-green-600">
              {statistics.attendance_rate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">지각률</div>
            <div className="text-2xl font-bold text-yellow-600">
              {statistics.late_rate.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm text-gray-600">결석률</div>
            <div className="text-2xl font-bold text-red-600">
              {statistics.absent_rate.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="text-center">
            <div className="text-sm text-gray-600">출석</div>
            <div className="text-lg font-semibold text-green-600">
              {statistics.present_count}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">결석</div>
            <div className="text-lg font-semibold text-red-600">
              {statistics.absent_count}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">지각</div>
            <div className="text-lg font-semibold text-yellow-600">
              {statistics.late_count}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">조퇴</div>
            <div className="text-lg font-semibold text-orange-600">
              {statistics.early_leave_count}
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">공결</div>
            <div className="text-lg font-semibold text-blue-600">
              {statistics.excused_count}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

