"use client";

// ============================================
// 종합 등급 + 루브릭 상세 (2레벨 아코디언)
// Phase 6.1 — 등급 테이블 + 태그 통계 인라인
// ============================================

import { useState, Fragment } from "react";
import { cn } from "@/lib/cn";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, COMPETENCY_RUBRIC_QUESTIONS } from "@/lib/domains/student-record";
import { deriveItemGradeFromRubrics, aggregateTagsByQuestion } from "@/lib/domains/student-record/rubric-matcher";
import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade, CompetencyItemCode } from "@/lib/domains/student-record";
import type { RubricScoreEntry } from "@/lib/domains/student-record/types";
import { ArrowDown, Check, X, ChevronRight, Loader2 } from "lucide-react";
import {
  GRADES,
  AREAS,
  findScore,
  findNarrative,
  findRubricScores,
  type TagStatsGrouped,
} from "./competency-helpers";

type GradeMutationInput = {
  area: CompetencyArea;
  item: string;
  grade: CompetencyGrade;
  rubricScores?: RubricScoreEntry[];
};

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  tagStats: Map<string, TagStatsGrouped>;
  isReaggregating: boolean;
  isBatchPending: boolean;
  hasHighlightResults: boolean;
  onReaggregate: () => void;
  onGradeChange: (input: GradeMutationInput) => void;
  onTagConfirm: (tagId: string) => void;
  onTagDelete: (tagId: string) => void;
  isTagConfirmPending: boolean;
  isTagDeletePending: boolean;
  isGradePending: boolean;
};

export function CompetencyGradesTable({
  competencyScores,
  activityTags,
  tagStats,
  isReaggregating,
  isBatchPending,
  hasHighlightResults,
  onReaggregate,
  onGradeChange,
  onTagConfirm,
  onTagDelete,
  isTagConfirmPending,
  isTagDeletePending,
  isGradePending,
}: Props) {
  const [expandedRubricItem, setExpandedRubricItem] = useState<string | null>(null);
  const [expandedRubricQ, setExpandedRubricQ] = useState<string | null>(null);
  const [expandedTagItem, setExpandedTagItem] = useState<string | null>(null);

  return (
    <div className="rounded-lg border border-border dark:border-border">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border dark:border-border">
        <span className="text-sm font-semibold text-[var(--text-primary)]">종합 등급 + 루브릭 상세</span>
        <span className="text-3xs text-[var(--text-tertiary)]">항목 클릭 시 루브릭 질문 펼침</span>
        <span className="flex-1" />
        {hasHighlightResults && (
          <button
            onClick={onReaggregate}
            disabled={isReaggregating || isBatchPending}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-3xs text-[var(--text-secondary)] transition hover:bg-bg-secondary disabled:opacity-50 dark:border-border dark:hover:bg-gray-800"
          >
            {isReaggregating ? <Loader2 size={10} className="animate-spin" /> : <ArrowDown size={10} />}
            등급 재집계
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-bg-secondary/80 dark:border-border dark:bg-bg-secondary/50">
              <th className="whitespace-nowrap px-3 py-2 text-left font-medium text-[var(--text-tertiary)]">영역</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--text-tertiary)]">항목</th>
              <th className="w-12 whitespace-nowrap px-2 py-2 text-center font-medium text-blue-600 dark:text-blue-400">AI</th>
              <th className="whitespace-nowrap px-2 py-2 text-center font-medium text-orange-600 dark:text-orange-400">컨설턴트</th>
              <th className="w-16 whitespace-nowrap px-2 py-2 text-center font-medium text-[var(--text-tertiary)]">근거</th>
            </tr>
          </thead>
          <tbody>
            {AREAS.map((area) => {
              const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
              return items.map((item, idx) => {
                const aiGrade = findScore(competencyScores.filter((s) => s.source === "ai"), item.code);
                const consultantGrade = findScore(competencyScores.filter((s) => s.source === "manual"), item.code);
                const currentGrade = findScore(competencyScores, item.code);
                const aiRubrics = findRubricScores(competencyScores, item.code, "ai");
                const conRubrics = findRubricScores(competencyScores, item.code, "manual");
                const questions = COMPETENCY_RUBRIC_QUESTIONS[item.code as CompetencyItemCode] ?? [];
                const aiRubricMap = new Map(aiRubrics.map((r) => [r.questionIndex, r]));
                const conRubricMap = new Map(conRubrics.map((r) => [r.questionIndex, r]));
                const stats = tagStats.get(item.code);
                const isExpanded = expandedRubricItem === item.code;

                return (
                  <Fragment key={item.code}>
                    {/* 상위 항목 행 */}
                    <tr
                      className={cn(
                        "border-b border-border dark:border-border/50",
                        idx === items.length - 1 && !isExpanded && "border-b-2 border-border dark:border-border",
                        isExpanded && "bg-indigo-50/30 dark:bg-indigo-900/10",
                      )}
                    >
                      <td
                        className={cn(
                          "px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] border-r border-border dark:border-border/50",
                          idx > 0 && "text-transparent select-none",
                        )}
                      >
                        {idx === 0 ? COMPETENCY_AREA_LABELS[area] : ""}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setExpandedRubricItem(isExpanded ? null : item.code)}
                          className={cn(
                            "flex items-center gap-1 text-xs font-medium transition-colors",
                            isExpanded ? "text-blue-600 dark:text-blue-400" : "text-[var(--text-primary)] hover:text-blue-600",
                          )}
                        >
                          <ChevronRight size={12} className={cn("shrink-0 transition-transform", isExpanded && "rotate-90")} />
                          {item.label}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {aiGrade ? (
                          <span
                            className={cn(
                              "text-2xs font-semibold",
                              aiGrade.startsWith("A") ? "text-blue-600" : aiGrade.startsWith("B") ? "text-green-600" : "text-amber-600",
                            )}
                          >
                            {aiGrade}
                          </span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <select
                          value={consultantGrade || currentGrade}
                          onChange={(e) =>
                            onGradeChange({ area, item: item.code, grade: e.target.value as CompetencyGrade })
                          }
                          className={cn(
                            "w-14 rounded border px-1 py-0.5 text-center text-2xs",
                            "border-border bg-[var(--background)] dark:border-border",
                            !currentGrade && "text-[var(--text-tertiary)]",
                          )}
                        >
                          <option value="">-</option>
                          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2 text-center">
                        {stats && stats.recordCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedTagItem(expandedTagItem === item.code ? null : item.code)}
                            className="cursor-pointer text-3xs hover:underline"
                          >
                            {stats.positive > 0 && <span className="text-green-600">+{stats.positive}</span>}
                            {stats.negative > 0 && <span className="ml-0.5 text-red-500">-{stats.negative}</span>}
                          </button>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">-</span>
                        )}
                      </td>
                    </tr>

                    {/* 루브릭 질문 행 (아코디언) */}
                    {isExpanded && (() => {
                      const aiNarrative = findNarrative(competencyScores.filter((s) => s.source === "ai"), item.code);
                      const qStats = aggregateTagsByQuestion(item.code, activityTags);
                      return (
                        <>
                          {aiNarrative && (
                            <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                              <td colSpan={5} className="px-4 py-1.5 text-3xs leading-relaxed text-blue-700 dark:text-blue-300">
                                {aiNarrative}
                              </td>
                            </tr>
                          )}
                          {questions.map((q, qi) => {
                            const aiR = aiRubricMap.get(qi);
                            const conR = conRubricMap.get(qi);
                            const qStat = qStats[qi];
                            const qEvCount = qStat ? qStat.positive + qStat.negative + qStat.needsReview : 0;
                            const qKey = `${item.code}:${qi}`;
                            const isQExpanded = expandedRubricQ === qKey;
                            const noEvidence = !aiR && qEvCount === 0;
                            return (
                              <Fragment key={`${item.code}-q${qi}`}>
                                <tr
                                  className={cn(
                                    "border-b border-gray-50 bg-bg-secondary/40 dark:border-border dark:bg-bg-secondary/20",
                                    qi === questions.length - 1 && idx === items.length - 1 && !isQExpanded && "border-b-2 border-border dark:border-border",
                                  )}
                                >
                                  <td className="border-r border-border dark:border-border/50" />
                                  <td className="py-1.5 pl-8 pr-3 text-2xs leading-relaxed text-[var(--text-secondary)]">
                                    {q}
                                    {noEvidence && (
                                      <span className="ml-1.5 rounded bg-bg-tertiary px-1 py-px text-3xs text-text-tertiary dark:bg-bg-tertiary dark:text-text-tertiary">근거없음</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {aiR ? (
                                      <span
                                        className={cn(
                                          "text-3xs font-semibold",
                                          aiR.grade.startsWith("A") ? "text-blue-600" : aiR.grade.startsWith("B") ? "text-green-600" : "text-amber-600",
                                        )}
                                      >
                                        {aiR.grade}
                                      </span>
                                    ) : (
                                      <span className="text-3xs text-text-disabled">-</span>
                                    )}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    <select
                                      value={conR?.grade ?? ""}
                                      onChange={(e) => {
                                        if (!e.target.value) return;
                                        const newGrade = e.target.value as CompetencyGrade;
                                        const updated = [
                                          ...conRubrics.filter((r) => r.questionIndex !== qi),
                                          { questionIndex: qi, grade: newGrade, reasoning: conR?.reasoning ?? "" },
                                        ];
                                        const derived = deriveItemGradeFromRubrics(updated);
                                        onGradeChange({ area, item: item.code, grade: derived ?? newGrade, rubricScores: updated });
                                      }}
                                      disabled={isGradePending}
                                      className={cn(
                                        "w-14 rounded border px-0.5 py-0.5 text-center text-3xs",
                                        "border-border bg-[var(--background)] dark:border-border",
                                        !conR?.grade && "text-[var(--text-tertiary)]",
                                        conR && aiR && conR.grade === aiR.grade && "ring-1 ring-green-300",
                                      )}
                                    >
                                      <option value="">-</option>
                                      {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {qEvCount > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedRubricQ(isQExpanded ? null : qKey)}
                                        className="text-3xs hover:underline"
                                      >
                                        {qStat!.positive > 0 && <span className="text-green-600">+{qStat!.positive}</span>}
                                        {qStat!.negative > 0 && <span className="ml-0.5 text-red-500">-{qStat!.negative}</span>}
                                        {qStat!.needsReview > 0 && <span className="ml-0.5 text-amber-500">?{qStat!.needsReview}</span>}
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                                {/* 질문별 근거 펼침 */}
                                {isQExpanded && qStat && qStat.evidences.length > 0 && (
                                  <tr>
                                    <td className="border-r border-border dark:border-border/50" />
                                    <td colSpan={4} className="bg-bg-secondary/60 py-1.5 pl-10 pr-3 dark:bg-bg-secondary/30">
                                      <div className="flex flex-col gap-0.5">
                                        {qStat.evidences.map((ev, ei) => (
                                          <p key={ei} className="text-3xs leading-relaxed text-[var(--text-tertiary)]">
                                            · {ev.split("\n")[0].slice(0, 100)}{ev.length > 100 ? "…" : ""}
                                          </p>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* 태그 상세 (펼침) */}
                    {expandedTagItem === item.code && stats && (
                      <tr>
                        <td colSpan={5} className="bg-bg-secondary/50 px-4 py-2 dark:bg-bg-secondary/30">
                          <div className="flex flex-col gap-1.5">
                            {[...stats.byGrade.entries()]
                              .sort(([a], [b]) => a - b)
                              .map(([grade, recordGroups]) => (
                                <div key={grade}>
                                  {stats.byGrade.size > 1 && (
                                    <div className="text-3xs font-semibold text-[var(--text-tertiary)] mb-0.5">{grade}학년</div>
                                  )}
                                  {recordGroups.map((rg) => (
                                    <div key={rg.recordId} className="mb-1">
                                      <div className="text-3xs text-[var(--text-tertiary)] mb-0.5">📄 {rg.recordLabel}</div>
                                      <div className="ml-4 flex flex-col gap-0.5">
                                        {rg.tags.map((tag) => {
                                          const isSuggested = tag.source === "ai" && tag.status === "suggested";
                                          return (
                                            <div key={tag.id} className="flex items-center gap-2 text-3xs">
                                              <span
                                                className={cn(
                                                  "shrink-0 rounded px-1 py-px text-3xs font-medium",
                                                  tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30",
                                                  tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30",
                                                  tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                                                )}
                                              >
                                                {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}
                                              </span>
                                              <span className="flex-1 text-[var(--text-secondary)] line-clamp-1">
                                                {tag.evidence_summary?.replace(/^\[AI\]\s*/, "").split("\n")[0] ?? "-"}
                                              </span>
                                              {isSuggested && (
                                                <span className="flex shrink-0 gap-0.5">
                                                  <button
                                                    onClick={() => onTagConfirm(tag.id)}
                                                    disabled={isTagConfirmPending}
                                                    className="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-50"
                                                    title="확정"
                                                  >
                                                    {isTagConfirmPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                  </button>
                                                  <button
                                                    onClick={() => onTagDelete(tag.id)}
                                                    disabled={isTagDeletePending}
                                                    className="rounded p-1 text-red-500 hover:bg-red-100 disabled:opacity-50"
                                                    title="거부"
                                                  >
                                                    {isTagDeletePending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                                                  </button>
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
