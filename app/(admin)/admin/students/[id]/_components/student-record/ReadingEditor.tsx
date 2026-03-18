"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addReadingAction, removeReadingAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordReading } from "@/lib/domains/student-record";

type ReadingEditorProps = {
  readings: RecordReading[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
};

export function ReadingEditor({
  readings,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: ReadingEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removeReadingAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  const handleDelete = (id: string, title: string) => {
    if (confirm(`"${title}" 독서 기록을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 독서 목록 */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">제목</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">저자</th>
              <th className="border border-gray-400 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">과목 또는 영역</th>
            </tr>
          </thead>
          <tbody>
            {readings.length === 0 && !showAddForm && (
              <tr>
                <td colSpan={3} className="border border-gray-400 px-4 py-2 text-center text-sm text-[var(--text-tertiary)] dark:border-gray-500">
                  등록된 독서 기록이 없습니다.
                </td>
              </tr>
            )}
            {readings.map((reading) => (
              <tr key={reading.id} className="group">
                <td className="border border-gray-400 px-2 py-1 text-sm text-[var(--text-primary)] dark:border-gray-500">{reading.book_title}</td>
                <td className="border border-gray-400 px-2 py-1 text-sm text-[var(--text-secondary)] dark:border-gray-500">{reading.author ?? "-"}</td>
                <td className="relative border border-gray-400 px-2 py-1 text-sm text-[var(--text-secondary)] dark:border-gray-500">
                  {reading.subject_area}
                  <button
                    onClick={() => handleDelete(reading.id, reading.book_title)}
                    disabled={deleteMutation.isPending}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500 invisible transition-all hover:bg-red-100 hover:text-red-700 disabled:opacity-50 group-hover:visible dark:bg-red-950/30 dark:hover:bg-red-950/50"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 추가 폼 */}
      {showAddForm ? (
        <AddReadingForm
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="mt-1 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
        >
          + 독서 추가
        </button>
      )}
    </div>
  );
}

function AddReadingForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  onClose: () => void;
}) {
  const [bookTitle, setBookTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [subjectArea, setSubjectArea] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!bookTitle.trim()) throw new Error("제목을 입력해주세요.");
      if (!subjectArea.trim()) throw new Error("관련 과목을 입력해주세요.");
      const result = await addReadingAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        book_title: bookTitle.trim(),
        author: author.trim() || null,
        subject_area: subjectArea.trim(),
      });
      if (!result.success) throw new Error("error" in result ? result.error : "추가 실패");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
      onClose();
    },
  });

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-800 dark:bg-indigo-950/20">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--text-primary)]">독서 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={bookTitle}
            onChange={(e) => setBookTitle(e.target.value)}
            placeholder="도서명 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="저자"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
          <input
            value={subjectArea}
            onChange={(e) => setSubjectArea(e.target.value)}
            placeholder="관련 과목 *"
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "추가 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
