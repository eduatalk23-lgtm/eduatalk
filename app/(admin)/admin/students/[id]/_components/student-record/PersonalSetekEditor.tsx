"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  savePersonalSetekAction,
  removePersonalSetekAction,
} from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordPersonalSetek } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";

type PersonalSetekEditorProps = {
  personalSeteks: RecordPersonalSetek[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
};

export function PersonalSetekEditor({
  personalSeteks,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: PersonalSetekEditorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const charLimit = getCharLimit("personalSetek", schoolYear);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await removePersonalSetekAction(id);
      if (!result.success) throw new Error("error" in result ? result.error : "삭제 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  return (
    <div className="flex flex-col gap-3">
      {personalSeteks.length === 0 && !showAddForm && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-28 border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">제목</th>
                <th className="border border-gray-400 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)] dark:border-gray-500">내용</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={2} className="border border-gray-400 px-4 py-2 text-center text-xs text-[var(--text-tertiary)] dark:border-gray-500">
                  해당 사항 없음
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {personalSeteks.map((ps) => (
        <PersonalSetekCard
          key={ps.id}
          personalSetek={ps}
          charLimit={charLimit}
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          onDelete={() => {
            if (confirm(`"${ps.title}" 개인 세특을 삭제하시겠습니까?`)) {
              deleteMutation.mutate(ps.id);
            }
          }}
        />
      ))}

      {showAddForm ? (
        <AddPersonalSetekForm
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          charLimit={charLimit}
          sortOrder={personalSeteks.length}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-dashed border-border p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] dark:border-border dark:hover:border-gray-500"
        >
          + 개인 세특 추가
        </button>
      )}
    </div>
  );
}

function PersonalSetekCard({
  personalSetek,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  onDelete,
}: {
  personalSetek: RecordPersonalSetek;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  onDelete: () => void;
}) {
  const [content, setContent] = useState(personalSetek.content ?? "");
  const queryClient = useQueryClient();

  const handleSave = useCallback(
    async (data: string) => {
      const result = await savePersonalSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        title: personalSetek.title,
        content: data,
        char_limit: charLimit,
        sort_order: personalSetek.sort_order,
      });
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
        });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [studentId, schoolYear, tenantId, grade, personalSetek.title, personalSetek.sort_order, charLimit, queryClient],
  );

  const { status, error } = useAutoSave({
    data: content,
    onSave: handleSave,
  });

  return (
    <div className="rounded-lg border border-border bg-white p-4 dark:border-border dark:bg-bg-primary">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-[var(--text-primary)]">{personalSetek.title}</h4>
          <RecordStatusBadge status={personalSetek.status} />
        </div>
        <div className="flex items-center gap-3">
          <SaveStatusIndicator status={status} error={error} />
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700">
            삭제
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={5}
        className="w-full resize-y rounded-md border border-border bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-border"
        placeholder="개인 세특 내용을 입력하세요..."
      />
      <div className="mt-2 flex justify-end">
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </div>
  );
}

function AddPersonalSetekForm({
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  sortOrder,
  onClose,
}: {
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  sortOrder: number;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("제목을 입력해주세요.");
      const result = await savePersonalSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        title: title.trim(),
        content,
        char_limit: charLimit,
        sort_order: sortOrder,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
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
        <span className="text-sm font-medium text-[var(--text-primary)]">개인 세특 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 *"
          className="rounded-md border border-border bg-white px-3 py-2 text-sm dark:border-border dark:bg-bg-primary"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-border bg-white p-3 text-sm placeholder:text-text-tertiary focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-border dark:bg-bg-primary"
          placeholder="개인 세특 내용을 입력하세요..."
        />
        <div className="flex items-center justify-between">
          <CharacterCounter content={content} charLimit={charLimit} />
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {mutation.isPending ? "저장 중..." : "추가"}
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-600">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}
