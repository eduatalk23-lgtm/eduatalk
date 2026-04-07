"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStudentRecordContext } from "../StudentRecordContext";
import { cn } from "@/lib/cn";
import { CharacterCounter } from "../CharacterCounter";
import { SaveStatusIndicator } from "../SaveStatusIndicator";
import { useAutoSave } from "../useAutoSave";
import { saveSetekAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { RecordSetek } from "@/lib/domains/student-record";
import { computeRecordStage, GRADE_STAGE_CONFIG } from "@/lib/domains/student-record/grade-stage";
import type { MergedSetekRow, SetekLayerTab, SetekGuideItemLike } from "../SetekEditor";
import type { SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import type { AnalysisTagLike } from "../shared/AnalysisBlocks";
import { AnalysisExpandableCell } from "./SetekAnalysisCell";
import { DraftExpandableCell } from "./SetekDraftCell";

type ActivityTagLike = AnalysisTagLike;

const B = "border border-gray-400 dark:border-gray-500";

// ─── AutoResizeTextarea ──────────────────────────────────────────────────────

function AutoResizeTextarea({ onChange, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useEffect(resize, [props.value, resize]);
  return <textarea ref={ref} {...props} className={cn("overflow-hidden", className)} onChange={(e) => { onChange?.(e); resize(); }} />;
}

// ─── SetekInlineEditor ───────────────────────────────────────────────────────

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
  const displayContent = setek.content?.trim() ? setek.content : (setek.imported_content ?? "");
  const [content, setContent] = useState(displayContent);
  const queryClient = useQueryClient();

  useEffect(() => {
    const next = setek.content?.trim() ? setek.content : (setek.imported_content ?? "");
    setContent(next);
  }, [setek.content, setek.imported_content]);

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

  const [draftGenerating, setDraftGenerating] = useState(false);
  const hasDraft = !!setek.ai_draft_content;
  const draftContent = setek.ai_draft_content ?? null;

  async function handleGenerateDraft() {
    setDraftGenerating(true);
    try {
      const { generateSetekDraftAction } = await import(
        "@/lib/domains/student-record/llm/actions/generateSetekDraft"
      );
      const subjectName = setek.subject_id;
      const result = await generateSetekDraftAction(setek.id, {
        subjectName,
        grade,
        existingContent: content || undefined,
      });
      if (result.success && result.data) {
        queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
      }
    } finally {
      setDraftGenerating(false);
    }
  }

  async function handleAcceptDraft() {
    const { acceptAiDraftAction } = await import(
      "@/lib/domains/student-record/actions/confirm"
    );
    const result = await acceptAiDraftAction(setek.id, "setek");
    if (!result.success) {
      if ("error" in result && result.error === "CONTENT_EXISTS") {
        if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
        const forced = await acceptAiDraftAction(setek.id, "setek", true);
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

  return (
    <>
      {showSemesterLabel && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
      )}
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
        className="w-full min-h-16 resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
        placeholder="세특 내용을 입력하세요..."
      />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <SaveStatusIndicator status={status} error={error} />
          {status === "error" && (
            <button onClick={saveNow} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">재시도</button>
          )}
          {!content && !hasDraft && (
            <button
              type="button"
              onClick={handleGenerateDraft}
              disabled={draftGenerating}
              className="text-xs text-violet-600 hover:text-violet-800 dark:text-violet-400 disabled:opacity-50"
            >
              {draftGenerating ? "생성 중..." : "AI 초안 생성"}
            </button>
          )}
        </div>
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </>
  );
}

// ─── SetekTableRow ───────────────────────────────────────────────────────────

export function SetekTableRow({
  row,
  charLimit,
  studentId,
  schoolYear,
  tenantId,
  grade,
  activeTab,
  subjectTags,
  subjectReflection,
  subjectGuides,
  subjectDirection,
}: {
  row: MergedSetekRow;
  charLimit: number;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  activeTab: SetekLayerTab;
  subjectTags: ActivityTagLike[];
  subjectReflection?: SubjectReflectionRate;
  subjectGuides: Array<{ id: string; status: string; target_subject_id?: string | null; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  subjectDirection: SetekGuideItemLike[];
}) {
  const ctx = useStudentRecordContext();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { removeSetekAction } = await import("@/lib/domains/student-record/actions/record");
      for (const r of row.records) {
        const res = await removeSetekAction(r.id);
        if (!res.success) throw new Error("error" in res ? res.error : "삭제 실패");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
    },
    onError: () => { /* 에러는 mutation.isError로 표시 */ },
  });

  const isGridActive = ctx?.activeSubjectId === row.subjectId;
  const toggleContextGrid = () => {
    if (isGridActive) {
      ctx?.setActiveSubjectId?.(null);
      ctx?.setActiveSchoolYear?.(null);
      ctx?.setActiveSubjectName?.(null);
    } else {
      ctx?.setActiveSubjectId?.(row.subjectId);
      ctx?.setActiveSchoolYear?.(schoolYear);
      ctx?.setActiveSubjectName?.(row.displayName);
    }
  };

  // B7: 과목 기준 단계 계산 (가장 높은 단계 기준)
  const rowStage = (() => {
    const stages = row.records.map(computeRecordStage);
    const order = ["final", "confirmed", "consultant", "ai_draft", "prospective"] as const;
    for (const s of order) {
      if (stages.includes(s)) return s;
    }
    return "prospective" as const;
  })();
  const stageConfig = GRADE_STAGE_CONFIG[rowStage];

  const subjectCell = (rowSpan?: number) => (
    <td rowSpan={rowSpan} className={`${B} px-3 py-2 text-center align-middle text-sm font-medium text-[var(--text-primary)]`}>
      <div className="flex flex-col items-center gap-0.5">
        <span>{row.displayName}</span>
        <span className={cn("inline-block rounded-full px-1.5 py-0 text-xs font-medium", stageConfig.bgClass, stageConfig.textClass)}>
          {stageConfig.label}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleContextGrid}
            className={cn(
              "text-xs transition-colors",
              isGridActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
            )}
            title={isGridActive ? "그리드 닫기" : "컨텍스트 그리드 열기"}
          >
            {isGridActive ? "⤡" : "⤢"}
          </button>
          <button
            type="button"
            onClick={() => { if (confirm(`${row.displayName} 세특을 삭제하시겠습니까?`)) deleteMutation.mutate(); }}
            disabled={deleteMutation.isPending}
            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
          >
            {deleteMutation.isPending ? "삭제 중..." : "삭제"}
          </button>
          {deleteMutation.isError && <span className="text-[11px] text-red-500">{deleteMutation.error.message}</span>}
        </div>
      </div>
    </td>
  );

  if (activeTab === "neis") {
    return (
      <>
        {row.records.map((setek, idx) => (
          <tr key={setek.id} className="align-top">
            {idx === 0 && (
              <>
                <td rowSpan={row.records.length} className={`${B} px-2 py-2 text-center align-middle text-sm text-[var(--text-primary)]`}>{grade}</td>
                {subjectCell(row.records.length)}
              </>
            )}
            <td className={`${B} p-1`}>
              {row.records.length > 1 && (
                <p className="mb-1 px-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
              )}
              <SetekInlineEditor setek={setek} charLimit={charLimit} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} showSemesterLabel={false} />
            </td>
          </tr>
        ))}
      </>
    );
  }

  return (
    <tr className="align-top">
      <td className={`${B} px-2 py-2 text-center align-middle text-sm text-[var(--text-primary)]`}>{grade}</td>
      {subjectCell()}
      <td className={`${B} p-2`}>
        {activeTab === "analysis" && (
          <AnalysisExpandableCell
            subjectTags={subjectTags}
            subjectReflection={subjectReflection}
            row={row}
            studentId={studentId}
            tenantId={tenantId}
            schoolYear={schoolYear}
          />
        )}

        {activeTab === "guide" && (
          <div className="flex flex-col gap-1">
            {subjectGuides.length > 0 ? subjectGuides.map((g) => (
              <div key={g.id} className="flex items-center gap-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", g.status === "completed" ? "bg-emerald-500" : g.status === "in_progress" ? "bg-amber-500" : "bg-gray-300")} />
                <span className="truncate text-xs text-[var(--text-primary)]">{g.exploration_guides?.title ?? "가이드"}</span>
                <span className="shrink-0 text-xs text-[var(--text-tertiary)]">{g.status === "completed" ? "완료" : g.status === "in_progress" ? "진행" : "배정"}</span>
              </div>
            )) : (
              <span className="text-xs text-[var(--text-placeholder)]">배정된 가이드 없음</span>
            )}
          </div>
        )}

        {activeTab === "direction" && (
          <div className="flex flex-col gap-1.5">
            {subjectDirection.length > 0 ? subjectDirection.map((d, i) => (
              <div key={i} className="flex flex-col gap-1">
                <p className="text-xs text-[var(--text-primary)] line-clamp-2">{d.direction}</p>
                {d.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {d.keywords.slice(0, 5).map((kw) => (
                      <span key={kw} className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">{kw}</span>
                    ))}
                  </div>
                )}
                {d.teacherPoints && d.teacherPoints.length > 0 && (
                  <p className="text-xs text-[var(--text-tertiary)]">교사: {d.teacherPoints[0]}</p>
                )}
              </div>
            )) : (
              <span className="text-xs text-[var(--text-placeholder)]">방향 가이드 없음</span>
            )}
          </div>
        )}

        {activeTab === "draft" && (
          <DraftExpandableCell
            records={row.records}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            grade={grade}
            charLimit={charLimit}
          />
        )}
      </td>
    </tr>
  );
}
