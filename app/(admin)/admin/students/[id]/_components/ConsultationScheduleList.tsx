"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  borderDefault,
} from "@/lib/utils/darkMode";
import {
  type ConsultationSchedule,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  SESSION_TYPE_COLORS,
  type SessionType,
} from "@/lib/domains/consulting/types";
import { updateScheduleStatus } from "@/lib/domains/consulting/actions/schedule";

type ConsultationScheduleListProps = {
  schedules: ConsultationSchedule[];
  studentId: string;
};

export function ConsultationScheduleList({
  schedules,
  studentId,
}: ConsultationScheduleListProps) {
  if (schedules.length === 0) {
    return (
      <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
        <p className={cn("text-sm font-medium", textPrimary)}>
          등록된 상담 일정이 없습니다.
        </p>
        <p className={cn("text-xs", textSecondary)}>
          위 폼에서 일정을 등록하면 여기에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {schedules.map((schedule) => (
        <ScheduleCard
          key={schedule.id}
          schedule={schedule}
          studentId={studentId}
        />
      ))}
    </div>
  );
}

function ScheduleCard({
  schedule,
  studentId,
}: {
  schedule: ConsultationSchedule;
  studentId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const sessionType = schedule.session_type as SessionType;
  const sessionColor =
    SESSION_TYPE_COLORS[sessionType] ?? SESSION_TYPE_COLORS["기타"];
  const statusColor = SCHEDULE_STATUS_COLORS[schedule.status];
  const statusLabel = SCHEDULE_STATUS_LABELS[schedule.status];

  function handleStatusChange(newStatus: "completed" | "cancelled" | "no_show") {
    startTransition(async () => {
      await updateScheduleStatus(schedule.id, newStatus, studentId);
      router.refresh();
    });
  }

  const dateStr = formatDate(schedule.scheduled_date);
  const timeStr = `${schedule.start_time.slice(0, 5)}~${schedule.end_time.slice(0, 5)}`;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 transition",
        borderDefault,
        "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/50 dark:hover:bg-gray-800"
      )}
    >
      {/* Header: 유형 + 상태 + 알림 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              sessionColor
            )}
          >
            {sessionType}
          </span>
          {schedule.program_name && (
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {schedule.program_name}
            </span>
          )}
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              statusColor
            )}
          >
            {statusLabel}
          </span>
          {schedule.notification_sent && (
            <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
              알림 발송됨
            </span>
          )}
        </div>

        {/* 상태 변경 버튼 */}
        {schedule.status === "scheduled" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStatusChange("completed")}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs font-medium text-green-700 transition hover:bg-green-100 dark:text-green-400 dark:hover:bg-green-900/30"
            >
              완료
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("no_show")}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              미참석
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange("cancelled")}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              취소
            </button>
          </div>
        )}
      </div>

      {/* 본문: 일정 정보 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={cn("text-sm font-medium", textPrimary)}>
          {dateStr} {timeStr}
        </span>
        {schedule.duration_minutes && (
          <span className={cn("text-xs", textSecondary)}>
            {schedule.duration_minutes}분
          </span>
        )}
        {schedule.consultant_name && (
          <span className={cn("text-xs", textSecondary)}>
            컨설턴트: {schedule.consultant_name}
          </span>
        )}
      </div>

      {/* 상세 정보 */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {schedule.visitor && (
          <span className={cn("text-xs", textSecondary)}>
            방문자: {schedule.visitor}
          </span>
        )}
        {schedule.location && (
          <span className={cn("text-xs", textSecondary)}>
            장소: {schedule.location}
          </span>
        )}
      </div>

      {schedule.description && (
        <p className={cn("text-xs whitespace-pre-wrap", textSecondary)}>
          {schedule.description}
        </p>
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}
