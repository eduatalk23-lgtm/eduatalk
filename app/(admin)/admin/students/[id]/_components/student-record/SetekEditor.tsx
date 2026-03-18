"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordSetek } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";

type Subject = { id: string; name: string };

type SetekEditorProps = {
  seteks: RecordSetek[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  subjects: Subject[];
  grade: number;
};

const B = "border border-gray-400 dark:border-gray-500";

// ─── 과목 합산 유틸 ──────────────────────────────────

type MergedSetekRow = {
  /** 과목명 (같은 과목의 1+2학기를 한 행으로 합산) */
  displayName: string;
  /** 원본 세특 레코드들 (1~2개) */
  records: RecordSetek[];
  /** 정렬용 subject_id */
  subjectId: string;
};

function mergeSeteksBySemester(seteks: RecordSetek[], subjects: Subject[]): MergedSetekRow[] {
  // subject_id 기준으로 그룹화 (같은 과목의 1학기+2학기를 합산)
  const bySubject = new Map<string, RecordSetek[]>();
  for (const s of seteks) {
    const arr = bySubject.get(s.subject_id) ?? [];
    arr.push(s);
    bySubject.set(s.subject_id, arr);
  }

  const rows: MergedSetekRow[] = [];
  for (const [subjectId, records] of bySubject) {
    const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "알 수 없는 과목";
    // 같은 과목이 2학기분이면 합산 표시, 아니면 단독
    const sorted = records.sort((a, b) => a.semester - b.semester);
    rows.push({
      displayName: subjectName,
      records: sorted,
      subjectId,
    });
  }
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "ko"));
}

// ─── 메인 컴포넌트 ──────────────────────────────────

export function SetekEditor({
  seteks,
  studentId,
  schoolYear,
  tenantId,
  subjects,
  grade,
}: SetekEditorProps) {
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const charLimit = getCharLimit("setek", schoolYear);

  const mergedRows = useMemo(() => mergeSeteksBySemester(seteks, subjects), [seteks, subjects]);
  const existingSubjectIds = new Set(seteks.map((s) => s.subject_id));
  const availableSubjects = subjects.filter((s) => !existingSubjectIds.has(s.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-28 px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>과 목</th>
              <th className={`${B} px-3 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>세부능력 및 특기사항</th>
            </tr>
          </thead>
          <tbody>
            {mergedRows.length === 0 ? (
              <tr>
                <td colSpan={2} className={`${B} px-4 py-2 text-center text-xs text-[var(--text-tertiary)]`}>
                  해당 사항 없음
                </td>
              </tr>
            ) : (
              mergedRows.map((row) => (
                <SetekTableRow
                  key={row.subjectId}
                  row={row}
                  charLimit={charLimit}
                  isExpanded={expandedSubjectId === row.subjectId}
                  onToggle={() => setExpandedSubjectId(expandedSubjectId === row.subjectId ? null : row.subjectId)}
                  studentId={studentId}
                  schoolYear={schoolYear}
                  tenantId={tenantId}
                  grade={grade}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddForm ? (
        <AddSetekForm
          subjects={availableSubjects}
          studentId={studentId}
          schoolYear={schoolYear}
          tenantId={tenantId}
          grade={grade}
          charLimit={charLimit}
          onClose={() => setShowAddForm(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          disabled={availableSubjects.length === 0}
          className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-[var(--text-tertiary)] transition hover:border-gray-400 hover:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:hover:border-gray-500"
        >
          + 과목 추가
        </button>
      )}
    </div>
  );
}

// ─── 세특 테이블 행 (2열: 과목 | 내용) ─────────────

function SetekTableRow({
  row,
  charLimit,
  isExpanded,
  onToggle,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  row: MergedSetekRow;
  charLimit: number;
  isExpanded: boolean;
  onToggle: () => void;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  // 합산된 내용 미리보기: 모든 레코드의 content를 연결
  const mergedContent = row.records.map((r) => r.content ?? "").filter(Boolean).join(" ");
  const preview = mergedContent.length > 120 ? mergedContent.slice(0, 120) + "..." : mergedContent || "내용 없음";

  return (
    <tr className="align-top">
      {/* 과목명 */}
      <td
        className={`${B} px-3 py-2 text-center text-sm font-medium text-[var(--text-primary)] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50`}
        onClick={onToggle}
      >
        <span className="mr-1 inline-block text-xs text-[var(--text-tertiary)]">{isExpanded ? "▾" : "▸"}</span>
        {row.displayName}
        {row.records.length > 1 && (
          <span className="mt-0.5 block text-xs font-normal text-[var(--text-tertiary)]">
            ({row.records.map((r) => `${r.semester}학기`).join("·")})
          </span>
        )}
      </td>

      {/* 세특 내용 */}
      <td className={`${B} px-3 py-2`}>
        {isExpanded ? (
          <div className="flex flex-col gap-3">
            {row.records.map((setek) => (
              <SetekInlineEditor
                key={setek.id}
                setek={setek}
                charLimit={charLimit}
                studentId={studentId}
                schoolYear={schoolYear}
                tenantId={tenantId}
                grade={grade}
                showSemesterLabel={row.records.length > 1}
              />
            ))}
            <button
              onClick={onToggle}
              className="self-end text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
            >
              접기
            </button>
          </div>
        ) : (
          <div
            className="cursor-pointer text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            onClick={onToggle}
          >
            {preview}
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── 인라인 세특 에디터 (테이블 내부) ───────────────

function SetekInlineEditor({
  setek,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  showSemesterLabel,
}: {
  setek: RecordSetek;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  showSemesterLabel: boolean;
}) {
  const [content, setContent] = useState(setek.content ?? "");
  const queryClient = useQueryClient();

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester: setek.semester,
        subject_id: setek.subject_id,
        content: data,
        char_limit: charLimit,
      });
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
        });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [studentId, schoolYear, tenantId, grade, setek.semester, setek.subject_id, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
    enabled: true,
  });

  return (
    <div>
      {showSemesterLabel && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
      )}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        className="w-full resize-y rounded border border-gray-200 bg-[var(--bg-surface)] p-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700"
        placeholder="세특 내용을 입력하세요..."
      />
      <div className="mt-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={status} error={error} />
          {status === "error" && (
            <button onClick={saveNow} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">재시도</button>
          )}
        </div>
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </div>
  );
}

// ─── 과목 추가 폼 ──────────────────────────────────

function AddSetekForm({
  subjects,
  studentId,
  schoolYear,
  tenantId,
  grade,
  charLimit,
  onClose,
}: {
  subjects: { id: string; name: string }[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
  onClose: () => void;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [semester, setSemester] = useState(1);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubjectId) throw new Error("과목을 선택해주세요.");
      const result = await saveSetekAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        semester,
        subject_id: selectedSubjectId,
        content,
        char_limit: charLimit,
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
        <span className="text-sm font-medium text-[var(--text-primary)]">과목 추가</span>
        <button onClick={onClose} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
          취소
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">과목 선택...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            className="w-28 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value={1}>1학기</option>
            <option value={2}>2학기</option>
          </select>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-gray-200 bg-white p-3 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-gray-900"
          placeholder="세특 내용을 입력하세요..."
        />
        <div className="flex items-center justify-between">
          <CharacterCounter content={content} charLimit={charLimit} />
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedSubjectId || mutation.isPending}
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
