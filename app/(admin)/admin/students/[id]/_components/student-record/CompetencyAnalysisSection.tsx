"use client";

// ============================================
// 역량 분석 통합 섹션
// Phase 6.1 — 종합 등급(상단) + 세특별 하이라이트(중단) + 태그 요약(하단)
// ============================================

import { useState, useMemo, Fragment } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { analyzeSetekWithHighlight } from "@/lib/domains/student-record/llm/actions/analyzeWithHighlight";
import { upsertCompetencyScoreAction, addActivityTagsBatchAction, deleteAiTagsForRecordAction, confirmActivityTagAction, deleteActivityTagAction } from "@/lib/domains/student-record/actions/diagnosis";
import type { ActivityTagInsert } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade } from "@/lib/domains/student-record";
import type { HighlightAnalysisResult } from "@/lib/domains/student-record/llm/types";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { HighlightedSetekView, CompetencyBadge } from "./HighlightedSetekView";
import { Sparkles, ArrowDown, Check, X, ChevronRight, Loader2 } from "lucide-react";

type RecordForHighlight = {
  id: string;
  type: "setek" | "personal_setek" | "changche" | "haengteuk";
  label: string;
  content: string;
  subjectName?: string;
  grade?: number;
};

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
  isPipelineRunning?: boolean;
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const AREAS: CompetencyArea[] = ["academic", "career", "community"];

function findScore(scores: CompetencyScore[], code: string): string {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.grade_value ?? "";
}

// 태그 통계 + 태그 목록
type TagStats = { positive: number; negative: number; needs_review: number; tags: ActivityTag[] };
function countTagsByItem(tags: ActivityTag[]) {
  const map = new Map<string, TagStats>();
  for (const tag of tags) {
    const key = tag.competency_item;
    const entry = map.get(key) ?? { positive: 0, negative: 0, needs_review: 0, tags: [] };
    if (tag.evaluation === "positive") entry.positive++;
    else if (tag.evaluation === "negative") entry.negative++;
    else entry.needs_review++;
    entry.tags.push(tag);
    map.set(key, entry);
  }
  return map;
}

export function CompetencyAnalysisSection({
  competencyScores,
  activityTags,
  records,
  studentId,
  tenantId,
  schoolYear,
  isPipelineRunning,
}: Props) {
  const queryClient = useQueryClient();
  const [highlightResults, setHighlightResults] = useState<Map<string, HighlightAnalysisResult>>(new Map());
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedTagItem, setExpandedTagItem] = useState<string | null>(null);
  const tagStats = useMemo(() => countTagsByItem(activityTags), [activityTags]);
  const diagnosisQk = studentRecordKeys.diagnosisTab(studentId, schoolYear);

  // AI 태그 확인/거부 mutation
  const tagConfirmMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await confirmActivityTagAction(tagId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
  });

  const tagDeleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await deleteActivityTagAction(tagId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
  });

  const gradeMutation = useMutation({
    mutationFn: async (input: { area: CompetencyArea; item: string; grade: CompetencyGrade }) => {
      const result = await upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: input.area,
        competency_item: input.item,
        grade_value: input.grade,
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
  });

  // AI 분석 후 태그만 저장 (등급은 배치 종합 후 별도 저장)
  async function saveAnalysisTags(recId: string, rec: RecordForHighlight, data: HighlightAnalysisResult) {
    // 0. 기존 AI 태그 삭제 (재분석 시 중복 방지)
    await deleteAiTagsForRecordAction(rec.type, recId, tenantId);

    // 1. 활동 태그 배치 저장 (source=ai, status=suggested) — 1회 DB 호출
    const tagInputs: ActivityTagInsert[] = [];
    for (const section of data.sections) {
      for (const tag of section.tags) {
        tagInputs.push({
          tenant_id: tenantId,
          student_id: studentId,
          record_type: rec.type,
          record_id: recId,
          competency_item: tag.competencyItem,
          evaluation: tag.evaluation,
          evidence_summary: `[AI] ${tag.reasoning}\n근거: "${tag.highlight}"`,
          source: "ai",
          status: "suggested",
        });
      }
    }
    if (tagInputs.length > 0) {
      await addActivityTagsBatchAction(tagInputs);
    }
  }

  // 다중 레코드의 등급을 종합하여 1회 저장 (최빈값 기반)
  async function saveAggregatedGrades(allResults: Map<string, HighlightAnalysisResult>) {
    const gradeVotes = new Map<string, Map<string, number>>(); // item → grade → count

    for (const data of allResults.values()) {
      for (const g of data.competencyGrades) {
        if (!gradeVotes.has(g.item)) gradeVotes.set(g.item, new Map());
        const votes = gradeVotes.get(g.item)!;
        votes.set(g.grade, (votes.get(g.grade) ?? 0) + 1);
      }
    }

    const promises: Promise<unknown>[] = [];
    for (const [item, votes] of gradeVotes) {
      // 최빈값 선택
      let bestGrade = "B";
      let bestCount = 0;
      for (const [grade, count] of votes) {
        if (count > bestCount) { bestGrade = grade; bestCount = count; }
      }
      const area = COMPETENCY_ITEMS.find((i) => i.code === item)?.area;
      if (!area) continue;
      promises.push(upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: area,
        competency_item: item,
        grade_value: bestGrade as CompetencyGrade,
        notes: `[AI] ${bestCount}건 레코드 종합`,
        source: "ai",
        status: "suggested",
      }));
    }
    await Promise.allSettled(promises);
    queryClient.invalidateQueries({ queryKey: diagnosisQk });
  }

  // 개별 레코드 AI 분석
  async function analyzeRecord(rec: RecordForHighlight) {
    setAnalyzingId(rec.id);
    setError("");
    const result = await analyzeSetekWithHighlight({
      content: rec.content,
      recordType: rec.type,
      subjectName: rec.subjectName,
      grade: rec.grade,
    });
    if (result.success) {
      setHighlightResults((prev) => new Map(prev).set(rec.id, result.data));
      await saveAnalysisTags(rec.id, rec, result.data);
      // 개별 분석은 등급도 즉시 저장 (단일 레코드이므로 충돌 없음)
      await saveAggregatedGrades(new Map([[rec.id, result.data]]));
    } else {
      setError(result.error);
    }
    setAnalyzingId(null);
  }

  // 전체 레코드 일괄 분석 (동시성 3개 제한)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, failed: 0 });
  const batchMutation = useMutation({
    mutationFn: async () => {
      const eligible = records.filter((r) => r.content.trim().length >= 20);
      setBatchProgress({ done: 0, total: eligible.length, failed: 0 });
      const results = new Map<string, HighlightAnalysisResult>();
      const CONCURRENCY = 3;
      let done = 0;
      let failed = 0;

      for (let i = 0; i < eligible.length; i += CONCURRENCY) {
        const batch = eligible.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map(async (rec) => {
            const result = await analyzeSetekWithHighlight({
              content: rec.content,
              recordType: rec.type,
              subjectName: rec.subjectName,
              grade: rec.grade,
            });
            if (result.success) {
              results.set(rec.id, result.data);
              await saveAnalysisTags(rec.id, rec, result.data);
            } else {
              failed++;
            }
          }),
        );
        // rejected promise도 실패로 카운트
        for (const s of settled) {
          if (s.status === "rejected") failed++;
        }
        done += settled.length;
        setBatchProgress({ done, total: eligible.length, failed });
      }
      // 전체 레코드 등급 종합 저장
      if (results.size > 0) {
        await saveAggregatedGrades(results);
      }
      return results;
    },
    onSuccess: (results) => setHighlightResults((prev) => new Map([...prev, ...results])),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* ─── AI 분석 버튼 ──────────────────── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => batchMutation.mutate()}
          disabled={batchMutation.isPending || records.length === 0 || analyzingId !== null || isPipelineRunning}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {batchMutation.isPending
            ? `분석 중... ${batchProgress.done}/${batchProgress.total}`
            : "AI 역량 종합 분석"}
        </button>
        {/* 상태 필 — 레코드 수 / 에러 / 부분 실패를 하나로 */}
        {error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button type="button" onClick={() => batchMutation.mutate()}
              className="ml-1 font-medium underline hover:no-underline">재시도</button>
          </span>
        ) : batchMutation.isSuccess && batchProgress.failed > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {batchProgress.total - batchProgress.failed}건 성공 · {batchProgress.failed}건 실패
          </span>
        ) : batchMutation.isSuccess ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <Check size={12} /> {batchProgress.total}건 분석 완료
          </span>
        ) : (
          <span className="text-xs text-[var(--text-tertiary)]">
            {records.length > 0 ? `${records.length}건 레코드` : "분석할 레코드가 없습니다"}
          </span>
        )}
      </div>

      {/* ─── 세특별 하이라이트 뷰 (먼저: 근거를 보고 등급 결정) ── */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">활동별 역량 분석</h4>
        <div className="flex flex-col gap-3">
          {records.map((rec) => {
            const result = highlightResults.get(rec.id);
            const isAnalyzing = analyzingId === rec.id;

            if (result) {
              return (
                <HighlightedSetekView
                  key={rec.id}
                  content={rec.content}
                  sections={result.sections}
                  label={rec.label}
                  defaultExpanded={true}
                />
              );
            }

            return (
              <div key={rec.id} className="rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-[var(--text-primary)]">{rec.label}</span>
                  <button
                    onClick={() => analyzeRecord(rec)}
                    disabled={isAnalyzing || batchMutation.isPending || rec.content.trim().length < 20}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  >
                    {isAnalyzing ? (
                      <span className="h-3 w-3 animate-spin rounded-full border border-blue-300 border-t-blue-600" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    분석
                  </button>
                </div>
                <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{rec.content.slice(0, 150)}...</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 분석 완료 → 종합진단 안내 ── */}
      {batchMutation.isSuccess && (
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50/50 px-4 py-2.5 dark:border-indigo-800 dark:bg-indigo-900/10">
          <Check size={14} className="shrink-0 text-indigo-600" />
          <span className="flex-1 text-xs text-indigo-700 dark:text-indigo-400">
            역량 분석이 완료되었습니다. 다음 단계로 종합진단을 생성하세요.
          </span>
          <button
            onClick={() => document.getElementById("sec-diagnosis-overall")?.scrollIntoView({ behavior: "smooth" })}
            className="shrink-0 rounded px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            종합진단으로 이동
          </button>
        </div>
      )}

      {/* ─── 종합 등급 그리드 (접기 가능 — 상세 비교는 종합진단 섹션에서) ── */}
      <details className="group rounded-lg border border-gray-200 dark:border-gray-700">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)] [&::-webkit-details-marker]:hidden">
          <ChevronRight size={14} className="shrink-0 text-[var(--text-tertiary)] transition-transform group-open:rotate-90" />
          종합 등급 직접 편집
          <span className="text-[10px] font-normal text-[var(--text-tertiary)]">AI/컨설턴트 비교는 종합진단 섹션 참고</span>
        </summary>
        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
        <div className="flex flex-col gap-3">
          {AREAS.map((area) => {
            const items = COMPETENCY_ITEMS.filter((i) => i.area === area);
            return (
              <div key={area} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-xs font-medium text-[var(--text-secondary)]">
                  {COMPETENCY_AREA_LABELS[area]}
                </span>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const currentGrade = findScore(competencyScores, item.code);
                    const stats = tagStats.get(item.code);
                    return (
                      <Fragment key={item.code}>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--text-tertiary)]">{item.label}</span>
                          <select
                            value={currentGrade}
                            onChange={(e) =>
                              gradeMutation.mutate({ area, item: item.code, grade: e.target.value as CompetencyGrade })
                            }
                            className={cn(
                              "min-h-[32px] w-16 rounded border px-1.5 py-1 text-center text-xs",
                              "border-gray-300 bg-[var(--background)] dark:border-gray-600",
                              !currentGrade && "text-[var(--text-tertiary)]",
                            )}
                          >
                            <option value="">-</option>
                            {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                          {stats && stats.tags.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedTagItem(expandedTagItem === item.code ? null : item.code)}
                              className="cursor-pointer text-[10px] text-[var(--text-tertiary)] hover:underline"
                            >
                              {stats.positive > 0 && <span className="text-green-600">+{stats.positive}</span>}
                              {stats.needs_review > 0 && <span className="ml-0.5 text-amber-500">?{stats.needs_review}</span>}
                              {stats.negative > 0 && <span className="ml-0.5 text-red-500">-{stats.negative}</span>}
                            </button>
                          )}
                        </div>
                        {expandedTagItem === item.code && stats && (
                          <div className="basis-full ml-20 mb-1 flex flex-col gap-1 rounded border border-gray-100 bg-gray-50/50 p-2 dark:border-gray-700 dark:bg-gray-800/30">
                            {stats.tags.map((tag) => {
                              const isSuggested = tag.source === "ai" && tag.status === "suggested";
                              return (
                                <div key={tag.id} className="flex items-center gap-2 text-[10px]">
                                  <span className={cn(
                                    "shrink-0 rounded px-1 py-px text-[8px] font-medium",
                                    tag.evaluation === "positive" && "bg-green-100 text-green-700 dark:bg-green-900/30",
                                    tag.evaluation === "negative" && "bg-red-100 text-red-600 dark:bg-red-900/30",
                                    tag.evaluation === "needs_review" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                                  )}>
                                    {tag.evaluation === "positive" ? "+" : tag.evaluation === "negative" ? "-" : "?"}
                                  </span>
                                  <span className="flex-1 text-[var(--text-secondary)] line-clamp-1">
                                    {tag.evidence_summary?.replace(/^\[AI\]\s*/, "").split("\n")[0] ?? "-"}
                                  </span>
                                  {isSuggested && (
                                    <span className="rounded bg-blue-50 px-1 py-px text-[8px] text-blue-600 dark:bg-blue-900/20">제안</span>
                                  )}
                                  {tag.status === "confirmed" && (
                                    <span className="rounded bg-green-50 px-1 py-px text-[8px] text-green-600 dark:bg-green-900/20">확정</span>
                                  )}
                                  {isSuggested && (
                                    <span className="flex shrink-0 gap-0.5">
                                      <button
                                        onClick={() => tagConfirmMutation.mutate(tag.id)}
                                        disabled={tagConfirmMutation.isPending}
                                        className="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-50 dark:hover:bg-green-900/30"
                                        title="확정"
                                      >
                                        {tagConfirmMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                      </button>
                                      <button
                                        onClick={() => tagDeleteMutation.mutate(tag.id)}
                                        disabled={tagDeleteMutation.isPending}
                                        className="rounded p-1 text-red-500 hover:bg-red-100 disabled:opacity-50 dark:hover:bg-red-900/30"
                                        title="거부"
                                      >
                                        {tagDeleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </details>

    </div>
  );
}
