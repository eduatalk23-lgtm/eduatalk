"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveHaengteukAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordHaengteuk } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";

const B = "border border-gray-400 dark:border-gray-500";

type HaengteukEditorProps = {
  haengteuk: RecordHaengteuk | null;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
};

export function HaengteukEditor({
  haengteuk,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: HaengteukEditorProps) {
  const charLimit = getCharLimit("haengteuk", schoolYear);
  const [content, setContent] = useState(haengteuk?.content ?? "");
  const queryClient = useQueryClient();

  useEffect(() => {
    setContent(haengteuk?.content ?? "");
  }, [haengteuk?.content]);

  const handleSave = useCallback(
    async (data: string) => {
      const result = await saveHaengteukAction(
        {
          student_id: studentId,
          school_year: schoolYear,
          tenant_id: tenantId,
          grade,
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
    [studentId, schoolYear, tenantId, grade, charLimit, queryClient],
  );

  const { status, error, saveNow } = useAutoSave({
    data: content,
    onSave: handleSave,
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className={`${B} w-14 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
            <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
              <span>행동특성 및 종합의견</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${B} px-2 py-1.5 text-center align-middle`}>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm text-[var(--text-primary)]">{grade}</span>
                {haengteuk && <RecordStatusBadge status={haengteuk.status} />}
              </div>
            </td>
            <td className={`${B} p-1 align-top`}>
              <AutoResizeTextarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                placeholder="행동특성 및 종합의견을 입력하세요..."
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
        </tbody>
      </table>
    </div>
  );
}

function AutoResizeTextarea({ onChange, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(resize, [props.value, resize]);
  return <textarea ref={ref} {...props} onChange={(e) => { onChange?.(e); resize(); }} />;
}
