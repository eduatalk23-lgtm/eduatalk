"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import Button from "@/components/atoms/Button";
import { useToast } from "@/components/ui/ToastProvider";
import type { ParticipantAttendanceStats } from "@/lib/domains/camp/types";
import { getAttendanceByStudentAction } from "@/lib/domains/attendance/actions/attendance";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/domains/attendance/types";
import { CampAttendanceInputModal } from "./CampAttendanceInputModal";

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  notes: string | null;
};

type CampParticipantAttendanceHistoryProps = {
  templateId: string;
  studentId: string;
  studentName: string;
  attendanceStats: ParticipantAttendanceStats;
};

export function CampParticipantAttendanceHistory({
  templateId,
  studentId,
  studentName,
  attendanceStats,
}: CampParticipantAttendanceHistoryProps) {
  const router = useRouter();
  const { showError } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAttendanceByStudentAction(studentId);
      if (result.success && result.data) {
        setRecords(result.data);
      }
    } catch {
      showError("출석 기록을 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [studentId, showError]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleAddSuccess = () => {
    fetchRecords();
    router.refresh();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800";
      case "late":
        return "bg-yellow-100 text-yellow-800";
      case "absent":
        return "bg-red-100 text-red-800";
      case "early_leave":
        return "bg-orange-100 text-orange-800";
      case "excused":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    return timeString.slice(0, 5);
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              출석 이력
            </h2>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddModalOpen(true)}
              >
                + 출석 추가
              </Button>
              <Link
                href={`/admin/students/${studentId}?tab=attendance`}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                전체 이력 →
              </Link>
            </div>
          </div>

          {/* 통계 요약 */}
          <div className="grid gap-4 md:grid-cols-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">출석</p>
              <p className="text-2xl font-semibold text-green-600">
                {attendanceStats.present_count}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">지각</p>
              <p className="text-2xl font-semibold text-yellow-600">
                {attendanceStats.late_count}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">결석</p>
              <p className="text-2xl font-semibold text-red-600">
                {attendanceStats.absent_count}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">조퇴</p>
              <p className="text-2xl font-semibold text-orange-600">
                {attendanceStats.early_leave_count}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">공결</p>
              <p className="text-2xl font-semibold text-blue-600">
                {attendanceStats.excused_count}
              </p>
            </div>
          </div>

          {/* 출석률 정보 */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">총 일수</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {attendanceStats.total_days}일
              </p>
            </div>
          </div>

          {/* 최근 출석 기록 목록 */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              최근 출석 기록
            </h3>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
              </div>
            ) : records.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  출석 기록이 없습니다.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        날짜
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        상태
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        입실
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        퇴실
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        관리
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {records.slice(0, 10).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {formatDate(record.attendance_date)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(record.status)}`}
                          >
                            {ATTENDANCE_STATUS_LABELS[record.status as keyof typeof ATTENDANCE_STATUS_LABELS] || record.status}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(record.check_in_time)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(record.check_out_time)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            href={`/admin/attendance/${record.id}/edit`}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            수정
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length > 10 && (
                  <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-center dark:border-gray-700 dark:bg-gray-800">
                    <Link
                      href={`/admin/students/${studentId}?tab=attendance`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      전체 {records.length}개 기록 보기 →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 출석 추가 모달 */}
      <CampAttendanceInputModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        studentId={studentId}
        studentName={studentName}
        onSuccess={handleAddSuccess}
      />
    </>
  );
}

