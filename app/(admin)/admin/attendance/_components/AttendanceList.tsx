"use client";

import Link from "next/link";
import type { AttendanceRecord } from "@/lib/domains/attendance/types";
import {
  ATTENDANCE_STATUS_LABELS,
  CHECK_METHOD_LABELS,
} from "@/lib/domains/attendance/types";

type AttendanceListProps = {
  records: AttendanceRecord[];
  studentMap: Map<string, string>;
  onDelete?: (recordId: string, studentId: string) => void;
};

export function AttendanceList({
  records,
  studentMap,
  onDelete,
}: AttendanceListProps) {
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800";
      case "late":
        return "bg-yellow-100 text-yellow-800";
      case "early_leave":
        return "bg-orange-100 text-orange-800";
      case "absent":
        return "bg-red-100 text-red-800";
      case "excused":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-500">출석 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {records.map((record) => {
        const studentName = studentMap.get(record.student_id) ?? "이름 없음";
        return (
          <div
            key={record.id}
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/students/${record.student_id}`}
                  className="font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {studentName}
                </Link>
                <span className="text-sm text-gray-500">
                  {record.attendance_date}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(record.status)}`}
                >
                  {ATTENDANCE_STATUS_LABELS[record.status as keyof typeof ATTENDANCE_STATUS_LABELS]}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/attendance/${record.id}/edit`}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  수정
                </Link>
                {onDelete && (
                  <button
                    onClick={() => onDelete(record.id, record.student_id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-sm text-gray-600">
              {record.check_in_time && (
                <div>
                  입실: {new Date(record.check_in_time).toLocaleTimeString("ko-KR")}
                  {record.check_in_method &&
                    ` (${CHECK_METHOD_LABELS[record.check_in_method]})`}
                </div>
              )}
              {record.check_out_time && (
                <div>
                  퇴실: {new Date(record.check_out_time).toLocaleTimeString("ko-KR")}
                  {record.check_out_method &&
                    ` (${CHECK_METHOD_LABELS[record.check_out_method]})`}
                </div>
              )}
              {record.notes && (
                <div className="text-gray-700">{record.notes}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

