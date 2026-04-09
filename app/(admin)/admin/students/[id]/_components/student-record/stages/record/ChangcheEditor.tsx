"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CHANGCHE_TYPE_LABELS } from "@/lib/domains/student-record";
import type { RecordChangche, ChangcheActivityType } from "@/lib/domains/student-record";
import { RecordStatusBadge } from "../../RecordStatusBadge";
import { useStudentRecordContext } from "../../StudentRecordContext";
import { useSidePanel } from "@/components/side-panel";
import { cn } from "@/lib/cn";
import { FileText, Search, BookOpen, Compass, MessageSquare, StickyNote, PenLine, BarChart3 } from "lucide-react";
import { matchKeywordInText } from "@/lib/domains/student-record/keyword-match";
import { InlineAreaMemos } from "../../InlineAreaMemos";
import type { AnalysisTagLike } from "../../shared/AnalysisBlocks";
import { COMPETENCY_LABELS } from "../../shared/AnalysisBlocks";
import { ConsultantDirectionEditor } from "../../shared/ConsultantDirectionEditor";
import {
  saveConsultantChangcheGuideAction,
  deleteConsultantChangcheGuideAction,
} from "@/lib/domains/student-record/actions/guide-consultant";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import type { SetekLayerTab } from "./SetekEditor";
import { computeRecordStage, GRADE_STAGE_CONFIG, getConfirmStatus } from "@/lib/domains/student-record/grade-stage";
import { ConfirmStatusBadge } from "../../shared/ConfirmStatusBadge";
import {
  type LayerKey,
  type LayerPerspective,
  LAYER_DEFINITIONS,
  layerToChangcheTab,
  isLayerSupportedInChangche,
  getDirectionMode,
} from "@/lib/domains/student-record/layer-view";
import { ChangcheNEISCell } from "../../changche/ChangcheNEISCell";
import type { ChangcheGuideItemLike } from "../../changche/ChangcheNEISCell";
import { ChangcheAnalysisCell } from "../../changche/ChangcheAnalysisCell";
import { ChangcheDraftCell } from "../../changche/ChangcheDraftCell";

const ACTIVITY_TYPES: ChangcheActivityType[] = ["autonomy", "club", "career"];

const B = "border border-gray-400 dark:border-gray-500";

// ─── 탭 정의 ──────────────────────────────────────

type ChangcheLayerTab = "chat" | "guide" | "direction" | "draft" | "neis" | "analysis" | "draft_analysis" | "memo";

const CHANGCHE_TABS: { key: ChangcheLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "chat", label: "논의", icon: MessageSquare },
  { key: "guide", label: "가이드", icon: BookOpen },
  { key: "direction", label: "방향", icon: Compass },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "draft_analysis", label: "가안 분석", icon: BarChart3 },
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "analysis", label: "분석", icon: Search },
  { key: "memo", label: "메모", icon: StickyNote },
];

const CHANGCHE_VALID_TABS = new Set<string>(["chat", "guide", "direction", "draft", "neis", "analysis", "draft_analysis", "memo"]);

// ─── 타입 ──────────────────────────────────────

type ChangcheEditorProps = {
  changche: RecordChangche[];
  studentId: string;
  schoolYear: number;
  tenantId: string;
  grade: number;
  diagnosisActivityTags?: AnalysisTagLike[];
  guideAssignments?: Array<{ id: string; guide_id: string; status: string; ai_recommendation_reason?: string | null; exploration_guides?: { id: string; title: string; guide_type?: string } }>;
  changcheGuideItems?: ChangcheGuideItemLike[];
  /** 외부 제어 모드 (legacy — layer가 우선) */
  activeTab?: SetekLayerTab;
  onTabChange?: (tab: SetekLayerTab) => void;
  /** 글로벌 9 레이어 — controlled 진입점 */
  layer?: LayerKey;
  /** 글로벌 관점 (AI/컨설턴트) */
  perspective?: LayerPerspective | null;
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
  changcheGuideItems,
  activeTab: controlledTab,
  onTabChange: controlledOnTabChange,
  layer,
  perspective,
}: ChangcheEditorProps) {
  const [internalTab, setInternalTab] = useState<ChangcheLayerTab>("neis");

  // 우선순위: layer(9레이어) > controlledTab(레거시 4탭) > internalTab
  // layer가 주어지면 layerToChangcheTab으로 7탭 중 하나로 매핑. null이면 미지원 stub.
  const mappedFromLayer = layer ? layerToChangcheTab(layer) : undefined;
  const isUnsupportedLayer = layer != null && mappedFromLayer === null;
  const isControlled = layer !== undefined || controlledTab !== undefined;
  const activeTab: ChangcheLayerTab = layer
    ? (mappedFromLayer ?? "neis")
    : controlledTab !== undefined
      ? (CHANGCHE_VALID_TABS.has(controlledTab) ? controlledTab as ChangcheLayerTab : "neis")
      : internalTab;
  const setActiveTab = (t: ChangcheLayerTab) => {
    if (controlledOnTabChange) controlledOnTabChange(t as SetekLayerTab);
    else setInternalTab(t);
  };

  // 모든 changche ID (분석 필터용)
  const allChangcheIds = useMemo(() => new Set(changche.map((c) => c.id)), [changche]);

  // 역량 태그 필터: changche record_type만 + perspective 분류
  // AI = source='ai' && status!='confirmed' / 컨설턴트 = source='manual' || status='confirmed'
  // tag_context 분리는 파생 메모에서 수행 — draft_analysis 탭은 P8 가안분석 태그,
  // 나머지(분석 포함)는 NEIS 기반 분석 태그만 노출한다.
  const recordScopedTags = useMemo(() => {
    if (!diagnosisActivityTags) return [];
    let tags = diagnosisActivityTags.filter(
      (t) => t.record_type === "changche" && allChangcheIds.has(t.record_id),
    );
    if (perspective === "ai") {
      tags = tags.filter((t) => t.source === "ai" && t.status !== "confirmed");
    } else if (perspective === "consultant") {
      tags = tags.filter((t) => t.source === "manual" || t.status === "confirmed");
    }
    return tags;
  }, [diagnosisActivityTags, allChangcheIds, perspective]);

  const analysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context !== "draft_analysis"),
    [recordScopedTags],
  );
  const draftAnalysisTags = useMemo(
    () => recordScopedTags.filter((t) => t.tag_context === "draft_analysis"),
    [recordScopedTags],
  );
  const filteredTags = activeTab === "draft_analysis" ? draftAnalysisTags : analysisTags;

  // design_direction / improve_direction 구분용 필터링 (direction 레이어에서만 의미)
  // schoolYear로도 반드시 필터링 — 부모는 전 학년 목록을 그대로 넘겨주므로
  // 여기서 끊지 않으면 1/2/3학년에 같은 가이드가 중복 표시된다.
  const directionMode = layer ? getDirectionMode(layer) : null;
  const filteredDirectionItems = useMemo(() => {
    if (!changcheGuideItems) return [];
    const byYear = changcheGuideItems.filter((g) => g.schoolYear === schoolYear);
    if (!directionMode) return byYear;
    return byYear.filter((g) => g.guideMode === directionMode);
  }, [changcheGuideItems, directionMode, schoolYear]);

  // guide 레이어 perspective 분류
  const filteredGuides = useMemo(() => {
    const all = guideAssignments ?? [];
    if (perspective === "ai") {
      return all.filter((g) => g.ai_recommendation_reason);
    }
    if (perspective === "consultant") {
      return all.filter((g) => !g.ai_recommendation_reason);
    }
    return all;
  }, [guideAssignments, perspective]);

  // 사이드 패널 + 컨텍스트 그리드 연결
  const ctx = useStudentRecordContext();
  const sidePanel = useSidePanel();
  const queryClient = useQueryClient();

  // ─── 미지원 레이어 stub: 생기부 모형 유지 + 셀 단위 안내 ───
  if (isUnsupportedLayer && layer) {
    const def = LAYER_DEFINITIONS[layer];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} w-24 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>영역</th>
              <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>{def.label}</th>
            </tr>
          </thead>
          <tbody>
            {ACTIVITY_TYPES.map((type, idx) => (
              <tr key={type} className="align-top">
                {idx === 0 && (
                  <td rowSpan={ACTIVITY_TYPES.length} className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
                    {grade}
                  </td>
                )}
                <td className={`${B} px-2 py-1.5 text-center align-middle whitespace-nowrap text-xs font-medium text-[var(--text-primary)]`}>
                  {CHANGCHE_TYPE_LABELS[type]}
                </td>
                <td className={`${B} p-2`}>
                  <div className="flex flex-col gap-0.5 rounded border border-dashed border-gray-300 bg-gray-50/50 px-3 py-2 text-xs text-[var(--text-tertiary)]">
                    <span className="font-medium text-[var(--text-secondary)]">{def.label} 레이어 — 작업 예정</span>
                    <span className="italic">{def.description}</span>
                  </div>
                </td>
              </tr>
            ))}
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
          {CHANGCHE_TABS.map((tab) => {
            const hasData = tab.key === "neis" ? changche.length > 0
              : tab.key === "draft" ? changche.some((c) => c.content?.trim() || c.ai_draft_content || c.confirmed_content?.trim())
              : tab.key === "analysis" ? analysisTags.length > 0
              : tab.key === "draft_analysis" ? draftAnalysisTags.length > 0
              : tab.key === "guide" ? filteredGuides.length > 0
              : tab.key === "direction" ? filteredDirectionItems.length > 0
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
              <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>학년</th>
              <th className={`${B} w-24 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>영역</th>
              {activeTab === "neis" && (
                <th className={`${B} w-12 px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>시간</th>
              )}
              <th className={`${B} px-2 py-1.5 text-center text-xs font-medium text-[var(--text-secondary)]`}>
                {activeTab === "neis" ? "특기사항"
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
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {CHANGCHE_TYPE_LABELS[type]}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const id = `changche:${type}`;
                            if (ctx.activeSubjectId === id) {
                              ctx.setActiveSubjectId?.(null);
                              ctx.setActiveSchoolYear?.(null);
                              ctx.setActiveSubjectName?.(null);
                            } else {
                              ctx.setActiveSubjectId?.(id);
                              ctx.setActiveSchoolYear?.(schoolYear);
                              ctx.setActiveSubjectName?.(CHANGCHE_TYPE_LABELS[type]);
                            }
                          }}
                          className={cn(
                            "text-xs transition-colors",
                            ctx.activeSubjectId === `changche:${type}`
                              ? "text-indigo-600 dark:text-indigo-400"
                              : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
                          )}
                          title={ctx.activeSubjectId === `changche:${type}` ? "그리드 닫기" : "컨텍스트 그리드 열기"}
                        >
                          {ctx.activeSubjectId === `changche:${type}` ? "⤡" : "⤢"}
                        </button>
                      </div>
                      {activeTab === "neis" && record && <RecordStatusBadge status={record.status} />}
                      {/* B7: 단계 배지 */}
                      {(() => {
                        const stage = record ? computeRecordStage(record) : "prospective";
                        const cfg = GRADE_STAGE_CONFIG[stage];
                        return (
                          <span className={cn("inline-block rounded-full px-1.5 py-0 text-xs font-medium", cfg.bgClass, cfg.textClass)}>
                            {cfg.label}
                          </span>
                        );
                      })()}
                      {/* draft + non-ai 관점에서만 confirm sub-state 배지 */}
                      {activeTab === "draft" && perspective !== "ai" && record && (
                        <ConfirmStatusBadge status={getConfirmStatus(record)} hideEmpty className="mt-0.5" />
                      )}
                    </div>
                  </td>
                  {activeTab === "neis" && (
                    <td className={`${B} px-2 py-1.5 text-center align-middle text-sm text-[var(--text-primary)]`}>
                      {record?.hours ?? "-"}
                    </td>
                  )}
                  <td className={`${B} p-1`}>
                    {activeTab === "neis" && (
                      <ChangcheNEISCell
                        activityType={type}
                        existing={record}
                        studentId={studentId}
                        schoolYear={schoolYear}
                        tenantId={tenantId}
                        grade={grade}
                        guideItem={changcheGuideItems?.find((g) => g.activityType === type)}
                      />
                    )}
                    {activeTab === "draft" && (
                      record ? (
                        <ChangcheDraftCell
                          record={record}
                          studentId={studentId}
                          schoolYear={schoolYear}
                          tenantId={tenantId}
                          grade={grade}
                          perspective={perspective}
                        />
                      ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                    )}
                    {activeTab === "analysis" && (
                      record ? (
                        typeTags.length > 0 ? (
                          <ChangcheAnalysisCell typeTags={typeTags} record={record} activityType={type} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} perspective={perspective} />
                        ) : <span className="text-xs text-[var(--text-placeholder)]">
                          {perspective === "consultant" ? "컨설턴트가 추가한 분석이 없습니다" : perspective === "ai" ? "AI 분석이 없습니다" : "분석 태그 없음"}
                        </span>
                      ) : <span className="text-xs text-[var(--text-placeholder)]">기록 없음</span>
                    )}
                    {activeTab === "draft_analysis" && (
                      // P8 가안분석 태그는 ChangcheEditor.filteredTags에서 이미 tag_context='draft_analysis'로 추려짐.
                      // typeTags는 record_id로만 한 번 더 필터링되므로 그대로 재사용 가능.
                      record ? (
                        typeTags.length > 0 ? (
                          <ChangcheAnalysisCell typeTags={typeTags} record={record} activityType={type} studentId={studentId} tenantId={tenantId} schoolYear={schoolYear} perspective={perspective} />
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
                        const typeItems = filteredDirectionItems.filter((g) => g.activityType === type);
                        const aiGuide = typeItems.find((g) => (g.source ?? "ai") === "ai");
                        const manualGuide = typeItems.find((g) => g.source === "manual");
                        const recordText = record?.content?.trim() || record?.imported_content || "";
                        const isConsultantDirection =
                          perspective === "consultant" &&
                          (directionMode === "retrospective" || directionMode === "prospective");

                        if (isConsultantDirection) {
                          const guideMode = directionMode === "prospective" ? "prospective" : "retrospective";
                          const onInvalidate = () => {
                            queryClient.invalidateQueries({ queryKey: studentRecordKeys.changcheGuides(studentId) });
                          };
                          return (
                            <ConsultantDirectionEditor
                              guideId={manualGuide?.id ?? null}
                              initialDirection={manualGuide?.direction ?? ""}
                              initialKeywords={manualGuide?.keywords ?? []}
                              label={directionMode === "prospective" ? "컨설턴트 설계방향" : "컨설턴트 보완방향"}
                              placeholder={
                                directionMode === "prospective"
                                  ? `${CHANGCHE_TYPE_LABELS[type]} 활동을 앞으로 어떻게 설계하면 좋을지 작성하세요...`
                                  : `${CHANGCHE_TYPE_LABELS[type]} 활동을 어떻게 보완하면 좋을지 작성하세요...`
                              }
                              onSave={async (draft) => {
                                const res = await saveConsultantChangcheGuideAction({
                                  id: manualGuide?.id ?? null,
                                  tenantId,
                                  studentId,
                                  schoolYear,
                                  activityType: type,
                                  guideMode,
                                  direction: draft.direction,
                                  keywords: draft.keywords,
                                });
                                if (res.success) onInvalidate();
                                return { success: res.success, error: !res.success ? res.error : undefined };
                              }}
                              onDelete={
                                manualGuide?.id
                                  ? async () => {
                                      const res = await deleteConsultantChangcheGuideAction(manualGuide.id!);
                                      if (res.success) onInvalidate();
                                      return { success: res.success, error: !res.success ? res.error : undefined };
                                    }
                                  : undefined
                              }
                            />
                          );
                        }

                        // AI 관점 (또는 legacy) — 읽기 전용
                        const guide = perspective === "ai" ? aiGuide : (aiGuide ?? manualGuide);
                        if (!guide) return <span className="text-xs text-[var(--text-placeholder)]">
                          {directionMode === "prospective" ? "설계방향이 없습니다" : directionMode === "retrospective" ? "보완방향이 없습니다" : "방향 가이드가 없습니다"}
                        </span>;
                        return (
                          <div className="flex flex-col gap-2 rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-800 dark:bg-violet-950/20">
                            {/* 역량 포커스 배지 */}
                            {guide.competencyFocus && guide.competencyFocus.length > 0 && (
                              <div className="flex flex-wrap gap-1">
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
                              <div className="flex flex-wrap gap-1">
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
                              <div className="mt-1 border-t border-violet-200 pt-2 dark:border-violet-800">
                                <p className="mb-1 text-xs font-medium text-violet-600 dark:text-violet-400">교사 전달 포인트</p>
                                <ul className="list-inside list-disc text-xs text-[var(--text-secondary)]">
                                  {guide.teacherPoints.map((tp, i) => <li key={i}>{tp}</li>)}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                    {activeTab === "memo" && (
                      <InlineAreaMemos studentId={studentId} areaType="changche" areaId={type} areaLabel={CHANGCHE_TYPE_LABELS[type]} />
                    )}
                    {activeTab === "chat" && (
                      <button
                        type="button"
                        onClick={() => {
                          ctx.setActiveSubjectId?.(`changche:${type}`);
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
