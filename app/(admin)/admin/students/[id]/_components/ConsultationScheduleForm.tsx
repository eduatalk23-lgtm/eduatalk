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
  SESSION_TYPE_PRESETS,
  CONSULTATION_MODES,
  NOTIFICATION_TARGETS,
  NOTIFICATION_TARGET_LABELS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_LABELS,
  type ConsultationMode,
  type NotificationTarget,
  type NotificationChannel,
} from "@/lib/domains/consulting/types";
import { Combobox } from "@/components/ui/Combobox";
import { createConsultationSchedule } from "@/lib/domains/consulting/actions/schedule";

export type PhoneAvailability = {
  student: boolean;
  mother: boolean;
  father: boolean;
};

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
  onSuccess?: () => void;
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
  onSuccess,
}: ConsultationScheduleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionType, setSessionType] = useState("정기상담");
  const [programName, setProgramName] = useState("");
  const [notificationTargets, setNotificationTargets] = useState<NotificationTarget[]>(
    phoneAvailability.mother ? ["mother"] : []
  );
  const [notificationChannel, setNotificationChannel] = useState<NotificationChannel>("alimtalk");
  const [consultationMode, setConsultationMode] = useState<ConsultationMode>("대면");

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const labelClass = cn("text-xs font-medium", textSecondary);

  // 프로그램 옵션 목록 (수강 프로그램명)
  const programOptions = enrollments.map((e) => e.program_name);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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

    if (!programName.trim()) {
      setError("프로그램을 입력해주세요.");
      return;
    }

    if (endTime <= startTime) {
      setError("종료 시간은 시작 시간 이후여야 합니다.");
      return;
    }

    // enrollment 매칭 (프로그램명이 enrollment와 일치하면 enrollmentId 전달)
    const matchedEnrollment = enrollments.find(
      (e) => e.program_name === programName.trim()
    );

    startTransition(async () => {
      const result = await createConsultationSchedule({
        studentId,
        consultantId,
        sessionType: sessionType.trim() || "정기상담",
        enrollmentId: matchedEnrollment?.id,
        programName: programName.trim(),
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
        setSuccess(true);
        setSessionType("정기상담");
        setProgramName("");
        setConsultationMode("대면");
        setNotificationChannel("alimtalk");
        setNotificationTargets(phoneAvailability.mother ? ["mother"] : []);
        form.reset();
        router.refresh();
        onSuccess?.();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error ?? "등록에 실패했습니다.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Row 1: 상담유형, 프로그램(필수), 컨설턴트 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 유형</label>
          <Combobox
            value={sessionType}
            onChange={setSessionType}
            options={[...SESSION_TYPE_PRESETS]}
            placeholder="상담 유형 선택 또는 입력"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass}>
            프로그램 <span className="text-red-500">*</span>
          </label>
          <Combobox
            value={programName}
            onChange={setProgramName}
            options={programOptions}
            placeholder="프로그램 선택 또는 입력"
            required
          />
          {programName && (
            <p className={cn("text-xs", textSecondary)}>
              알림톡 상담유형: &quot;{programName}&quot;
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

      {/* Row 3: 상담방식, 방문상담자, 장소/링크, 메모 */}
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

      {/* 알림 대상 + 채널 + 제출 */}
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
                name="notification_channel"
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
