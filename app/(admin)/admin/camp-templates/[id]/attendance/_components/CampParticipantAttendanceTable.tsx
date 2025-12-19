"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";

type ParticipantStat = {
  student_id: string;
  student_name: string;
  attendance_rate: number;
  absent_count: number;
  late_count: number;
  present_count: number;
  early_leave_count: number;
  excused_count: number;
};

type CampParticipantAttendanceTableProps = {
  templateId: string;
  participantStats: ParticipantStat[];
};

export function CampParticipantAttendanceTable({
  templateId,
  participantStats,
}: CampParticipantAttendanceTableProps) {
  if (participantStats.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-gray-700">참여자가 없습니다.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-gray-900">
          참여자별 출석 현황
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                  이름
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  출석률
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  출석
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  지각
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  결석
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  조퇴
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  공결
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                  상세
                </th>
              </tr>
            </thead>
            <tbody>
              {participantStats.map((stat) => (
                <tr
                  key={stat.student_id}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {stat.student_name}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        stat.attendance_rate >= 90
                          ? "bg-green-100 text-green-800"
                          : stat.attendance_rate >= 70
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {stat.attendance_rate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {stat.present_count}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {stat.late_count}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {stat.absent_count}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {stat.early_leave_count}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-700">
                    {stat.excused_count}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <Link
                      href={`/admin/students/${stat.student_id}?tab=attendance`}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

