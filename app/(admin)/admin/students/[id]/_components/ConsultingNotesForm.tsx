"use client";

import { useActionState, useState } from "react";
import { addConsultingNote } from "@/lib/domains/student";
import { cn } from "@/lib/cn";
import {
  borderInput,
  bgSurface,
  textPrimary,
  textSecondary,
} from "@/lib/utils/darkMode";
import { SESSION_TYPES, type SessionType } from "@/lib/domains/consulting/types";

type FormState = {
  success?: boolean;
  error?: string;
} | null;

type EnrollmentOption = {
  id: string;
  program_name: string;
};

export function ConsultingNotesForm({
  studentId,
  consultantId,
  enrollments = [],
}: {
  studentId: string;
  consultantId: string;
  enrollments?: EnrollmentOption[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    async (prevState: FormState, formData: FormData) => {
      return await addConsultingNote(studentId, consultantId, formData);
    },
    null
  );

  const inputClass = cn(
    "w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2",
    borderInput,
    bgSurface,
    textPrimary,
    "focus:border-indigo-500 focus:ring-indigo-200 dark:focus:ring-indigo-800"
  );

  const labelClass = cn("text-xs font-medium", textSecondary);

  return (
    <form action={formAction} className="space-y-3">
      {/* 기본 필드: 세션 유형 + 날짜 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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

        {enrollments.length > 0 && (
          <div className="flex flex-col gap-1">
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
      </div>

      {/* 상담 내용 */}
      <textarea
        name="note"
        placeholder="상담 내용을 입력하세요..."
        required
        rows={4}
        className={inputClass}
      />

      {/* 확장 필드 토글 */}
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
              placeholder="예: 학부모 면담 일정 확인, 성적 추이 재분석"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass}>후속 조치 예정일</label>
              <input
                type="date"
                name="follow_up_date"
                className={inputClass}
              />
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
                <span className={cn("text-xs", textSecondary)}>
                  학부모에게 공개
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 학부모 공개 hidden */}
      <input type="hidden" name="is_visible_to_parent" value="false" />

      {state?.error && (
        <div className="text-sm text-red-600">{state.error}</div>
      )}
      {state?.success && (
        <div className="text-sm text-green-600">상담노트가 저장되었습니다.</div>
      )}

      <button
        type="submit"
        className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        저장
      </button>
    </form>
  );
}
