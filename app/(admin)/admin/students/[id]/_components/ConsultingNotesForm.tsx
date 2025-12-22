"use client";

import { useActionState } from "react";
import { addConsultingNote } from "@/lib/domains/student";

type FormState = {
  success?: boolean;
  error?: string;
} | null;

export function ConsultingNotesForm({
  studentId,
  consultantId,
}: {
  studentId: string;
  consultantId: string;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    async (prevState: FormState, formData: FormData) => {
      return await addConsultingNote(studentId, consultantId, formData);
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="note"
        placeholder="상담 내용을 입력하세요..."
        required
        rows={4}
        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      />
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

