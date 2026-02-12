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
import { SESSION_TYPES, type SessionType } from "@/lib/domains/consulting/types";
import { createConsultationSchedule } from "@/lib/domains/consulting/actions/schedule";

type ConsultationScheduleFormProps = {
  studentId: string;
  consultants: { id: string; name: string }[];
  defaultConsultantId?: string;
};

export function ConsultationScheduleForm({
  studentId,
  consultants,
  defaultConsultantId,
}: ConsultationScheduleFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sendNotification, setSendNotification] = useState(true);

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const labelClass = cn("text-xs font-medium", textSecondary);

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
    const description = (formData.get("description") as string) || undefined;

    if (!consultantId || !scheduledDate || !startTime || !endTime) {
      setError("필수 항목을 모두 입력해주세요.");
      return;
    }

    startTransition(async () => {
      const result = await createConsultationSchedule({
        studentId,
        consultantId,
        sessionType,
        scheduledDate,
        startTime,
        endTime,
        visitor,
        location,
        description,
        sendNotification,
      });

      if (result.success) {
        setSuccess(true);
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
      {/* Row 1: 상담유형, 컨설턴트, 상담일 */}
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

        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담일</label>
          <input
            type="date"
            name="scheduled_date"
            required
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 2: 시작시간, 종료시간, 방문상담자 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

        <div className="flex flex-col gap-1">
          <label className={labelClass}>방문 상담자</label>
          <input
            type="text"
            name="visitor"
            placeholder="학생 & 학부모"
            className={inputClass}
          />
        </div>
      </div>

      {/* Row 3: 상담장소, 메모 */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={labelClass}>상담 장소</label>
          <input
            type="text"
            name="location"
            placeholder="미입력 시 학원 주소 사용"
            className={inputClass}
          />
        </div>

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

      {/* 알림 발송 + 제출 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={sendNotification}
            onChange={(e) => setSendNotification(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className={cn("text-xs", textSecondary)}>
            학부모에게 알림 발송
          </span>
        </label>

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
