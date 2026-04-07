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
  activityType: string;
  activityLabel: string;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
}

// ─── ChangcheNEISCell ────────────────────────────

export function ChangcheNEISCell({
  activityType, existing, studentId, schoolYear, tenantId, grade, guideItem,
}: {
  activityType: ChangcheActivityType;
  existing: RecordChangche | undefined;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  guideItem?: ChangcheGuideItemLike;
}) {
  const charLimit = getCharLimit(activityType, schoolYear);
  // content가 비어있으면 imported_content(NEIS 원문) 표시 (세특과 동일)
  const displayContent = existing?.content?.trim() ? existing.content : (existing?.imported_content ?? "");
  const [content, setContent] = useState(displayContent);
  const [draftGenerating, setDraftGenerating] = useState(false);
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

  const hasDraft = !!existing?.ai_draft_content;
  const draftContent = existing?.ai_draft_content ?? null;

  async function handleAcceptDraft() {
    if (!existing) return;
    const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
    // E1: 기존 content 보호
    const result = await acceptAiDraftAction(existing.id, "changche");
    if (!result.success) {
      if ("error" in result && result.error === "CONTENT_EXISTS") {
        if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
        const forced = await acceptAiDraftAction(existing.id, "changche", true);
        if (!forced.success) return;
      } else if ("error" in result && result.error === "CONFLICT") {
        alert("다른 사용자가 이미 수정했습니다. 페이지를 새로고침하세요.");
        return;
      } else {
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
  }

  async function handleGenerateDraft() {
    if (!existing) return;
    setDraftGenerating(true);
    try {
      const { generateChangcheDraftAction } = await import(
        "@/lib/domains/student-record/llm/actions/generateChangcheDraft"
      );
      await generateChangcheDraftAction(existing.id, {
        activityType,
        grade,
        schoolYear,
        direction: guideItem?.direction,
        keywords: guideItem?.keywords,
        teacherPoints: guideItem?.teacherPoints,
        existingContent: existing.imported_content ?? undefined,
      });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
    } finally {
      setDraftGenerating(false);
    }
  }

  return (
    <div>
      {/* AI 초안 배너 (세특과 동일) */}
      {hasDraft && draftContent && !content && (
        <div className="mb-1 rounded bg-violet-50 p-2 text-xs dark:bg-violet-900/20">
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-violet-700 dark:text-violet-400">AI 초안</span>
            <button type="button" onClick={handleAcceptDraft} className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700">수용</button>
          </div>
          <p className="text-violet-600 dark:text-violet-300 line-clamp-3">{draftContent.slice(0, 200)}...</p>
        </div>
      )}
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
          {existing && !content && !hasDraft && (
            <button
              type="button"
              disabled={draftGenerating}
              onClick={handleGenerateDraft}
              className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {draftGenerating ? "생성 중..." : "AI 초안 생성"}
            </button>
          )}
        </div>
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </div>
  );
}
