"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { saveHaengteukAction } from "@/lib/domains/student-record/actions/record";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { getCharLimit } from "@/lib/domains/student-record";
import type { RecordHaengteuk } from "@/lib/domains/student-record";
import { CharacterCounter } from "../../CharacterCounter";
import { RecordStatusBadge } from "../../RecordStatusBadge";
import { SaveStatusIndicator } from "../../SaveStatusIndicator";
import { useAutoSave } from "../../useAutoSave";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, Compass, MessageSquare, StickyNote, PenLine, BarChart3 } from "lucide-react";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import { InlineAreaMemos } from "../../InlineAreaMemos";
import type { AnalysisTagLike } from "../../shared/AnalysisBlocks";
import { COMPETENCY_LABELS } from "../../shared/AnalysisBlocks";
import type { SetekLayerTab } from "./SetekEditor";
import {
  type LayerKey,
  type LayerPerspective,
  LAYER_DEFINITIONS,
  layerToChangcheTab,
  getDirectionMode,
} from "@/lib/domains/student-record/layer-view";
import { getConfirmStatus } from "@/lib/domains/student-record/grade-stage";
import { ConfirmStatusBadge } from "../../shared/ConfirmStatusBadge";
import { HaengteukAnalysisCell } from "../../haengteuk/HaengteukAnalysisCell";
import { HaengteukDraftCell } from "../../haengteuk/HaengteukDraftCell";
import { ConsultantDirectionEditor } from "../../shared/ConsultantDirectionEditor";
import {
  saveConsultantHaengteukGuideAction,
  deleteConsultantHaengteukGuideAction,
} from "@/lib/domains/student-record/actions/guide-consultant";

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type HaengteukLayerTab = "chat" | "guide" | "direction" | "draft" | "neis" | "analysis" | "draft_analysis" | "memo";

const HAENGTEUK_TABS: { key: HaengteukLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "chat", label: "논의", icon: MessageSquare },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "direction", label: "방향", icon: Compass },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "draft_analysis", label: "가안 분석", icon: BarChart3 },
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "memo", label: "메모", icon: StickyNote },
];

const HAENGTEUK_VALID_TABS = new Set<string>(["chat", "guide", "direction", "draft", "neis", "analysis", "draft_analysis", "memo"]);

// ─── 행특 방향 가이드 타입 ──
interface HaengteukGuideItemLike {
  /** DB row id — manual 가이드 수정/삭제 시 필요 */
  id?: string;
  /** 가이드 소스 — 'ai' | 'manual'. 없으면 legacy(=ai로 간주) */
  source?: "ai" | "manual";
  schoolYear: number;
  keywords: string[];
  direction: string;
  competencyFocus?: string[];
  cautions?: string;
  teacherPoints?: string[];
  evaluationItems?: Array<{ item: string; score: string; reasoning: string }>;
}

// ─── 타입 ──────────────────────────────────────

// 행특 방향 가이드도 guide_mode를 인지해야 design vs improve 분리 가능
interface HaengteukGuideItemWithMode extends HaengteukGuideItemLike {
  guideMode?: "prospective" | "retrospective";
}

type HaengteukEditorProps = {
  haengteuk: RecordHaengteuk | null;
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: AnalysisTagLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; ai_recommendation_reason?: string | null; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  /**
   * 행특 방향 가이드 배열 (전 학년, 설계/보완 양쪽 포함).
   * 내부에서 `schoolYear` + `guideMode`로 필터링한다.
   */
  haengteukGuideItems?: HaengteukGuideItemWithMode[];
  /** AI 초안 생성 시 참고할 세특 요약 (과목명: 내용 형태로 전달) */
  setekSummary?: string;
  /** AI 초안 생성 시 참고할 창체 요약 (자율/동아리/진로 내용 형태로 전달) */
  changcheSummary?: string;
  /** 학생 이름 (AI 초안 생성 시 자연스러운 서술을 위해 사용) */
  studentName?: string;
  /** 외부 제어 모드 (legacy — layer가 우선) */
  activeTab?: SetekLayerTab;
  onTabChange?: (tab: SetekLayerTab) => void;
  /** 글로벌 9 레이어 — controlled 진입점 */
  layer?: LayerKey;
  /** 글로벌 관점 (AI/컨설턴트) */
  perspective?: LayerPerspective | null;
};

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
  return <textarea ref={ref} {...props} onChange={(e) => { onChange?.(e); resize(); }} />;
}

// ─── 메인 컴포넌트 ──────────────────────────────────

export function HaengteukEditor({
  haengteuk,
  studentId,
  schoolYear,
  tenantId,
  grade,
  diagnosisActivityTags,
  guideAssignments,
  haengteukGuideItems,
  setekSummary,
  changcheSummary,
  studentName,
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
  layer,
  perspective,
}: HaengteukEditorProps) {
  const charLimit = getCharLimit("haengteuk", schoolYear);
  // content가 비어있으면 imported_content(NEIS 원문) 표시 (세특과 동일)
  const displayContent = haengteuk?.content?.trim() ? haengteuk.content : (haengteuk?.imported_content ?? "");
  const [content, setContent] = useState(displayContent);
  const [internalTab, setInternalTab] = useState<HaengteukLayerTab>("neis");

  // 우선순위: layer(9레이어) > controlledTab(레거시) > internalTab
  const mappedFromLayer = layer ? layerToChangcheTab(layer) : undefined;
  const isUnsupportedLayer = layer != null && mappedFromLayer === null;
  const isControlled = layer !== undefined || controlledTab !== undefined;
  const activeTab: HaengteukLayerTab = layer
    ? (mappedFromLayer as HaengteukLayerTab ?? "neis")
    : controlledTab !== undefined
      ? (HAENGTEUK_VALID_TABS.has(controlledTab) ? controlledTab as HaengteukLayerTab : "neis")
      : internalTab;
  const setActiveTab = (t: HaengteukLayerTab) => {
    if (controlledOnTabChange) controlledOnTabChange(t as SetekLayerTab);
    else setInternalTab(t);
  };
  const queryClient = useQueryClient();
  const [draftGenerating, setDraftGenerating] = useState(false);

  // direction 레이어에서 design vs improve 필터링
  // 부모는 전 학년/전 모드를 그대로 넘기므로 여기서 schoolYear + guideMode로 끊는다.
  const directionMode = layer ? getDirectionMode(layer) : null;
  const currentYearGuides = useMemo(
    () => (haengteukGuideItems ?? []).filter((g) => g.schoolYear === schoolYear),
    [haengteukGuideItems, schoolYear],
  );
  const filteredDirectionGuide = useMemo(() => {
    if (currentYearGuides.length === 0) return null;
    if (!directionMode) {
      // 레이어 미지정 시: 보완(retrospective) 우선, 없으면 설계(prospective)
      return (
        currentYearGuides.find((g) => g.guideMode === "retrospective") ??
        currentYearGuides[0] ??
        null
      );
    }
    return currentYearGuides.find((g) => g.guideMode === directionMode) ?? null;
  }, [currentYearGuides, directionMode]);

  // 보완/설계방향 컨설턴트 수동 가이드 (source='manual') 분리
  const manualDirectionGuide = useMemo(() => {
    if (!directionMode) return null;
    return (
      currentYearGuides.find(
        (g) => g.guideMode === directionMode && g.source === "manual",
      ) ?? null
    );
  }, [currentYearGuides, directionMode]);
  const aiDirectionGuide = useMemo(() => {
    if (!directionMode) return filteredDirectionGuide;
    return (
      currentYearGuides.find(
        (g) => g.guideMode === directionMode && (g.source ?? "ai") === "ai",
      ) ?? null
    );
  }, [currentYearGuides, directionMode, filteredDirectionGuide]);
  // AI 초안 생성 시 참고할 가이드: NEIS 기반 작성이므로 보완(retrospective) 우선
  const draftReferenceGuide = useMemo(
    () =>
      currentYearGuides.find((g) => g.guideMode === "retrospective") ??
      currentYearGuides[0] ??
      null,
    [currentYearGuides],
  );

  // guide 레이어 perspective 분류
  const filteredGuides = (() => {
    const all = guideAssignments ?? [];
    if (perspective === "ai") return all.filter((g) => g.ai_recommendation_reason);
    if (perspective === "consultant") return all.filter((g) => !g.ai_recommendation_reason);
    return all;
  })();

  useEffect(() => {
    const next = haengteuk?.content?.trim() ? haengteuk.content : (haengteuk?.imported_content ?? "");
    setContent(next);
  }, [haengteuk?.content, haengteuk?.imported_content]);

  // 역량 태그 필터: haengteuk record_type만 + perspective 분류
  // AI = source='ai' && status!='confirmed' / 컨설턴트 = source='manual' || status='confirmed'
  // tag_context 분리(analysis vs draft_analysis)는 파생 메모에서 수행.
  const recordScopedTags = useMemo(() => {
    if (!diagnosisActivityTags || !haengteuk) return [];
    let tags = diagnosisActivityTags.filter(
      (t) => t.record_type === "haengteuk" && t.record_id === haengteuk.id,
    );
    if (perspective === "ai") {
      tags = tags.filter((t) => t.source === "ai" && t.status !== "confirmed");
    } else if (perspective === "consultant") {
      tags = tags.filter((t) => t.source === "manual" || t.status === "confirmed");
    }
    return tags;
  }, [diagnosisActivityTags, haengteuk, perspective]);

  const analysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context !== "draft_analysis"),
    [recordScopedTags],
  );
  const draftAnalysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context === "draft_analysis"),
    [recordScopedTags],
  );
  const filteredTags = activeTab === "draft_analysis" ? draftAnalysisTags : analysisTags;

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
        "@/lib/domains/record-analysis/llm/actions/generateHaengteukDraft"
      );
      await generateHaengteukDraftAction(haengteuk.id, {
        grade,
        schoolYear,
        studentName,
        direction: draftReferenceGuide?.direction,
        keywords: draftReferenceGuide?.keywords,
        teacherPoints: draftReferenceGuide?.teacherPoints,
        evaluationItems: draftReferenceGuide?.evaluationItems,
        existingContent: haengteuk.imported_content ?? undefined,
        setekSummary,
        changcheSummary,
      });
      queryClient.invalidateQueries({ queryKey: studentRecordKeys.recordTab(studentId, schoolYear) });
    } finally {
      setDraftGenerating(false);
    }
  }

  // ─── 미지원 레이어 stub: 생기부 모형 유지 ───
  if (isUnsupportedLayer && layer) {
    const def = LAYER_DEFINITIONS[layer];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-14 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>{def.label}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="align-top">
              <td className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>{grade}</td>
              <td className={`${B} p-2`}>
                <div className="flex flex-col gap-0.5 rounded border border-dashed border-gray-300 bg-gray-50/50 px-3 py-2 text-xs text-[var(--text-tertiary)]">
                  <span className="font-medium text-[var(--text-secondary)]">{def.label} 레이어 — 작업 예정</span>
                  <span className="italic">{def.description}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ─── 레이어 탭 바 (controlled 모드면 GlobalLayerBar 사용) ─── */}
      {!isControlled && (
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-secondary)]">
          {HAENGTEUK_TABS.map((tab) => {
            const hasData = tab.key === "neis" ? !!haengteuk
              : tab.key === "draft" ? !!(haengteuk?.ai_draft_content || haengteuk?.content?.trim() || haengteuk?.confirmed_content?.trim())
              : tab.key === "analysis" ? analysisTags.length > 0
              : tab.key === "draft_analysis" ? draftAnalysisTags.length > 0
              : tab.key === "guide" ? filteredGuides.length > 0
              : tab.key === "direction" ? !!filteredDirectionGuide
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
                  : activeTab === "draft_analysis" ? "가안 역량 분석"
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
                  {/* draft + non-ai 관점에서만 confirm sub-state 배지 */}
                  {activeTab === "draft" && perspective !== "ai" && haengteuk && (
                    <ConfirmStatusBadge status={getConfirmStatus(haengteuk)} hideEmpty className="mt-0.5" />
                  )}
                </div>
              </td>
              <td className={`${B} p-1`}>
                {activeTab === "neis" && (
                  <div>
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
                    <HaengteukDraftCell
                      haengteuk={haengteuk}
                      studentId={studentId}
                      schoolYear={schoolYear}
                      tenantId={tenantId}
                      grade={grade}
                      charLimit={charLimit}
                      perspective={perspective}
                    />
                  ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                )}
                {activeTab === "analysis" && (
                  haengteuk ? (
                    filteredTags.length > 0 ? (
                      <HaengteukAnalysisCell filteredTags={filteredTags} haengteuk={haengteuk} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} perspective={perspective} recordTab="analysis" />
                    ) : <span className="text-xs text-[var(--text-placeholder)]">
                      {perspective === "consultant" ? "컨설턴트가 추가한 분석이 없습니다" : perspective === "ai" ? "AI 분석이 없습니다" : "분석 태그 없음"}
                    </span>
                  ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                )}
                {activeTab === "draft_analysis" && (
                  // P8 가안분석 태그. filteredTags는 draftAnalysisTags로 이미 분기된 상태.
                  // recordTab='draft_analysis'로 가안 콘텐츠(confirmed→content→ai_draft)에 대해 하이라이트.
                  haengteuk ? (
                    filteredTags.length > 0 ? (
                      <HaengteukAnalysisCell filteredTags={filteredTags} haengteuk={haengteuk} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} perspective={perspective} recordTab="draft_analysis" />
                    ) : <span className="text-xs text-[var(--text-placeholder)]">가안 분석 태그 없음 (P8 미실행 또는 가안 미생성)</span>
                  ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                )}
                {activeTab === "guide" && (
                  (() => {
                    return filteredGuides.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {filteredGuides.map((a) => (
                          <div key={a.id} className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0",
                              a.status === "completed" ? "bg-emerald-500" : a.status === "in_progress" ? "bg-amber-500" : "bg-gray-300")} />
                            <span className="truncate text-xs text-[var(--text-primary)]">{a.exploration_guides?.title ?? "가이드"}</span>
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-xs text-[var(--text-placeholder)]">
                      {perspective === "ai" ? "AI 추천 가이드가 없습니다" : perspective === "consultant" ? "배정된 가이드가 없습니다" : "가이드 없음"}
                    </span>;
                  })()
                )}
                {activeTab === "direction" && (
                  (() => {
                    const recordText = content;
                    const isConsultantDirection =
                      perspective === "consultant" &&
                      (directionMode === "retrospective" || directionMode === "prospective");

                    if (isConsultantDirection) {
                      const guideMode = directionMode === "prospective" ? "prospective" : "retrospective";
                      const onInvalidate = () => {
                        queryClient.invalidateQueries({ queryKey: studentRecordKeys.haengteukGuide(studentId) });
                      };
                      return (
                        <ConsultantDirectionEditor
                          guideId={manualDirectionGuide?.id ?? null}
                          initialDirection={manualDirectionGuide?.direction ?? ""}
                          initialKeywords={manualDirectionGuide?.keywords ?? []}
                          label={directionMode === "prospective" ? "컨설턴트 설계방향" : "컨설턴트 보완방향"}
                          placeholder={
                            directionMode === "prospective"
                              ? "행동특성 및 종합의견을 앞으로 어떻게 설계하면 좋을지 작성하세요..."
                              : "행동특성 및 종합의견을 어떻게 보완하면 좋을지 작성하세요..."
                          }
                          onSave={async (draft) => {
                            const res = await saveConsultantHaengteukGuideAction({
                              id: manualDirectionGuide?.id ?? null,
                              tenantId,
                              studentId,
                              schoolYear,
                              guideMode,
                              direction: draft.direction,
                              keywords: draft.keywords,
                            });
                            if (res.success) onInvalidate();
                            return { success: res.success, error: !res.success ? res.error : undefined };
                          }}
                          onDelete={
                            manualDirectionGuide?.id
                              ? async () => {
                                  const res = await deleteConsultantHaengteukGuideAction(manualDirectionGuide.id!);
                                  if (res.success) onInvalidate();
                                  return { success: res.success, error: !res.success ? res.error : undefined };
                                }
                              : undefined
                          }
                        />
                      );
                    }

                    // AI 관점 (또는 legacy) — 읽기 전용
                    const guide = perspective === "ai" ? aiDirectionGuide : filteredDirectionGuide;
                    if (!guide) return <span className="text-xs text-[var(--text-placeholder)]">
                      {directionMode === "prospective" ? "설계방향이 없습니다" : directionMode === "retrospective" ? "보완방향이 없습니다" : "방향 가이드가 없습니다"}
                    </span>;
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
