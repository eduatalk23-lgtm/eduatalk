"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveChangcheAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit, CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, MessageSquare, StickyNote, ChevronDown, PenLine } from "lucide-react";
import { DraftBlock, DRAFT_BLOCK_STYLES } from "./shared/DraftBlocks";
import { InlineAreaMemos } from "./InlineAreaMemos";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "./shared/AnalysisBlocks";
import { AnalysisBlock, COMPETENCY_LABELS, EVAL_COLORS } from "./shared/AnalysisBlocks";

const ACTIVITY_TYPES: ChangcheActivityType[] = ["autonomy", "club", "career"];

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type ChangcheLayerTab = "chat" | "guide" | "draft" | "neis" | "analysis" | "memo";

const CHANGCHE_TABS: { key: ChangcheLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "chat", label: "논의", icon: MessageSquare },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "memo", label: "메모", icon: StickyNote },
];

// ─── 타입 ──────────────────────────────────────

type ChangcheEditorProps = {
  changche: RecordChangche[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: AnalysisTagLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
};

// ─── 메인 컴포넌트 ──────────────────────────────────

export function ChangcheEditor({
  changche,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
  guideAssignments,
}: ChangcheEditorProps) {
  const [activeTab, setActiveTab] = useState<ChangcheLayerTab>("neis");

  // 모든 changche ID (분석 필터용)
  const allChangcheIds = useMemo(() => new Set(changche.map((c) => c.id)), [changche]);

  // 역량 태그 필터: changche record_type만
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "changche" && allChangcheIds.has(t.record_id),
    );
  }, [diagnosisActivityTags, allChangcheIds]);

  // 사이드 패널 연결
  const { setActiveSubjectId } = useStudentRecordContext();
  const sidePanel = useSidePanel();

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 ───────────────────────── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
        {CHANGCHE_TABS.map((tab) => {
          const hasData = tab.key === "neis" ? changche.length > 0
            : tab.key === "draft" ? changche.some((c) => c.content?.trim() || c.ai_draft_content || c.confirmed_content?.trim())
            : tab.key === "analysis" ? filteredTags.length > 0
            : tab.key === "guide" ? (guideAssignments?.length ?? 0) > 0
            : false;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "inline-flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
              )}
              title={tab.label}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">{tab.label}</span>
              {hasData && tab.key !== "neis" && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── 통합 테이블 (모든 탭에서 유지 — 세특과 동일 패턴) ─── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} w-24 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>영역</th>
              {activeTab === "neis" && (
                <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>시간</th>
              )}
              <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
                {activeTab === "neis" ? "특기사항"
                  : activeTab === "draft" ? "가안"
                  : activeTab === "analysis" ? "역량 분석"
                  : activeTab === "guide" ? "활동 가이드"
                  : activeTab === "memo" ? "메모"
                  : "논의"}
              </th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_TYPES.map((type, idx) => {
              const record = changche.find((c) => c.activity_type === type);
              const typeTags = record ? filteredTags.filter((t) => t.record_id === record.id) : [];
              return (
                <tr key={type} className="align-top">
                  {idx === 0 && (
                    <td rowSpan={ACTIVITY_TYPES.length} className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
                      {grade}
                    </td>
                  )}
                  <td className={`${B} px-2 py-1.5 text-center align-middle whitespace-nowrap`}>
                    <span className="text-xs font-medium text-[var(--text-primary)]">
                      {CHANGCHE_TYPE_LABELS[type]}
                    </span>
                    {activeTab === "neis" && record && <RecordStatusBadge status={record.status} />}
                  </td>
                  {activeTab === "neis" && (
                    <td className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
                      {record?.hours ?? "-"}
                    </td>
                  )}
                  <td className={`${B} p-1`}>
                    {activeTab === "neis" && (
                      <ChangcheNEISCell activityType={type} existing={record} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} />
                    )}
                    {activeTab === "draft" && (
                      record ? (
                        <ChangcheDraftCell record={record} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} />
                      ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                    )}
                    {activeTab === "analysis" && (
                      record ? (
                        <ChangcheAnalysisCell typeTags={typeTags} record={record} activityType={type} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} />
                      ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                    )}
                    {activeTab === "guide" && (
                      (() => {
                        const typeGuides = guideAssignments ?? [];
                        return typeGuides.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {typeGuides.map((a) => (
                              <div key={a.id} className="flex items-center gap-1.5">
                                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                                  a.status === "completed" ? "bg-emerald-500" : a.status === "in_progress" ? "bg-amber-500" : "bg-gray-300")} />
                                <span className="truncate text-xs text-[var(--text-primary)]">{a.exploration_guides?.title ?? "가이드"}</span>
                              </div>
                            ))}
                          </div>
                        ) : <span className="text-xs text-[var(--text-placeholder)]">배정된 가이드 없음</span>;
                      })()
                    )}
                    {activeTab === "memo" && (
                      <InlineAreaMemos studentId={studentId} areaType="changche" areaId={type} areaLabel={CHANGCHE_TYPE_LABELS[type]} />
                    )}
                    {activeTab === "chat" && (
                      <button
                        type="button"
                        onClick={() => {
                          if (setActiveSubjectId) { setActiveSubjectId(`changche:${type}`); }
                          sidePanel.openApp("chat");
                        }}
                        className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        채팅 열기
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── NEIS 셀: 인라인 편집 (테이블 셀 내부 컨텐츠만) ──────────────

function ChangcheNEISCell({
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

  const hasDraft = !!existing?.ai_draft_content;
  const draftContent = existing?.ai_draft_content ?? null;

  async function handleAcceptDraft() {
    if (!existing) return;
    const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
    const result = await acceptAiDraftAction(existing.id, "changche");
    if (result.success) {
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
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
        </div>
        <CharacterCounter content={content} charLimit={charLimit} />
      </div>
    </div>
  );
}

// ─── 🔍분석 탭: 영역별 AnalysisExpandableCell (세특 과목별과 동일 패턴) ──

function ChangcheAnalysisCell({
  typeTags,
  record,
  activityType,
  studentId,
  tenantId,
  schoolYear,
}: {
  typeTags: AnalysisTagLike[];
  record: RecordChangche;
  activityType: ChangcheActivityType;
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => typeTags.filter((t) => t.source === "ai"), [typeTags]);
  const manualTags = useMemo(() => typeTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [typeTags]);
  const confirmedTags = useMemo(() => typeTags.filter((t) => t.status === "confirmed"), [typeTags]);

  const content = useMemo(
    () => record.content?.trim() || record.imported_content || "",
    [record],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records: [{ id: record.id, content: record.content, imported_content: record.imported_content }],
    displayName: CHANGCHE_TYPE_LABELS[activityType],
    recordType: "changche" as const,
  }), [studentId, tenantId, schoolYear, record, activityType]);

  const diagnosisQk = ["studentRecord", "diagnosisTab", studentId] as const;

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId, student_id: studentId,
          record_type: t.record_type as "changche",
          record_id: t.record_id, competency_item: t.competency_item,
          evaluation: t.evaluation as "positive" | "negative" | "needs_review",
          evidence_summary: t.evidence_summary ?? null,
          source: "manual" as const, status: "suggested" as const,
        }));
      if (inputs.length > 0) {
        const res = await addActivityTagsBatchAction(inputs);
        if (!res.success) throw new Error("error" in res ? res.error : "복사 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const importConsultantMutation = useMutation({
    mutationFn: async () => {
      const { confirmActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of manualTags) {
        const res = await confirmActivityTagAction(t.id);
        if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tag: AnalysisTagLike) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const res = await deleteActivityTagAction(tag.id);
      if (!res.success) throw new Error("error" in res ? res.error : "삭제 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async (tagsToDelete: AnalysisTagLike[]) => {
      const { deleteActivityTagAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      for (const t of tagsToDelete) { await deleteActivityTagAction(t.id); }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: diagnosisQk }); },
  });

  return (
    <div className="flex flex-col gap-1.5">
      {/* 접힌 상태: 요약 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left"
      >
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {typeTags.length > 0 ? typeTags.slice(0, 4).map((t, i) => (
            <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
              EVAL_COLORS[t.evaluation || "needs_review"],
            )}>
              {COMPETENCY_LABELS[t.competency_item || ""] || t.competency_item}
            </span>
          )) : (
            <span className="text-sm text-[var(--text-placeholder)]">태그 없음</span>
          )}
          {typeTags.length > 4 && (
            <span className="text-xs text-[var(--text-tertiary)]">+{typeTags.length - 4}</span>
          )}
        </div>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {/* 펼친 상태: 3개 독립 블록 */}
      {expanded && (
        <div className="mt-1 flex flex-col gap-3">
          <AnalysisBlock
            label="AI"
            tags={aiTags}
            content={content}
            mode={aiMode}
            setMode={setAiMode}
          />
          <AnalysisBlock
            label="컨설턴트"
            tags={manualTags}
            content={content}
            mode={consultantMode}
            setMode={setConsultantMode}
            importAction={aiTags.length > 0 ? () => importAiMutation.mutate() : undefined}
            importLabel="AI 가져오기"
            isImporting={importAiMutation.isPending}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`컨설턴트 태그 ${manualTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(manualTags); }}
          />
          <AnalysisBlock
            label="확정"
            tags={confirmedTags}
            content={content}
            mode={confirmedMode}
            setMode={setConfirmedMode}
            importAction={manualTags.length > 0 ? () => importConsultantMutation.mutate() : undefined}
            importLabel="컨설턴트 가져오기"
            isImporting={importConsultantMutation.isPending}
            taggerProps={taggerProps}
            onDeleteTag={(tag) => { if (confirm("태그를 삭제하시겠습니까?")) deleteTagMutation.mutate(tag); }}
            onDeleteAll={() => { if (confirm(`확정 태그 ${confirmedTags.length}건을 모두 삭제하시겠습니까?`)) deleteAllMutation.mutate(confirmedTags); }}
          />
        </div>
      )}
    </div>
  );
}

// ─── ✏️가안 탭: 영역별 접기/펼치기 + 3블록 (AI 초안 / 컨설턴트 가안 / 확정본) ──


function ChangcheDraftCell({
  record,
  studentId,
  schoolYear,
  tenantId,
  grade,
}: {
  record: RecordChangche;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const charLimit = getCharLimit(record.activity_type as "autonomy" | "club" | "career", schoolYear);
  const recordQk = studentRecordKeys.recordTab(studentId, schoolYear);

  const hasAny = !!(record.ai_draft_content || record.content?.trim() || record.confirmed_content?.trim());
  const summaryParts: string[] = [];
  if (record.ai_draft_content) summaryParts.push("AI");
  if (record.content?.trim()) summaryParts.push("가안");
  if (record.confirmed_content?.trim()) summaryParts.push("확정");

  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      if (record.ai_draft_content && !record.content?.trim()) {
        const res = await acceptAiDraftAction(record.id, "changche");
        if (!res.success) throw new Error("error" in res ? res.error : "수용 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      if (record.content?.trim()) {
        const res = await confirmDraftAction(record.id, "changche");
        if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSaveContent = useCallback(async (content: string) => {
    await saveChangcheAction({
      student_id: studentId, school_year: schoolYear, tenant_id: tenantId,
      grade, activity_type: record.activity_type, content, char_limit: charLimit,
    }, schoolYear);
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [studentId, schoolYear, tenantId, grade, record.activity_type, charLimit, queryClient, recordQk]);

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 text-left">
        <span className="flex-1 text-xs text-[var(--text-secondary)]">
          {hasAny ? summaryParts.join(" / ") : "가안 없음"}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="mt-1 flex flex-col gap-3">
          {/* AI 초안 */}
          <DraftBlock
            label="AI 초안" style={DRAFT_BLOCK_STYLES.ai}
            content={record.ai_draft_content}
          />
          {/* 컨설턴트 가안 */}
          <DraftBlock
            label="컨설턴트 가안" style={DRAFT_BLOCK_STYLES.consultant}
            content={record.content} editable charLimit={charLimit}
            onSave={handleSaveContent}
            importAction={record.ai_draft_content && !record.content?.trim() ? () => acceptAiMutation.mutate() : undefined}
            importLabel="AI 초안 수용" isImporting={acceptAiMutation.isPending}
          />
          {/* 확정본 */}
          <DraftBlock
            label="확정본" style={DRAFT_BLOCK_STYLES.confirmed}
            content={record.confirmed_content}
            importAction={record.content?.trim() ? () => confirmMutation.mutate() : undefined}
            importLabel="가안 확정" isImporting={confirmMutation.isPending}
          />
        </div>
      )}
    </div>
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
