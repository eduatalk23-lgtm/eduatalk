"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import {
  SESSION_TYPES,
  CONSULTATION_MODES,
  NOTIFICATION_TARGETS,
  NOTIFICATION_TARGET_LABELS,
  type SessionType,
  type ConsultationMode,
  type NotificationTarget,
} from "@/lib/domains/consulting/types";
import { createConsultationSchedule } from "@/lib/domains/consulting/actions/schedule";
import type { PhoneAvailability } from "./ConsultationScheduleSection";

type EnrollmentOption = {
  id: string;
  program_name: string;
};

type ConsultationScheduleFormProps = {
  studentId: string;
  consultants: { id: string; name: string }[];
  enrollments?: EnrollmentOption[];
  defaultConsultantId?: string;
  phoneAvailability: PhoneAvailability;
};

const PHONE_KEY_MAP: Record<NotificationTarget, keyof PhoneAvailability> = {
  student: "student",
  mother: "mother",
  father: "father",
};

export function ConsultationScheduleForm({
  studentId,
  consultants,
  enrollments = [],
  defaultConsultantId,
  phoneAvailability,
}: ConsultationScheduleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [notificationTargets, setNotificationTargets] = useState<NotificationTarget[]>(
    phoneAvailability.mother ? ["mother"] : []
  );
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>("대면");

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const labelClass = cn("text-xs font-medium", textSecondary);

  // 선택된 enrollment의 프로그램명
  const selectedProgramName = enrollments.find(
    (e) => e.id === selectedEnrollmentId
  )?.program_name;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const consultantId = formData.get("consultant_id") as string;
    const sessionType = formData.get("session_type") as SessionType;
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

    if (endTime <= startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");
      return;
    }

    startTransition(async () => {
      const result = await createConsultationSchedule({
        studentId,
        consultantId,
        sessionType,
        enrollmentId: selectedEnrollmentId || undefined,
        programName: selectedProgramName,
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
      });

      if (result.success) {
        setSuccess(true);
        setSelectedEnrollmentId("");
        setConsultationMode("대면");
        setNotificationTargets(phoneAvailability.mother ? ["mother"] : []);
        form.reset();
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error ?? "등록에 실패했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Row 1: 상담유형, 관련 프로그램, 컨설턴트 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 유형</label>
          <select
            name="session_type"
            defaultValue="정기상담"
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
          {selectedProgramName && (
            <p className={cn("text-xs", textSecondary)}>
              알림톡 상담유형: &quot;{selectedProgramName}&quot;
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>담당 컨설턴트</label>
          <select
            name="consultant_id"
            defaultValue={defaultConsultantId ?? ""}
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

      {/* Row 2: 상담일, 시작시간, 종료시간 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담일</label>
          <input
            type="date"
            name="scheduled_date"
            required
            min={new Date().toISOString().split("T")[0]}
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>시작 시간</label>
          <input
            type="time"
            name="start_time"
            required
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>종료 시간</label>
          <input
            type="time"
            name="end_time"
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 3: 상담방식, 방문상담자, 장소/링크 */}
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
            placeholder="상담 내용/목적"
            className={inputClass}
          />
        </div>
      </div>

      {/* 알림 대상 + 제출 */}
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
        </div>

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700",
            isPending && "cursor-not-allowed opacity-60"
          )}
        >
          {isPending ? "등록 중..." : "일정 등록"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      )}
      {success && (
        <div className="text-sm text-green-600 dark:text-green-400">
          상담 일정이 등록되었습니다.
        </div>
      )}
    </form>
  );
}
