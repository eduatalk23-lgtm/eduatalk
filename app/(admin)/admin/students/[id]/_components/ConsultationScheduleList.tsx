"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  textPrimary,
  textSecondary,
  borderDefault,
  borderInput,
  bgSurface,
} from "@/lib/utils/darkMode";
import {
  type ConsultationSchedule,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  SESSION_TYPE_COLORS,
  SESSION_TYPES,
  type SessionType,
} from "@/lib/domains/consulting/types";
import {
  updateScheduleStatus,
  updateConsultationSchedule,
  deleteConsultationSchedule,
} from "@/lib/domains/consulting/actions/schedule";

type EnrollmentOption = { id: string; program_name: string };
type ConsultantOption = { id: string; name: string };

type ConsultationScheduleListProps = {
  schedules: ConsultationSchedule[];
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
};

export function ConsultationScheduleList({
  schedules,
  studentId,
  consultants,
  enrollments,
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
          consultants={consultants}
          enrollments={enrollments}
        />
      ))}
    </div>
  );
}

function ScheduleCard({
  schedule,
  studentId,
  consultants,
  enrollments,
}: {
  schedule: ConsultationSchedule;
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  function handleDelete(sendNotification: boolean) {
    startTransition(async () => {
      await deleteConsultationSchedule({
        scheduleId: schedule.id,
        studentId,
        sendNotification,
      });
      router.refresh();
    });
  }

  const dateStr = formatDate(schedule.scheduled_date);
  const timeStr = `${schedule.start_time.slice(0, 5)}~${schedule.end_time.slice(0, 5)}`;

  if (isEditing) {
    return (
      <EditScheduleForm
        schedule={schedule}
        studentId={studentId}
        consultants={consultants}
        enrollments={enrollments}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

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
        <div className="flex flex-wrap items-center gap-2">
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
          {schedule.reminder_sent && (
            <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
              리마인더 발송됨
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        {schedule.status === "scheduled" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
            >
              수정
            </button>
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
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={isPending}
              className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/30"
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 삭제 확인 */}
      {confirmDelete && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <span className={cn("text-xs font-medium", textPrimary)}>
            이 일정을 삭제하시겠습니까?
          </span>
          <button
            type="button"
            onClick={() => handleDelete(true)}
            disabled={isPending}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
          >
            {isPending ? "삭제 중..." : "삭제 + 알림"}
          </button>
          <button
            type="button"
            onClick={() => handleDelete(false)}
            disabled={isPending}
            className="rounded bg-red-100 px-3 py-1 text-xs font-medium text-red-700 transition hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
          >
            알림 없이 삭제
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            disabled={isPending}
            className="rounded px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400"
          >
            취소
          </button>
        </div>
      )}

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

// ── 수정 폼 ──

function EditScheduleForm({
  schedule,
  studentId,
  consultants,
  enrollments,
  onCancel,
}: {
  schedule: ConsultationSchedule;
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendNotification, setSendNotification] = useState(true);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(
    schedule.enrollment_id ?? ""
  );

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );
  const labelClass = cn("text-xs font-medium", textSecondary);

  const selectedProgramName = enrollments.find(
    (e) => e.id === selectedEnrollmentId
  )?.program_name;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const consultantId = formData.get("consultant_id") as string;
    const sessionType = formData.get("session_type") as SessionType;
    const scheduledDate = formData.get("scheduled_date") as string;
    const startTime = formData.get("start_time") as string;
    const endTime = formData.get("end_time") as string;
    const visitor = (formData.get("visitor") as string) || undefined;
    const location = (formData.get("location") as string) || undefined;
    const description = (formData.get("description") as string) || undefined;

    if (!consultantId || !scheduledDate || !startTime || !endTime) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await updateConsultationSchedule({
        scheduleId: schedule.id,
        studentId,
        consultantId,
        sessionType,
        enrollmentId: selectedEnrollmentId || undefined,
        programName: selectedProgramName,
        scheduledDate,
        startTime,
        endTime,
        visitor,
        location,
        description,
        sendNotification,
      });

      if (result.success) {
        onCancel();
        router.refresh();
      } else {
        setError(result.error ?? "수정에 실패했습니다.");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-3 rounded-lg border-2 border-indigo-300 p-4 dark:border-indigo-700",
        bgSurface
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("text-sm font-semibold", textPrimary)}>
          일정 수정
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="rounded px-2 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          취소
        </button>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 유형</label>
          <select
            name="session_type"
            defaultValue={schedule.session_type}
            className={inputClass}
          >
            {SESSION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>관련 프로그램</label>
          <select
            value={selectedEnrollmentId}
            onChange={(e) => setSelectedEnrollmentId(e.target.value)}
            className={inputClass}
          >
            <option value="">선택 안 함</option>
            {enrollments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.program_name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>담당 컨설턴트</label>
          <select
            name="consultant_id"
            defaultValue={schedule.consultant_id}
            required
            className={inputClass}
          >
            <option value="">선택</option>
            {consultants.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담일</label>
          <input
            type="date"
            name="scheduled_date"
            defaultValue={schedule.scheduled_date}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>시작 시간</label>
          <input
            type="time"
            name="start_time"
            defaultValue={schedule.start_time.slice(0, 5)}
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>종료 시간</label>
          <input
            type="time"
            name="end_time"
            defaultValue={schedule.end_time.slice(0, 5)}
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>방문 상담자</label>
          <input
            type="text"
            name="visitor"
            defaultValue={schedule.visitor ?? ""}
            placeholder="학생 & 학부모"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 장소</label>
          <input
            type="text"
            name="location"
            defaultValue={schedule.location ?? ""}
            placeholder="미입력 시 학원 주소 사용"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>메모</label>
          <input
            type="text"
            name="description"
            defaultValue={schedule.description ?? ""}
            placeholder="상담 내용/목적"
            className={inputClass}
          />
        </div>
      </div>

      {/* 알림 + 저장 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={(e) => setSendNotification(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className={cn("text-xs", textSecondary)}>
            일정 변경 시 학부모에게 알림 발송
          </span>
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              "rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700",
              isPending && "cursor-not-allowed opacity-60"
            )}
          >
            {isPending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
    </form>
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
