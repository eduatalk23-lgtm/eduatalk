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
import { computeRecordStage, GRADE_STAGE_CONFIG, getConfirmStatus } from "@/lib/domains/student-record/grade-stage";
import { ConfirmStatusBadge } from "../shared/ConfirmStatusBadge";
import {
  type LayerKey,
  type LayerPerspective,
  isLayerSupportedInEditor,
  getDirectionMode,
  LAYER_DEFINITIONS,
} from "@/lib/domains/student-record/layer-view";
import type { MergedSetekRow, SetekLayerTab, SetekGuideItemLike } from "../stages/record/SetekEditor";
import { matchKeywordInText, type SubjectReflectionRate } from "@/lib/domains/student-record/keyword-match";
import type { AnalysisTagLike } from "../shared/AnalysisBlocks";
import { COMPETENCY_LABELS } from "../shared/AnalysisBlocks";
import { AnalysisExpandableCell } from "./SetekAnalysisCell";
import { DraftExpandableCell } from "./SetekDraftCell";
import { ConsultantDirectionEditor } from "../shared/ConsultantDirectionEditor";
import {
  saveConsultantSetekGuideAction,
  deleteConsultantSetekGuideAction,
} from "@/lib/domains/student-record/actions/guide-consultant";

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

  return (
    <>
      {showSemesterLabel && (
        <p className="mb-1 text-xs font-medium text-[var(--text-tertiary)]">{setek.semester}학기</p>
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
  layer,
  perspective,
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
  /** Phase 2.1: 9 레이어 글로벌 선택. 미지원 레이어면 셀에 stub 표시. */
  layer?: LayerKey;
  /** Phase 2.1: 글로벌 관점 (현재 SetekTableRow는 표시 분기에 직접 사용하지 않음 — SetekEditor에서 필터링) */
  perspective?: LayerPerspective | null;
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

  // Phase 2.1: 가안 탭 + 컨설턴트 관점일 때만 확정 배지 표시
  const rowConfirmStatus = (() => {
    if (activeTab !== "draft") return null;
    // 관점 미지정이면 표시 (레거시 호환), 컨설턴트일 때 명시적 표시
    if (perspective === "ai") return null; // AI 관점에선 확정 개념 없음
    const statuses = row.records.map(getConfirmStatus);
    // 우선순위: confirmed_then_edited > drafting > confirmed > empty (재확정 필요 신호 우선)
    const priority = ["confirmed_then_edited", "drafting", "confirmed", "empty"] as const;
    for (const s of priority) {
      if (statuses.includes(s)) return s;
    }
    return null;
  })();

  // 미지원 레이어 stub 셀 (생기부 모형은 유지, 셀 내용만 placeholder)
  const isUnsupportedLayer = layer != null && !isLayerSupportedInEditor(layer);
  // direction 레이어일 때 prospective/retrospective 구분
  const directionMode = layer ? getDirectionMode(layer) : null;

  const subjectCell = (rowSpan?: number) => (
    <td rowSpan={rowSpan} className={`${B} px-3 py-2 text-center align-middle text-sm font-medium text-[var(--text-primary)]`}>
      <div className="flex flex-col items-center gap-0.5">
        <span>{row.displayName}</span>
        <span className={cn("inline-block rounded-full px-1.5 py-0 text-xs font-medium", stageConfig.bgClass, stageConfig.textClass)}>
          {stageConfig.label}
        </span>
        {rowConfirmStatus && (
          <ConfirmStatusBadge status={rowConfirmStatus} hideEmpty className="mt-0.5" />
        )}
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

  // Phase 2.1: 미지원 레이어 stub — NEIS 분기 + 일반 분기보다 먼저 처리
  if (isUnsupportedLayer && layer) {
    const def = LAYER_DEFINITIONS[layer];
    return (
      <tr className="align-top">
        <td className={`${B} px-2 py-2 text-center align-middle text-sm text-[var(--text-primary)]`}>{grade}</td>
        {subjectCell()}
        <td className={`${B} p-2`}>
          <div className="flex flex-col gap-0.5 rounded border border-dashed border-gray-300 bg-gray-50/50 px-3 py-2 text-xs text-[var(--text-tertiary)]">
            <span className="font-medium text-[var(--text-secondary)]">{def.label} 레이어 — 작업 예정</span>
            <span className="text-[10px] italic">{def.description}</span>
          </div>
        </td>
      </tr>
    );
  }

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
        {/* 분석 / 가안 분석: subjectTags는 SetekEditor에서 이미 tag_context별로 분리된 채 전달된다.
            recordTab으로 원문 하이라이트용 콘텐츠 소스를 NEIS/가안 중 하나로 고정한다. */}
        {(activeTab === "analysis" || activeTab === "draft_analysis") && (
          <AnalysisExpandableCell
            subjectTags={subjectTags}
            subjectReflection={activeTab === "analysis" ? subjectReflection : undefined}
            row={row}
            studentId={studentId}
            tenantId={tenantId}
            schoolYear={schoolYear}
            perspective={perspective}
            recordTab={activeTab}
          />
        )}

        {activeTab === "direction" && (() => {
          // AI 가이드 / manual 가이드 분리 (legacy: source 없는 항목은 AI로 간주)
          const aiGuides = subjectDirection.filter((d) => (d.source ?? "ai") === "ai");
          // manual 가이드는 schoolYear로도 필터 — 컨설턴트가 학년별로 작성할 수 있게
          const manualGuides = subjectDirection.filter(
            (d) => d.source === "manual" && d.schoolYear === schoolYear,
          );
          const recordText = row.records
            .map((r) => r.content?.trim() || r.imported_content || "")
            .join(" ");

          // 컨설턴트 관점 + 보완/설계방향: 에디터 표시
          const isConsultantDirection =
            perspective === "consultant" &&
            (directionMode === "retrospective" || directionMode === "prospective");

          if (isConsultantDirection) {
            const guideMode = directionMode === "prospective" ? "prospective" : "retrospective";
            const onInvalidate = () => {
              queryClient.invalidateQueries({ queryKey: studentRecordKeys.setekGuides(studentId) });
            };
            return (
              <div className="flex flex-col gap-2">
                {manualGuides.map((g) => (
                  <ConsultantDirectionEditor
                    key={g.id ?? `new-${g.subjectName}`}
                    guideId={g.id ?? null}
                    initialDirection={g.direction}
                    initialKeywords={g.keywords}
                    label={directionMode === "prospective" ? "컨설턴트 설계방향" : "컨설턴트 보완방향"}
                    onSave={async (draft) => {
                      const res = await saveConsultantSetekGuideAction({
                        id: g.id ?? null,
                        tenantId,
                        studentId,
                        schoolYear,
                        subjectId: row.subjectId,
                        guideMode,
                        direction: draft.direction,
                        keywords: draft.keywords,
                      });
                      if (res.success) onInvalidate();
                      return { success: res.success, error: !res.success ? res.error : undefined };
                    }}
                    onDelete={async () => {
                      if (!g.id) return { success: true };
                      const res = await deleteConsultantSetekGuideAction(g.id);
                      if (res.success) onInvalidate();
                      return { success: res.success, error: !res.success ? res.error : undefined };
                    }}
                  />
                ))}
                {manualGuides.length === 0 && (
                  <ConsultantDirectionEditor
                    guideId={null}
                    label={directionMode === "prospective" ? "컨설턴트 설계방향" : "컨설턴트 보완방향"}
                    placeholder={
                      directionMode === "prospective"
                        ? "앞으로 이 과목 세특을 어떻게 설계하면 좋을지 컨설턴트 관점을 작성하세요..."
                        : "이 과목 세특을 어떻게 보완하면 좋을지 컨설턴트 관점을 작성하세요..."
                    }
                    onSave={async (draft) => {
                      const res = await saveConsultantSetekGuideAction({
                        id: null,
                        tenantId,
                        studentId,
                        schoolYear,
                        subjectId: row.subjectId,
                        guideMode,
                        direction: draft.direction,
                        keywords: draft.keywords,
                      });
                      if (res.success) onInvalidate();
                      return { success: res.success, error: !res.success ? res.error : undefined };
                    }}
                  />
                )}
              </div>
            );
          }

          // AI 관점 (또는 legacy — perspective 미지정): 읽기 전용 표시
          const guidesToShow = perspective === "ai" ? aiGuides : subjectDirection;
          if (guidesToShow.length === 0) {
            return (
              <span className="text-xs text-[var(--text-placeholder)]">
                {directionMode === "prospective"
                  ? "설계방향 없음"
                  : directionMode === "retrospective"
                    ? "보완방향 없음"
                    : "방향 가이드 없음"}
              </span>
            );
          }
          return (
            <div className="flex flex-col gap-2">
              {guidesToShow.map((d, i) => (
                <div
                  key={d.id ?? i}
                  className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20"
                >
                  {/* 역량 포커스 배지 */}
                  {d.competencyFocus && d.competencyFocus.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.competencyFocus.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        >
                          {COMPETENCY_LABELS[c] || c}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 방향 텍스트 */}
                  <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{d.direction}</p>
                  {/* 키워드 (매칭/비매칭) */}
                  {d.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {d.keywords.map((kw) => {
                        const matched = recordText ? matchKeywordInText(kw, recordText) : false;
                        return (
                          <span
                            key={kw}
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              matched
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                            )}
                          >
                            {matched && "✓ "}
                            {kw}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {/* 교사 포인트 */}
                  {d.teacherPoints && d.teacherPoints.length > 0 && (
                    <div className="mt-1 border-t border-violet-200 pt-2 dark:border-violet-800">
                      <p className="mb-1 text-xs font-medium text-violet-600 dark:text-violet-400">교사 전달 포인트</p>
                      <ul className="list-inside list-disc text-xs text-[var(--text-secondary)]">
                        {d.teacherPoints.map((tp, j) => (
                          <li key={j}>{tp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {activeTab === "draft" && (
          <DraftExpandableCell
            records={row.records}
            studentId={studentId}
            schoolYear={schoolYear}
            tenantId={tenantId}
            grade={grade}
            charLimit={charLimit}
            perspective={perspective}
          />
        )}
      </td>
    </tr>
  );
}
