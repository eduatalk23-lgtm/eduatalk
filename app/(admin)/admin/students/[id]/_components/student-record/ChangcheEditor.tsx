"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveChangcheAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit, CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";

const ACTIVITY_TYPES: ChangcheActivityType[] = ["autonomy", "club", "career"];

const B = "border border-gray-400 dark:border-gray-500";

type ChangcheEditorProps = {
  changche: RecordChangche[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
};

export function ChangcheEditor({
  changche,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: ChangcheEditorProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
            <th className={`${B} w-24 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>영역</th>
            <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>시간</th>
            <th className={`${B} px-2 py-1.5 text-left text-xs font-medium text-[var(--text-secondary)]`}>특기사항</th>
          </tr>
        </thead>
        <tbody>
          {ACTIVITY_TYPES.map((type, idx) => {
            const existing = changche.find((c) => c.activity_type === type);
            return (
              <ChangcheRow
                key={type}
                activityType={type}
                existing={existing}
                studentId={studentId}
                schoolYear={schoolYear}
                tenantId={tenantId}
                grade={grade}
                showGrade={idx === 0}
                rowSpan={ACTIVITY_TYPES.length}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChangcheRow({
  activityType,
  existing,
  studentId,
  schoolYear,
  tenantId,
  grade,
  showGrade,
  rowSpan,
}: {
  activityType: ChangcheActivityType;
  existing: RecordChangche | undefined;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  showGrade?: boolean;
  rowSpan?: number;
}) {
  const charLimit = getCharLimit(activityType, schoolYear);
  const [content, setContent] = useState(existing?.content ?? "");
  const queryClient = useQueryClient();

  // Import 등으로 외부에서 데이터가 변경되면 state 동기화
  useEffect(() => {
    setContent(existing?.content ?? "");
  }, [existing?.content]);

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveChangcheAction(
        {
          student_id: studentId,
          school_year: schoolYear,
          tenant_id: tenantId,
          grade,
          activity_type: activityType,
          content: data,
          char_limit: charLimit,
        },
        schoolYear,
      );
      if (result.success) {
        queryClient.invalidateQueries({
          queryKey: studentRecordKeys.recordTab(studentId, schoolYear),
        });
      }
      return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
    },
    [studentId, schoolYear, tenantId, grade, activityType, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
  });

  return (
    <tr>
      {showGrade && (
        <td rowSpan={rowSpan} className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
          {grade}
        </td>
      )}
      <td className={`${B} px-2 py-1.5 text-center align-middle whitespace-nowrap`}>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-[var(--text-primary)]">
            {CHANGCHE_TYPE_LABELS[activityType]}
          </span>
          {existing && <RecordStatusBadge status={existing.status} />}
        </div>
      </td>
      <td className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
        {existing?.hours ?? "-"}
      </td>
      <td className={`${B} p-1 align-top`}>
        <AutoResizeTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
          placeholder={`${CHANGCHE_TYPE_LABELS[activityType]} 활동 내용을 입력하세요...`}
        />
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <SaveStatusIndicator status={status} error={error} />
            {status === "error" && (
              <button onClick={saveNow} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">재시도</button>
            )}
          </div>
          <CharacterCounter content={content} charLimit={charLimit} />
        </div>
      </td>
    </tr>
  );
}

/** textarea 높이를 내용에 맞춰 자동 조절 (테이블 셀 내에서도 작동) */
function AutoResizeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(resize, [props.value, resize]);

  return (
    <textarea
      ref={ref}
      {...props}
      onChange={(e) => { onChange?.(e); resize(); }}
    />
  );
}
