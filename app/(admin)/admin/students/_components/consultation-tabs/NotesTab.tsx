"use client";

import { useState, useTransition, useEffect } from "react";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import {
  SESSION_TYPE_PRESETS,
  SESSION_TYPE_COLORS,
  type SessionType,
  type ConsultationSchedule,
} from "@/lib/domains/consulting/types";
import { addConsultingNote, deleteConsultingNote } from "@/lib/domains/student";
import { Combobox } from "@/components/ui/Combobox";
import type { ConsultingNoteRow } from "@/lib/domains/consulting/actions/fetchConsultationData";

type EnrollmentOption = { id: string; program_name: string };

type NotesTabProps = {
  notes: ConsultingNoteRow[];
  schedules: ConsultationSchedule[];
  enrollments: EnrollmentOption[];
  studentId: string;
  currentUserId: string | null;
  defaultScheduleId?: string | null;
  onRefresh: () => void;
};

export function NotesTab({
  notes,
  schedules,
  enrollments,
  studentId,
  currentUserId,
  defaultScheduleId,
  onRefresh,
}: NotesTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 노트 작성 폼 */}
      <NoteCreateForm
        studentId={studentId}
        currentUserId={currentUserId}
        schedules={schedules}
        enrollments={enrollments}
        defaultScheduleId={defaultScheduleId}
        onRefresh={onRefresh}
      />

      {/* 노트 목록 */}
      {notes.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
          <p className={cn("text-sm font-medium", textPrimary)}>
            상담노트가 없습니다.
          </p>
          <p className={cn("text-xs", textSecondary)}>
            위 폼에서 노트를 작성하면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => {
            const linkedSchedule = note.consultation_schedule_id
              ? schedules.find((s) => s.id === note.consultation_schedule_id)
              : null;

            return (
              <NoteCard
                key={note.id}
                note={note}
                linkedSchedule={linkedSchedule ?? null}
                studentId={studentId}
                currentUserId={currentUserId}
                onRefresh={onRefresh}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 노트 작성 폼 ──

function NoteCreateForm({
  studentId,
  currentUserId,
  schedules,
  enrollments,
  defaultScheduleId,
  onRefresh,
}: {
  studentId: string;
  currentUserId: string | null;
  schedules: ConsultationSchedule[];
  enrollments: EnrollmentOption[];
  defaultScheduleId?: string | null;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sessionType, setSessionType] = useState("정기상담");
  const [scheduleId, setScheduleId] = useState(defaultScheduleId ?? "");

  // defaultScheduleId가 변경되면 반영 (상담 완료 시 자동 설정)
  useEffect(() => {
    if (defaultScheduleId) {
      setScheduleId(defaultScheduleId);
      // 연결된 일정의 session_type 자동 반영
      const schedule = schedules.find((s) => s.id === defaultScheduleId);
      if (schedule) {
        setSessionType(schedule.session_type);
      }
    }
  }, [defaultScheduleId, schedules]);

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const labelClass = cn("text-xs font-medium", textSecondary);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentUserId) {
      setError("로그인 정보를 찾을 수 없습니다.");
      return;
    }

    setError(null);
    setSuccess(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Combobox 값 수동 설정 (name 속성으로 전달 안 됨)
    formData.set("session_type", sessionType.trim() || "기타");
    if (scheduleId) {
      formData.set("consultation_schedule_id", scheduleId);
    }

    startTransition(async () => {
      const result = await addConsultingNote(studentId, currentUserId, formData);
      if (result?.success) {
        setSuccess(true);
        setSessionType("정기상담");
        setScheduleId("");
        setExpanded(false);
        form.reset();
        onRefresh();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result?.error ?? "저장에 실패했습니다.");
      }
    });
  }

  // 일정 선택 옵션 (날짜 + 유형으로 표시)
  const scheduleOptions = schedules.map((s) => ({
    id: s.id,
    label: `${formatShortDate(s.scheduled_date)} ${s.session_type}${s.program_name ? ` - ${s.program_name}` : ""}`,
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <h4 className={cn("mb-3 text-sm font-semibold", textPrimary)}>노트 작성</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Row 1: 상담유형, 상담일, 소요시간, 연결일정 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className={labelClass}>상담 유형</label>
            <Combobox
              value={sessionType}
              onChange={setSessionType}
              options={[...SESSION_TYPE_PRESETS]}
              placeholder="유형 선택 또는 입력"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>상담일</label>
            <input
              type="date"
              name="session_date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>소요 시간 (분)</label>
            <input
              type="number"
              name="session_duration"
              min={0}
              step={5}
              placeholder="30"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className={labelClass}>연결 일정</label>
            <select
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
              className={inputClass}
            >
              <option value="">없음 (독립 노트)</option>
              {scheduleOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 관련 수강 (수강 목록 있을 때만) */}
        {enrollments.length > 0 && (
          <div className="flex flex-col gap-1 sm:max-w-xs">
            <label className={labelClass}>관련 수강</label>
            <select name="enrollment_id" className={inputClass}>
              <option value="">선택 안 함</option>
              {enrollments.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.program_name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 상담 내용 */}
        <textarea
          name="note"
          placeholder="상담 내용을 입력하세요..."
          required
          rows={3}
          className={inputClass}
        />

        {/* 후속 조치 확장 */}
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={cn("text-xs underline", textSecondary)}
          >
            후속 조치 / 추가 옵션 입력
          </button>
        )}

        {expanded && (
          <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>후속 조치</label>
              <input
                type="text"
                name="next_action"
                placeholder="예: 학부모 면담 일정 확인"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>후속 조치 예정일</label>
                <input type="date" name="follow_up_date" className={inputClass} />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_visible_to_parent_check"
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    onChange={(e) => {
                      const hidden = e.target.form?.querySelector(
                        'input[name="is_visible_to_parent"]'
                      ) as HTMLInputElement | null;
                      if (hidden) hidden.value = String(e.target.checked);
                    }}
                  />
                  <span className={cn("text-xs", textSecondary)}>학부모에게 공개</span>
                </label>
              </div>
            </div>
          </div>
        )}

        <input type="hidden" name="is_visible_to_parent" value="false" />

        {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}
        {success && <div className="text-sm text-green-600 dark:text-green-400">상담노트가 저장되었습니다.</div>}

        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700",
            isPending && "cursor-not-allowed opacity-60"
          )}
        >
          {isPending ? "저장 중..." : "노트 저장"}
        </button>
      </form>
    </div>
  );
}

// ── 노트 카드 ──

function NoteCard({
  note,
  linkedSchedule,
  studentId,
  currentUserId,
  onRefresh,
}: {
  note: ConsultingNoteRow;
  linkedSchedule: ConsultationSchedule | null;
  studentId: string;
  currentUserId: string | null;
  onRefresh: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const sessionType = (note.session_type ?? "기타") as SessionType;
  const colorClass =
    SESSION_TYPE_COLORS[sessionType] ?? SESSION_TYPE_COLORS["기타"];

  function handleDelete() {
    if (!confirm("이 노트를 삭제하시겠습니까?")) return;
    startTransition(async () => {
      await deleteConsultingNote(note.id, studentId);
      onRefresh();
    });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 transition",
        "border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800/50"
      )}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("rounded px-2 py-0.5 text-xs font-medium", colorClass)}>
            {sessionType}
          </span>
          <span className={cn("text-xs", textSecondary)}>
            {note.session_date
              ? new Date(note.session_date + "T00:00:00").toLocaleDateString("ko-KR")
              : note.created_at
                ? new Date(note.created_at).toLocaleDateString("ko-KR")
                : "-"}
          </span>
          {note.session_duration && (
            <span className={cn("text-xs", textSecondary)}>
              {note.session_duration}분
            </span>
          )}
          {linkedSchedule && (
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {formatShortDate(linkedSchedule.scheduled_date)} 일정 연결
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="rounded px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
        >
          {isPending ? "..." : "삭제"}
        </button>
      </div>

      {/* 본문 */}
      <p className={cn("whitespace-pre-wrap text-sm", textPrimary)}>
        {note.note ?? ""}
      </p>

      {/* 후속 조치 */}
      {(note.next_action || note.follow_up_date) && (
        <div
          className={cn(
            "flex items-center gap-2 rounded border px-3 py-1.5 text-xs",
            "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20"
          )}
        >
          <span className="font-medium text-amber-700 dark:text-amber-400">후속 조치:</span>
          {note.next_action && <span className={textSecondary}>{note.next_action}</span>}
          {note.follow_up_date && (
            <span className="text-amber-600 dark:text-amber-400">
              ({new Date(note.follow_up_date + "T00:00:00").toLocaleDateString("ko-KR")})
            </span>
          )}
        </div>
      )}

      {note.is_visible_to_parent && (
        <span className="self-start rounded px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          학부모 공개
        </span>
      )}
    </div>
  );
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const w = weekdays[d.getDay()];
  return `${m}/${day}(${w})`;
}
