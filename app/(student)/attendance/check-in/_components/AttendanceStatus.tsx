"use client";

import { Card, CardContent, CardHeader } from "@/components/molecules/Card";

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_method: string | null;
  check_out_method: string | null;
  status: string;
} | null;

type AttendanceStatusProps = {
  attendance: AttendanceRecord;
};

export function AttendanceStatus({ attendance }: AttendanceStatusProps) {
  if (!attendance) {
    return (
      <Card>
        <CardHeader title="오늘 출석 상태" />
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 rounded-full bg-gray-300" />
            <span className="text-sm font-medium text-gray-700">
              출석 체크 전
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasCheckedIn = attendance.check_in_time !== null;
  const hasCheckedOut = attendance.check_out_time !== null;

  const formatTime = (timeString: string | null) => {
    if (!timeString) return "-";
    try {
      return new Date(timeString).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timeString;
    }
  };

  const getMethodLabel = (method: string | null) => {
    switch (method) {
      case "qr":
        return "QR 코드";
      case "location":
        return "위치 기반";
      case "manual":
        return "수동";
      default:
        return "-";
    }
  };

  return (
    <Card>
      <CardHeader title="오늘 출석 상태" />
      <CardContent>
        <div className="space-y-4">
          {/* 출석 상태 배지 */}
          <div className="flex items-center gap-3">
            {hasCheckedIn ? (
              <>
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700">
                  출석 완료
                </span>
              </>
            ) : (
              <>
                <div className="h-3 w-3 rounded-full bg-gray-300" />
                <span className="text-sm font-medium text-gray-700">
                  미체크
                </span>
              </>
            )}
          </div>

          {/* 입실 정보 */}
          {hasCheckedIn && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-medium text-gray-600">입실</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {formatTime(attendance.check_in_time)}
                </span>
                <span className="text-xs text-gray-500">
                  {getMethodLabel(attendance.check_in_method)}
                </span>
              </div>
            </div>
          )}

          {/* 퇴실 정보 */}
          {hasCheckedOut && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 text-xs font-medium text-gray-600">퇴실</div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-900">
                  {formatTime(attendance.check_out_time)}
                </span>
                <span className="text-xs text-gray-500">
                  {getMethodLabel(attendance.check_out_method)}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
