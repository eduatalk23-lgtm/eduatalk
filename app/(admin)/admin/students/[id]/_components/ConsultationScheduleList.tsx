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
  type ConsultationMode,
  type NotificationTarget,
  type NotificationLogEntry,
  type NotificationChannel,
  SCHEDULE_STATUS_LABELS,
  SCHEDULE_STATUS_COLORS,
  SESSION_TYPE_COLORS,
  SESSION_TYPE_PRESETS,
  CONSULTATION_MODES,
  NOTIFICATION_TARGETS,
  NOTIFICATION_TARGET_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  type SessionType,
} from "@/lib/domains/consulting/types";
import { Combobox } from "@/components/ui/Combobox";
import {
  updateScheduleStatus,
  updateConsultationSchedule,
  deleteConsultationSchedule,
} from "@/lib/domains/consulting/actions/schedule";
import type { PhoneAvailability } from "./ConsultationScheduleForm";

type EnrollmentOption = { id: string; program_name: string };
type ConsultantOption = { id: string; name: string };

const PHONE_KEY_MAP: Record<NotificationTarget, keyof PhoneAvailability> = {
  student: "student",
  mother: "mother",
  father: "father",
};

type ConsultationScheduleListProps = {
  schedules: ConsultationSchedule[];
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
  phoneAvailability: PhoneAvailability;
  notificationLogs: Record<string, NotificationLogEntry[]>;
};

export function ConsultationScheduleList({
  schedules,
  studentId,
  consultants,
  enrollments,
  phoneAvailability,
  notificationLogs,
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
          phoneAvailability={phoneAvailability}
          logs={notificationLogs[schedule.id]}
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
  phoneAvailability,
  logs,
}: {
  schedule: ConsultationSchedule;
  studentId: string;
  consultants: ConsultantOption[];
  enrollments: EnrollmentOption[];
  phoneAvailability: PhoneAvailability;
  logs?: NotificationLogEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelChannel, setCancelChannel] = useState<NotificationChannel>("alimtalk");
  const [showLogs, setShowLogs] = useState(false);

  const sessionType = schedule.session_type as SessionType;
  const sessionColor =
    SESSION_TYPE_COLORS[sessionType] ?? SESSION_TYPE_COLORS["기타"];
  const statusColor = SCHEDULE_STATUS_COLORS[schedule.status];
  const statusLabel = SCHEDULE_STATUS_LABELS[schedule.status];

  function handleStatusChange(newStatus: "completed" | "no_show") {
    startTransition(async () => {
      await updateScheduleStatus(schedule.id, newStatus, studentId);
      router.refresh();
    });
  }

  function handleCancel(sendNotification: boolean, channel?: NotificationChannel) {
    startTransition(async () => {
      await updateScheduleStatus(schedule.id, "cancelled", studentId, sendNotification, channel);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteConsultationSchedule({
        scheduleId: schedule.id,
        studentId,
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
        phoneAvailability={phoneAvailability}
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
          {schedule.consultation_mode === "원격" && (
            <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              원격
            </span>
          )}
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
          {schedule.notification_targets?.length > 0 && (
            <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              알림: {schedule.notification_targets.map((t) => NOTIFICATION_TARGET_LABELS[t]).join(", ")}
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
              onClick={() => setConfirmCancel(true)}
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

      {/* 취소 확인 */}
      {confirmCancel && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-medium", textPrimary)}>
              이 일정을 취소하시겠습니까?
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-xs font-medium", textSecondary)}>발송 채널</span>
            {NOTIFICATION_CHANNELS.map((ch) => (
              <label key={ch} className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={cancelChannel === ch}
                  onChange={() => setCancelChannel(ch)}
                  className="h-3.5 w-3.5 border-gray-300 text-amber-600 focus:ring-amber-500"
                />
                <span className={cn("text-xs", textSecondary)}>
                  {NOTIFICATION_CHANNEL_LABELS[ch]}
                </span>
              </label>
            ))}
            <button
              type="button"
              onClick={() => handleCancel(true, cancelChannel)}
              disabled={isPending}
              className="ml-auto rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
            >
              {isPending ? "취소 중..." : "취소 + 알림"}
            </button>
            <button
              type="button"
              onClick={() => handleCancel(false)}
              disabled={isPending}
              className="rounded bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
            >
              알림 없이 취소
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              disabled={isPending}
              className="rounded px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-200 dark:text-gray-400"
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 */}
      {confirmDelete && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <span className={cn("text-xs font-medium", textPrimary)}>
            이 일정을 삭제하시겠습니까? (알림 없이 레코드가 삭제됩니다)
          </span>
          <button
            type="button"
            onClick={() => handleDelete()}
            disabled={isPending}
            className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-red-700"
          >
            {isPending ? "삭제 중..." : "삭제"}
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
        {schedule.meeting_link && (
          <a
            href={schedule.meeting_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            참가 링크
          </a>
        )}
      </div>

      {schedule.description && (
        <p className={cn("text-xs whitespace-pre-wrap", textSecondary)}>
          {schedule.description}
        </p>
      )}

      {/* 발송 이력 패널 */}
      {logs && logs.length > 0 && (
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className={cn(
              "flex items-center gap-1 text-xs font-medium transition hover:underline",
              textSecondary
            )}
          >
            <span className="inline-block transition-transform" style={{ transform: showLogs ? "rotate(90deg)" : "rotate(0deg)" }}>
              ▶
            </span>
            발송 이력 ({logs.length}건)
          </button>

          {showLogs && (
            <div className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/50">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <ChannelBadge channel={log.channel} />
                    <span className={textSecondary}>
                      {maskPhone(log.recipient_phone)}
                    </span>
                    <LogStatusBadge status={log.status} />
                    {(log.sent_at || log.delivered_at) && (
                      <span className={cn("text-[11px]", textSecondary)}>
                        {formatLogDateTime(log.delivered_at || log.sent_at)}
                      </span>
                    )}
                  </div>
                  {log.status === "failed" && log.error_message && (
                    <span className="ml-4 text-[11px] text-red-500 dark:text-red-400">
                      {log.error_message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 발송 이력 헬퍼 컴포넌트 ──

function ChannelBadge({ channel }: { channel: NotificationLogEntry["channel"] }) {
  const styles: Record<string, string> = {
    alimtalk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    friendtalk: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    sms: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    lms: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  };
  const labels: Record<string, string> = {
    alimtalk: "알림톡",
    friendtalk: "친구톡",
    sms: "SMS",
    lms: "LMS",
  };
  const key = channel ?? "sms";
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", styles[key] ?? styles.sms)}>
      {labels[key] ?? key}
    </span>
  );
}

function LogStatusBadge({ status }: { status: NotificationLogEntry["status"] }) {
  const config: Record<string, { label: string; style: string }> = {
    pending: { label: "대기", style: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    sent: { label: "발송됨", style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    delivered: { label: "전달됨", style: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    failed: { label: "실패", style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  };
  const key = status ?? "pending";
  const c = config[key] ?? config.pending;
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", c.style)}>
      {c.label}
    </span>
  );
}

function maskPhone(phone: string | null): string {
  if (!phone) return "-";
  if (phone.length < 8) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}

function formatLogDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

// ── 수정 폼 ──

export function EditScheduleForm({
  schedule,
  studentId,
  consultants,
  enrollments,
  phoneAvailability,
  onCancel,
  onSuccess,
}: {
  schedule: ConsultationSchedule;
  studentId: string;
  consultants: { id: string; name: string }[];
  enrollments: { id: string; program_name: string }[];
  phoneAvailability: PhoneAvailability;
  onCancel: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notificationTargets, setNotificationTargets] = useState<NotificationTarget[]>(
    (schedule.notification_targets ?? ["mother"]).filter(
      (t) => phoneAvailability[PHONE_KEY_MAP[t]]
    )
  );
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>("alimtalk");
  const [sessionTypeValue, setSessionTypeValue] = useState(schedule.session_type ?? "정기상담");
  const [programNameValue, setProgramNameValue] = useState(schedule.program_name ?? "");
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>(
    schedule.consultation_mode ?? "대면"
  );

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );
  const labelClass = cn("text-xs font-medium", textSecondary);

  const programOptions = enrollments.map((e) => e.program_name);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const consultantId = formData.get("consultant_id") as string;
    const scheduledDate = formData.get("scheduled_date") as string;
    const startTime = formData.get("start_time") as string;
    const endTime = formData.get("end_time") as string;
    const visitor = (formData.get("visitor") as string) || undefined;
    const location = (formData.get("location") as string) || undefined;
    const meetingLink = (formData.get("meeting_link") as string) || undefined;
    const description = (formData.get("description") as string) || undefined;

    if (!consultantId || !scheduledDate || !startTime || !endTime) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    if (!programNameValue.trim()) {
      setError("프로그램을 입력해주세요.");
      return;
    }

    if (endTime <= startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");
      return;
    }

    // enrollment 매칭
    const matchedEnrollment = enrollments.find(
      (e) => e.program_name === programNameValue.trim()
    );

    startTransition(async () => {
      const result = await updateConsultationSchedule({
        scheduleId: schedule.id,
        studentId,
        consultantId,
        sessionType: sessionTypeValue.trim() || "정기상담",
        enrollmentId: matchedEnrollment?.id,
        programName: programNameValue.trim(),
        scheduledDate,
        startTime,
        endTime,
        consultationMode,
        meetingLink,
        visitor,
        location,
        description,
        sendNotification: notificationTargets.length > 0,
        notificationTargets,
        notificationChannel,
      });

      if (result.success) {
        onCancel();
        onSuccess ? onSuccess() : router.refresh();
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
          <Combobox
            value={sessionTypeValue}
            onChange={setSessionTypeValue}
            options={[...SESSION_TYPE_PRESETS]}
            placeholder="상담 유형 선택 또는 입력"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            프로그램 <span className="text-red-500">*</span>
          </label>
          <Combobox
            value={programNameValue}
            onChange={setProgramNameValue}
            options={programOptions}
            placeholder="프로그램 선택 또는 입력"
            required
          />
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 방식</label>
          <select
            value={consultationMode}
            onChange={(e) => setConsultationMode(e.target.value as ConsultationMode)}
            className={inputClass}
          >
            {CONSULTATION_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </div>

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

        {consultationMode === "대면" ? (
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
        ) : (
          <div className="flex flex-col gap-1">
            <label className={labelClass}>참가 링크</label>
            <input
              type="url"
              name="meeting_link"
              defaultValue={schedule.meeting_link ?? ""}
              placeholder="https://zoom.us/j/..."
              className={inputClass}
            />
          </div>
        )}

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

      {/* 알림 대상 + 채널 + 저장 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={cn("text-xs font-medium", textSecondary)}>알림 대상</span>
          {NOTIFICATION_TARGETS.map((target) => {
            const hasPhone = phoneAvailability[PHONE_KEY_MAP[target]];
            return (
              <label
                key={target}
                className={cn(
                  "flex items-center gap-1",
                  !hasPhone && "cursor-not-allowed opacity-50"
                )}
                title={!hasPhone ? "등록된 연락처가 없습니다" : undefined}
              >
                <input
                  type="checkbox"
                  checked={notificationTargets.includes(target)}
                  disabled={!hasPhone}
                  onChange={() =>
                    setNotificationTargets((prev) =>
                      prev.includes(target)
                        ? prev.filter((t) => t !== target)
                        : [...prev, target]
                    )
                  }
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                />
                <span className={cn("text-xs", textSecondary)}>
                  {NOTIFICATION_TARGET_LABELS[target]}
                </span>
                {!hasPhone && (
                  <span className="text-[10px] text-red-500">연락처 없음</span>
                )}
              </label>
            );
          })}

          <span className={cn("ml-2 border-l border-gray-300 pl-4 text-xs font-medium dark:border-gray-600", textSecondary)}>
            발송 채널
          </span>
          {NOTIFICATION_CHANNELS.map((ch) => (
            <label key={ch} className="flex items-center gap-1">
              <input
                type="radio"
                name="edit_notification_channel"
                checked={notificationChannel === ch}
                onChange={() => setNotificationChannel(ch)}
                disabled={notificationTargets.length === 0}
                className="h-3.5 w-3.5 border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
              />
              <span className={cn("text-xs", textSecondary)}>
                {NOTIFICATION_CHANNEL_LABELS[ch]}
              </span>
            </label>
          ))}
        </div>

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
