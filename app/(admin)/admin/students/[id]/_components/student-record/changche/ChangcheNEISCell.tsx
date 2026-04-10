"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveChangcheAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit, CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { CharacterCounter } from "../CharacterCounter";
import { SaveStatusIndicator } from "../SaveStatusIndicator";
import { useAutoSave } from "../useAutoSave";

// ─── AutoResizeTextarea ─────────────────────────
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

// ─── 창체 방향 가이드 타입 ──
export interface ChangcheGuideItemLike {
  /** DB row id — manual 가이드 수정/삭제 시 필요 */
  id?: string;
  /** 가이드 소스 — 'ai' | 'manual'. 없으면 legacy(=ai로 간주) */
  source?: "ai" | "manual";
  activityType: string;
  activityLabel: string;
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
  guideMode?: "retrospective" | "prospective";
}

// ─── ChangcheNEISCell ────────────────────────────

export function ChangcheNEISCell({
  activityType, existing, studentId, schoolYear, tenantId, grade,
}: {
  activityType: ChangcheActivityType;
  existing: RecordChangche | undefined;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  const charLimit = getCharLimit(activityType, schoolYear);
  // content가 비어있으면 imported_content(NEIS 원문) 표시 (세특과 동일)
  const displayContent = existing?.content?.trim() ? existing.content : (existing?.imported_content ?? "");
  const [content, setContent] = useState(displayContent);
  const queryClient = useQueryClient();

  useEffect(() => {
    const next = existing?.content?.trim() ? existing.content : (existing?.imported_content ?? "");
    setContent(next);
  }, [existing?.content, existing?.imported_content]);

  const handleSave = useCallback(async (data: string) => {
    const result = await saveChangcheAction({ student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade, activity_type: activityType, content: data, char_limit: charLimit }, schoolYear);
    if (result.success) { queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) }); }
    return { success: result.success, error: !result.success && "error" in result ? result.error : undefined };
  }, [studentId, schoolYear, tenantId, grade, activityType, charLimit, queryClient]);

  const { status, error, saveNow } = useAutoSave({ data: content, onSave: handleSave });

  return (
    <div>
      <AutoResizeTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full min-h-[4rem] resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
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
    </div>
  );
}
