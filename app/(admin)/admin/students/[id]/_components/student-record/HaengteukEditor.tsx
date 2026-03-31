"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { saveHaengteukAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordHaengteuk } from "@/lib/domains/student-record";
import { CharacterCounter } from "./CharacterCounter";
import { RecordStatusBadge } from "./RecordStatusBadge";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { useAutoSave } from "./useAutoSave";
import { useStudentRecordContext } from "./StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, Compass, MessageSquare, StickyNote, ChevronDown, PenLine } from "lucide-react";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import { DraftBlock, DRAFT_BLOCK_STYLES } from "./shared/DraftBlocks";
import { InlineAreaMemos } from "./InlineAreaMemos";
import type { AnalysisTagLike, AnalysisBlockMode, TaggerProps } from "./shared/AnalysisBlocks";
import { AnalysisBlock, COMPETENCY_LABELS, EVAL_COLORS } from "./shared/AnalysisBlocks";
import type { SetekLayerTab } from "./SetekEditor";

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type HaengteukLayerTab = "chat" | "guide" | "direction" | "draft" | "neis" | "analysis" | "memo";

const HAENGTEUK_TABS: { key: HaengteukLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "chat", label: "논의", icon: MessageSquare },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "direction", label: "방향", icon: Compass },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "memo", label: "메모", icon: StickyNote },
];

const HAENGTEUK_VALID_TABS = new Set<string>(["chat", "guide", "direction", "draft", "neis", "analysis", "memo"]);

// ─── 행특 방향 가이드 타입 ──
interface HaengteukGuideItemLike {
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
  evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
}

// ─── 타입 ──────────────────────────────────────

type HaengteukEditorProps = {
  haengteuk: RecordHaengteuk | null;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: AnalysisTagLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  haengteukGuideItem?: HaengteukGuideItemLike;
  /** AI 초안 생성 시 참고할 세특 요약 (과목명: 내용 형태로 전달) */
  setekSummary?: string;
  /** AI 초안 생성 시 참고할 창체 요약 (자율/동아리/진로 내용 형태로 전달) */
  changcheSummary?: string;
  /** 학생 이름 (AI 초안 생성 시 자연스러운 서술을 위해 사용) */
  studentName?: string;
  /** 외부 제어 모드: 글로벌 레이어 바에서 탭 동기화 */
  activeTab?: SetekLayerTab;
  onTabChange?: (tab: SetekLayerTab) => void;
};

export function HaengteukEditor({
  haengteuk,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
  guideAssignments,
  haengteukGuideItem,
  setekSummary,
  changcheSummary,
  studentName,
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
}: HaengteukEditorProps) {
  const charLimit = getCharLimit("haengteuk", schoolYear);
  // content가 비어있으면 imported_content(NEIS 원문) 표시 (세특과 동일)
  const displayContent = haengteuk?.content?.trim() ? haengteuk.content : (haengteuk?.imported_content ?? "");
  const [content, setContent] = useState(displayContent);
  const [internalTab, setInternalTab] = useState<HaengteukLayerTab>("neis");
  const isControlled = controlledTab !== undefined;
  const activeTab: HaengteukLayerTab = isControlled
    ? (HAENGTEUK_VALID_TABS.has(controlledTab) ? controlledTab as HaengteukLayerTab : "neis")
    : internalTab;
  const setActiveTab = (t: HaengteukLayerTab) => {
    if (controlledOnTabChange) controlledOnTabChange(t);
    else setInternalTab(t);
  };
  const queryClient = useQueryClient();
  const [draftGenerating, setDraftGenerating] = useState(false);

  useEffect(() => {
    const next = haengteuk?.content?.trim() ? haengteuk.content : (haengteuk?.imported_content ?? "");
    setContent(next);
  }, [haengteuk?.content, haengteuk?.imported_content]);

  // 역량 태그 필터: haengteuk record_type만
  const filteredTags = useMemo(() => {
    if (!diagnosisActivityTags || !haengteuk) return [];
    return diagnosisActivityTags.filter(
      (t) => t.record_type === "haengteuk" && t.record_id === haengteuk.id,
    );
  }, [diagnosisActivityTags, haengteuk]);

  // 사이드 패널 + 컨텍스트 그리드 연결
  const ctx = useStudentRecordContext();
  const sidePanel = useSidePanel();

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

  async function handleGenerateDraft() {
    if (!haengteuk) return;
    setDraftGenerating(true);
    try {
      const { generateHaengteukDraftAction } = await import(
        "@/lib/domains/student-record/llm/actions/generateHaengteukDraft"
      );
      await generateHaengteukDraftAction(haengteuk.id, {
        grade,
        schoolYear,
        studentName,
        direction: haengteukGuideItem?.direction,
        keywords: haengteukGuideItem?.keywords,
        teacherPoints: haengteukGuideItem?.teacherPoints,
        evaluationItems: haengteukGuideItem?.evaluationItems,
        existingContent: haengteuk.imported_content ?? undefined,
        setekSummary,
        changcheSummary,
      });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
    } finally {
      setDraftGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 (controlled 모드면 GlobalLayerBar 사용) ─── */}
      {!isControlled && (
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
          {HAENGTEUK_TABS.map((tab) => {
            const hasData = tab.key === "neis" ? !!haengteuk
              : tab.key === "draft" ? !!(haengteuk?.ai_draft_content || haengteuk?.content?.trim() || haengteuk?.confirmed_content?.trim())
              : tab.key === "analysis" ? filteredTags.length > 0
              : tab.key === "guide" ? (guideAssignments?.length ?? 0) > 0
              : tab.key === "direction" ? !!haengteukGuideItem
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
      )}

      {/* ─── 통합 테이블 (모든 탭에서 유지 — 세특과 동일 패턴) ─── */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-14 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
                {activeTab === "neis" ? "행동특성 및 종합의견"
                  : activeTab === "draft" ? "가안"
                  : activeTab === "analysis" ? "역량 분석"
                  : activeTab === "guide" ? "활동 가이드"
                  : activeTab === "direction" ? "작성 방향"
                  : activeTab === "memo" ? "메모"
                  : "논의"}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className={`${B} px-2 py-1.5 text-center align-middle`}>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-[var(--text-primary)]">{grade}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (ctx.activeSubjectId === "haengteuk") {
                        ctx.setActiveSubjectId?.(null);
                        ctx.setActiveSchoolYear?.(null);
                        ctx.setActiveSubjectName?.(null);
                      } else {
                        ctx.setActiveSubjectId?.("haengteuk");
                        ctx.setActiveSchoolYear?.(schoolYear);
                        ctx.setActiveSubjectName?.("행동특성 및 종합의견");
                      }
                    }}
                    className={cn(
                      "text-xs transition-colors",
                      ctx.activeSubjectId === "haengteuk"
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
                    )}
                    title={ctx.activeSubjectId === "haengteuk" ? "그리드 닫기" : "컨텍스트 그리드 열기"}
                  >
                    {ctx.activeSubjectId === "haengteuk" ? "⤡" : "⤢"}
                  </button>
                  {activeTab === "neis" && haengteuk && <RecordStatusBadge status={haengteuk.status} />}
                </div>
              </td>
              <td className={`${B} p-1`}>
                {activeTab === "neis" && (
                  <div>
                    {/* AI 초안 배너 (세특과 동일) */}
                    {haengteuk?.ai_draft_content && !content && (
                      <div className="mb-1 rounded bg-violet-50 p-2 text-xs dark:bg-violet-900/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-violet-700 dark:text-violet-400">AI 초안</span>
                          <button type="button" onClick={async () => {
                            if (!haengteuk) return;
                            const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
                            // E1: 기존 content 보호
                            const result = await acceptAiDraftAction(haengteuk.id, "haengteuk");
                            if (!result.success) {
                              if ("error" in result && result.error === "CONTENT_EXISTS") {
                                if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
                                const forced = await acceptAiDraftAction(haengteuk.id, "haengteuk", true);
                                if (!forced.success) return;
                              } else if ("error" in result && result.error === "CONFLICT") {
                                alert("다른 사용자가 이미 수정했습니다. 페이지를 새로고침하세요.");
                                return;
                              } else {
                                return;
                              }
                            }
                            queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
                          }} className="rounded bg-violet-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-violet-700">수용</button>
                        </div>
                        <p className="text-violet-600 dark:text-violet-300 line-clamp-3">{haengteuk.ai_draft_content.slice(0, 200)}...</p>
                      </div>
                    )}
                    <AutoResizeTextarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full min-h-[4rem] resize-none border-0 bg-transparent p-1 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none"
                      placeholder="행동특성 및 종합의견을 입력하세요..."
                    />
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <SaveStatusIndicator status={status} error={error} />
                        {status === "error" && (
                          <button onClick={saveNow} className="text-xs text-indigo-600 hover:text-indigo-800 dark:text-indigo-400">재시도</button>
                        )}
                        {haengteuk && !content && !haengteuk.ai_draft_content && (
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
                )}
                {activeTab === "draft" && (
                  haengteuk ? (
                    <HaengteukDraftCell haengteuk={haengteuk} studentId={studentId} schoolYear={schoolYear} tenantId={tenantId} grade={grade} charLimit={charLimit} />
                  ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                )}
                {activeTab === "analysis" && (
                  haengteuk ? (
                    <HaengteukAnalysisCell filteredTags={filteredTags} haengteuk={haengteuk} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} />
                  ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                )}
                {activeTab === "guide" && (
                  (() => {
                    const guides = guideAssignments ?? [];
                    return guides.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {guides.map((a) => (
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
                {activeTab === "direction" && (
                  (() => {
                    const guide = haengteukGuideItem;
                    if (!guide) return <span className="text-xs text-[var(--text-placeholder)]">방향 가이드를 생성하면 표시됩니다</span>;
                    const recordText = content;
                    return (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                          {/* 역량 포커스 배지 */}
                          {guide.competencyFocus && guide.competencyFocus.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-1">
                              {guide.competencyFocus.map((c) => (
                                <span key={c} className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                                  {COMPETENCY_LABELS[c] || c}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* 방향 텍스트 */}
                          <p className="text-sm text-[var(--text-primary)]">{guide.direction}</p>
                          {/* 키워드 (매칭/비매칭) */}
                          {guide.keywords.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {guide.keywords.map((kw) => {
                                const matched = recordText ? matchKeywordInText(kw, recordText) : false;
                                return (
                                  <span key={kw} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                                    matched ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                      : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
                                  )}>
                                    {matched && "✓ "}{kw}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {/* 교사 포인트 */}
                          {guide.teacherPoints && guide.teacherPoints.length > 0 && (
                            <div className="mt-2 border-t border-violet-200 pt-2 dark:border-violet-800">
                              <p className="mb-1 text-xs font-medium text-violet-600 dark:text-violet-400">교사 전달 포인트</p>
                              <ul className="list-inside list-disc text-xs text-[var(--text-secondary)]">
                                {guide.teacherPoints.map((tp, i) => <li key={i}>{tp}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                        {/* 7개 평가항목 테이블 */}
                        {guide.evaluationItems && guide.evaluationItems.length > 0 && (
                          <div className="rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)]">평가 항목</th>
                                  <th className="w-16 px-2 py-1.5 text-center font-medium text-[var(--text-secondary)]">평가</th>
                                  <th className="px-2 py-1.5 text-left font-medium text-[var(--text-secondary)]">근거</th>
                                </tr>
                              </thead>
                              <tbody>
                                {guide.evaluationItems.map((ei) => (
                                  <tr key={ei.item} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                                    <td className="px-2 py-1.5 font-medium text-[var(--text-primary)]">{ei.item}</td>
                                    <td className="px-2 py-1.5 text-center">
                                      <span className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
                                        ei.score === "우수" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                          : ei.score === "양호" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                                      )}>{ei.score}</span>
                                    </td>
                                    <td className="px-2 py-1.5 text-[var(--text-secondary)]">{ei.reasoning}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
                {activeTab === "memo" && (
                  <InlineAreaMemos studentId={studentId} areaType="haengteuk" areaId="haengteuk" areaLabel="행동특성" />
                )}
                {activeTab === "chat" && (
                  <button
                    type="button"
                    onClick={() => {
                      ctx.setActiveSubjectId?.("haengteuk");
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 🔍분석 탭: 테이블 셀 내 접기/펼치기 + 공용 AnalysisBlock 3블록 ──

function HaengteukAnalysisCell({
  filteredTags,
  haengteuk,
  studentId,
  tenantId,
  schoolYear,
}: {
  filteredTags: AnalysisTagLike[];
  haengteuk: RecordHaengteuk;
  studentId: string;
  tenantId: string;
  schoolYear: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [aiMode, setAiMode] = useState<AnalysisBlockMode>("competency");
  const [consultantMode, setConsultantMode] = useState<AnalysisBlockMode>("tagging");
  const [confirmedMode, setConfirmedMode] = useState<AnalysisBlockMode>("tagging");
  const queryClient = useQueryClient();

  const aiTags = useMemo(() => filteredTags.filter((t) => t.source === "ai"), [filteredTags]);
  const manualTags = useMemo(() => filteredTags.filter((t) => (t.source === "manual" || !t.source) && t.status !== "confirmed"), [filteredTags]);
  const confirmedTags = useMemo(() => filteredTags.filter((t) => t.status === "confirmed"), [filteredTags]);

  const content = useMemo(
    () => haengteuk.content?.trim() || haengteuk.imported_content || "",
    [haengteuk],
  );

  const taggerProps: TaggerProps = useMemo(() => ({
    studentId, tenantId, schoolYear,
    records: [{ id: haengteuk.id, content: haengteuk.content, imported_content: haengteuk.imported_content }],
    displayName: "행동특성 및 종합의견",
    recordType: "haengteuk" as const,
  }), [studentId, tenantId, schoolYear, haengteuk]);

  const diagnosisQk = studentRecordKeys.diagnosisTabPrefix(studentId);

  const importAiMutation = useMutation({
    mutationFn: async () => {
      const { addActivityTagsBatchAction } = await import("@/lib/domains/student-record/actions/diagnosis");
      const existingKeys = new Set(manualTags.map((t) => `${t.record_id}:${t.competency_item}:${t.evaluation}`));
      const inputs = aiTags
        .filter((t) => !existingKeys.has(`${t.record_id}:${t.competency_item}:${t.evaluation}`))
        .map((t) => ({
          tenant_id: tenantId, student_id: studentId,
          record_type: t.record_type as "haengteuk",
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
          {filteredTags.length > 0 ? filteredTags.slice(0, 4).map((t, i) => (
            <span key={i} className={cn("rounded px-1.5 py-0.5 text-xs font-medium",
              EVAL_COLORS[t.evaluation || "needs_review"],
            )}>
              {COMPETENCY_LABELS[t.competency_item || ""] || t.competency_item}
            </span>
          )) : (
            <span className="text-sm text-[var(--text-placeholder)]">태그 없음</span>
          )}
          {filteredTags.length > 4 && (
            <span className="text-xs text-[var(--text-tertiary)]">+{filteredTags.length - 4}</span>
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

// ─── ✏️가안 탭: 접기/펼치기 + 3블록 ──────────────


function HaengteukDraftCell({
  haengteuk, studentId, schoolYear, tenantId, grade, charLimit,
}: {
  haengteuk: RecordHaengteuk;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  charLimit: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const recordQk = studentRecordKeys.recordTab(studentId, schoolYear);

  const hasAny = !!(haengteuk.ai_draft_content || haengteuk.content?.trim() || haengteuk.confirmed_content?.trim());
  const summaryParts: string[] = [];
  if (haengteuk.ai_draft_content) summaryParts.push("AI");
  if (haengteuk.content?.trim()) summaryParts.push("가안");
  if (haengteuk.confirmed_content?.trim()) summaryParts.push("확정");

  // E1: content 보호, E4: 낙관적 잠금
  const acceptAiMutation = useMutation({
    mutationFn: async () => {
      const { acceptAiDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await acceptAiDraftAction(haengteuk.id, "haengteuk");
      if (!res.success) {
        if ("error" in res && res.error === "CONTENT_EXISTS") {
          if (!confirm("기존 작성 내용이 있습니다. AI 초안으로 덮어쓰시겠습니까?")) return;
          const forced = await acceptAiDraftAction(haengteuk.id, "haengteuk", true);
          if (!forced.success && "error" in forced && forced.error === "CONFLICT") {
            throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
          }
        } else if ("error" in res && res.error === "CONFLICT") {
          throw new Error("다른 사용자가 이미 수정했습니다. 새로고침 후 다시 시도해주세요.");
        } else {
          throw new Error("error" in res ? res.error : "수용 실패");
        }
      }
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const { confirmDraftAction } = await import("@/lib/domains/student-record/actions/confirm");
      const res = await confirmDraftAction(haengteuk.id, "haengteuk");
      if (!res.success) throw new Error("error" in res ? res.error : "확정 실패");
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: recordQk }); },
  });

  const handleSaveContent = useCallback(async (val: string) => {
    await saveHaengteukAction({ student_id: studentId, school_year: schoolYear, tenant_id: tenantId, grade, content: val, char_limit: charLimit }, schoolYear);
    queryClient.invalidateQueries({ queryKey: recordQk });
  }, [studentId, schoolYear, tenantId, grade, charLimit, queryClient, recordQk]);

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
          <DraftBlock label="AI 초안" style={DRAFT_BLOCK_STYLES.ai} content={haengteuk.ai_draft_content} />
          <DraftBlock label="컨설턴트 가안" style={DRAFT_BLOCK_STYLES.consultant} content={haengteuk.content} editable charLimit={charLimit} onSave={handleSaveContent}
            importAction={haengteuk.ai_draft_content && !haengteuk.content?.trim() ? () => acceptAiMutation.mutate() : undefined}
            importLabel="AI 초안 수용" isImporting={acceptAiMutation.isPending}
            neisHint />
          <DraftBlock label="확정본" style={DRAFT_BLOCK_STYLES.confirmed} content={haengteuk.confirmed_content}
            importAction={haengteuk.content?.trim() ? () => confirmMutation.mutate() : undefined}
            importLabel="가안 확정" isImporting={confirmMutation.isPending}
            staleWarning={
              // E5: 확정본이 있으나 현재 가안과 다르면 경고
              haengteuk.confirmed_content?.trim() && haengteuk.content?.trim() && haengteuk.content !== haengteuk.confirmed_content
                ? "가안과 다름" : undefined
            }
          />
        </div>
      )}
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
