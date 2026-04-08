"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveAttendanceAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordAttendance } from "@/lib/domains/student-record";
import { SaveStatusIndicator } from "../../SaveStatusIndicator";

type AttendanceEditorProps = {
  attendance: RecordAttendance | null;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  /** "row" = 테이블 행만 렌더 (외부에서 <table> 감쌈). "standalone" = 기존 전체 테이블 */
  variant?: "standalone" | "row";
};

const CATEGORIES = ["sick", "unauthorized", "other"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  sick: "질병",
  unauthorized: "미인정",
  other: "기타",
};

const ROW_TYPES = ["absence", "lateness", "early_leave", "class_absence"] as const;

type AttendanceValues = Record<string, number>;

function buildInitialValues(attendance: RecordAttendance | null): AttendanceValues {
  const values: AttendanceValues = {};
  for (const row of ROW_TYPES) {
    for (const cat of CATEGORIES) {
      const key = `${row}_${cat}`;
      values[key] = ((attendance as Record<string, unknown>)?.[key] as number) ?? 0;
    }
  }
  values.school_days = attendance?.school_days ?? 0;
  return values;
}

const B = "border border-gray-400 dark:border-gray-500";
const TH = `${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`;
const TD = `${B} px-1 py-1 text-center`;

// ─── 공유: 다단 헤더 ──────────────────────────────────

export function AttendanceTableHeader() {
  return (
    <thead>
      <tr>
        <th rowSpan={2} className={TH}>학년</th>
        <th rowSpan={2} className={TH}>수업일수</th>
        <th colSpan={3} className={TH}>결석일수</th>
        <th colSpan={3} className={TH}>지 각</th>
        <th colSpan={3} className={TH}>조 퇴</th>
        <th colSpan={3} className={TH}>결 과</th>
        <th rowSpan={2} className={TH}>특기사항</th>
      </tr>
      <tr>
        {CATEGORIES.map((c) => <th key={`abs-${c}`} className={TH}>{CATEGORY_LABELS[c]}</th>)}
        {CATEGORIES.map((c) => <th key={`lat-${c}`} className={TH}>{CATEGORY_LABELS[c]}</th>)}
        {CATEGORIES.map((c) => <th key={`ear-${c}`} className={TH}>{CATEGORY_LABELS[c]}</th>)}
        {CATEGORIES.map((c) => <th key={`cls-${c}`} className={TH}>{CATEGORY_LABELS[c]}</th>)}
      </tr>
    </thead>
  );
}

// ─── 메인 컴포넌트 ──────────────────────────────────

export function AttendanceEditor({
  attendance,
  studentId,
  schoolYear,
  tenantId,
  grade,
  variant = "standalone",
}: AttendanceEditorProps) {
  const [values, setValues] = useState(() => buildInitialValues(attendance));
  const [notes, setNotes] = useState(attendance?.notes ?? "");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await saveAttendanceAction({
        student_id: studentId,
        school_year: schoolYear,
        tenant_id: tenantId,
        grade,
        ...values,
        notes: notes.trim() || null,
      });
      if (!result.success) throw new Error("error" in result ? result.error : "저장 실패");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
      });
    },
  });

  const handleChange = (key: string, value: string) => {
    const num = parseInt(value, 10);
    setValues((prev) => ({ ...prev, [key]: isNaN(num) ? 0 : Math.max(0, num) }));
  };

  const saveStatus = mutation.isPending
    ? ("saving" as const)
    : mutation.isSuccess
      ? ("saved" as const)
      : mutation.isError
        ? ("error" as const)
        : ("idle" as const);

  // ─── row-only 모드: <tr> + 저장 버튼 행만 렌더 ────
  if (variant === "row") {
    return (
        <tr>
          <td className={TD}>
            <span className="text-sm text-[var(--text-primary)]">{grade}</span>
          </td>
          <td className={TD}>
            <NumInput value={values.school_days ?? 0} onChange={(v) => handleChange("school_days", v)} />
          </td>
          {CATEGORIES.map((c) => (
            <td key={`absence_${c}`} className={TD}>
              <NumInput value={values[`absence_${c}`] ?? 0} onChange={(v) => handleChange(`absence_${c}`, v)} />
            </td>
          ))}
          {CATEGORIES.map((c) => (
            <td key={`lateness_${c}`} className={TD}>
              <NumInput value={values[`lateness_${c}`] ?? 0} onChange={(v) => handleChange(`lateness_${c}`, v)} />
            </td>
          ))}
          {CATEGORIES.map((c) => (
            <td key={`early_leave_${c}`} className={TD}>
              <NumInput value={values[`early_leave_${c}`] ?? 0} onChange={(v) => handleChange(`early_leave_${c}`, v)} />
            </td>
          ))}
          {CATEGORIES.map((c) => (
            <td key={`class_absence_${c}`} className={TD}>
              <NumInput value={values[`class_absence_${c}`] ?? 0} onChange={(v) => handleChange(`class_absence_${c}`, v)} />
            </td>
          ))}
          <td className={`${B} px-1 py-1 text-left align-top`}>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="특이사항"
                className="w-full min-w-[60px] border-0 bg-transparent px-1 py-0.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
              />
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                className="shrink-0 rounded bg-indigo-600 px-2 py-0.5 text-xs text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {mutation.isPending ? "..." : "저장"}
              </button>
              <SaveStatusIndicator status={saveStatus} error={mutation.isError ? mutation.error.message : undefined} />
            </div>
          </td>
        </tr>
    );
  }

  // ─── standalone 모드 (기존) ───────────────────────

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <SaveStatusIndicator
          status={saveStatus}
          error={mutation.isError ? mutation.error.message : undefined}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <AttendanceTableHeader />
          <tbody>
            <tr>
              <td className={TD}>
                <span className="text-sm text-[var(--text-primary)]">{grade}</span>
              </td>
              <td className={TD}>
                <NumInput value={values.school_days ?? 0} onChange={(v) => handleChange("school_days", v)} />
              </td>
              {CATEGORIES.map((c) => (
                <td key={`absence_${c}`} className={TD}>
                  <NumInput value={values[`absence_${c}`] ?? 0} onChange={(v) => handleChange(`absence_${c}`, v)} />
                </td>
              ))}
              {CATEGORIES.map((c) => (
                <td key={`lateness_${c}`} className={TD}>
                  <NumInput value={values[`lateness_${c}`] ?? 0} onChange={(v) => handleChange(`lateness_${c}`, v)} />
                </td>
              ))}
              {CATEGORIES.map((c) => (
                <td key={`early_leave_${c}`} className={TD}>
                  <NumInput value={values[`early_leave_${c}`] ?? 0} onChange={(v) => handleChange(`early_leave_${c}`, v)} />
                </td>
              ))}
              {CATEGORIES.map((c) => (
                <td key={`class_absence_${c}`} className={TD}>
                  <NumInput value={values[`class_absence_${c}`] ?? 0} onChange={(v) => handleChange(`class_absence_${c}`, v)} />
                </td>
              ))}
              <td className={`${B} px-1 py-1 text-left align-top`}>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="특이사항"
                  className="w-full min-w-[80px] border-0 bg-transparent px-1 py-0.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {mutation.isPending ? "저장 중..." : "출결 저장"}
        </button>
      </div>
    </div>
  );
}

function NumInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-10 border-0 bg-transparent text-center text-sm text-[var(--text-primary)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
