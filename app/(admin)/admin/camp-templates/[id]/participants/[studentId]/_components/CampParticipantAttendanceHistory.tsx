"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { ParticipantAttendanceStats } from "@/lib/domains/camp/types";

type CampParticipantAttendanceHistoryProps = {
  templateId: string;
  studentId: string;
  attendanceStats: ParticipantAttendanceStats;
};

export function CampParticipantAttendanceHistory({
  templateId,
  studentId,
  attendanceStats,
}: CampParticipantAttendanceHistoryProps) {
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">출석 이력</h2>
          <Link
            href={`/admin/students/${studentId}?tab=attendance`}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            전체 출석 이력 보기 →
          </Link>
        </div>

        {/* 통계 요약 */}
        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">출석</p>
            <p className="text-2xl font-semibold text-green-600">
              {attendanceStats.present_count}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">지각</p>
            <p className="text-2xl font-semibold text-yellow-600">
              {attendanceStats.late_count}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">결석</p>
            <p className="text-2xl font-semibold text-red-600">
              {attendanceStats.absent_count}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">조퇴</p>
            <p className="text-2xl font-semibold text-orange-600">
              {attendanceStats.early_leave_count}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-600">공결</p>
            <p className="text-2xl font-semibold text-blue-600">
              {attendanceStats.excused_count}
            </p>
          </div>
        </div>

        {/* 출석률 정보 */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">총 일수</p>
            <p className="text-lg font-semibold text-gray-900">
              {attendanceStats.total_days}일
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

