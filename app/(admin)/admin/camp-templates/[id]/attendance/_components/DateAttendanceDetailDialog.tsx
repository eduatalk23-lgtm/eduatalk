"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useCampDateAttendance } from "@/lib/hooks/useCampStats";
import { SuspenseFallback } from "@/components/ui/LoadingSkeleton";
import { ATTENDANCE_STATUS_LABELS, CHECK_METHOD_LABELS } from "@/lib/domains/attendance/types";
import type { AttendanceStatus, CheckMethod } from "@/lib/domains/attendance/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

type DateAttendanceDetailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  date: string | null; // YYYY-MM-DD
};

/**
 * 출석 상태별 배지 색상
 */
function getStatusBadgeVariant(status: AttendanceStatus): "success" | "warning" | "error" | "info" {
  switch (status) {
    case "present":
      return "success";
    case "late":
      return "warning";
    case "absent":
      return "error";
    case "early_leave":
      return "warning";
    case "excused":
      return "info";
    default:
      return "info";
  }
}

/**
 * 시간 포맷팅 (ISO 8601 → HH:mm)
 */
function formatTime(time: string | null): string {
  if (!time) return "-";
  try {
    return format(new Date(time), "HH:mm");
  } catch {
    return time;
  }
}

export function DateAttendanceDetailDialog({
  open,
  onOpenChange,
  templateId,
  date,
}: DateAttendanceDetailDialogProps) {
  const { data: records, isLoading } = useCampDateAttendance(
    templateId,
    date || "",
    { enabled: open && !!date }
  );

  const formattedDate = date ? format(new Date(date), "yyyy년 M월 d일 (E)", { locale: ko }) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${formattedDate} 출석 상세`}
      description={`해당 날짜의 모든 참여자 출석 정보를 확인할 수 있습니다.`}
      size="3xl"
      showCloseButton={true}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        {isLoading ? (
          <SuspenseFallback />
        ) : !records || records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              해당 날짜에 출석 기록이 없습니다.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* 출석 기록 목록 */}
            <div className="flex flex-col gap-3">
              {records.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"
                >
                  {/* 학생 이름 및 상태 */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {record.student_name || "이름 없음"}
                    </h4>
                    <Badge variant={getStatusBadgeVariant(record.status)}>
                      {ATTENDANCE_STATUS_LABELS[record.status]}
                    </Badge>
                  </div>

                  {/* 입실 정보 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        입실 시간
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatTime(record.check_in_time)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        입실 방법
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {record.check_in_method
                          ? CHECK_METHOD_LABELS[record.check_in_method as CheckMethod]
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* 퇴실 정보 */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        퇴실 시간
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {formatTime(record.check_out_time)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        퇴실 방법
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {record.check_out_method
                          ? CHECK_METHOD_LABELS[record.check_out_method as CheckMethod]
                          : "-"}
                      </p>
                    </div>
                  </div>

                  {/* 메모 */}
                  {record.notes && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        메모
                      </label>
                      <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                        {record.notes}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 통계 요약 */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                총 {records.length}명의 출석 기록
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

