"use client";

// ============================================
// 역량 분석 통합 섹션
// Phase 6.1 — 종합 등급(상단) + 세특별 하이라이트(중단) + 태그 요약(하단)
// ============================================

import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { analyzeSetekWithHighlight } from "@/lib/domains/record-analysis/llm/actions/analyzeWithHighlight";
import {
  upsertCompetencyScoreAction,
  addActivityTagsBatchAction,
  deleteAiTagsForRecordAction,
  confirmActivityTagAction,
  deleteActivityTagAction,
  fetchAnalysisCacheAction,
  saveAnalysisCacheAction,
  fetchAnalysisCacheWithHashAction,
  computeDeterministicCareerGradesAction,
} from "@/lib/domains/student-record/actions/competency";
import { computeRecordContentHash } from "@/lib/domains/student-record/content-hash";
import { syncPipelineTaskStatus } from "@/lib/domains/student-record/actions/pipeline";
import type { ActivityTagInsert } from "@/lib/domains/student-record/types";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { HighlightedSetekView } from "../../HighlightedSetekView";
import { HighlightComparisonView } from "../../HighlightComparisonView";
import { QualityScoreBadge, QualitySummaryCard } from "../../QualityScoreBadge";
import type { QualityScoreEntry } from "../../QualityScoreBadge";
import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade, CompetencyItemCode } from "@/lib/domains/student-record";
import type { HighlightAnalysisResult } from "@/lib/domains/record-analysis/llm/types";
import { Sparkles, Check, Loader2, GitCompare } from "lucide-react";
import { CompetencyCharts } from "../../competency/CompetencyCharts";
import { CompetencyGradesTable } from "../../competency/CompetencyGradesTable";
import { countTagsByItem, type RecordForHighlight, type RecordLabelMap } from "../../competency/competency-helpers";

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
  studentId: string;
  tenantId: string;
  schoolYear: number;
  isPipelineRunning?: boolean;
  /** 증분 분석 캐시 키에 포함 — 변경 시 캐시 자동 무효화 */
  targetMajor?: string | null;
  takenSubjects?: string[];
  /** Phase 1-3 역량 분석에서 생성된 콘텐츠 품질 점수 */
  qualityScores?: QualityScoreEntry[];
};

export function CompetencyAnalysisSection({
  competencyScores,
  activityTags,
  records,
  studentId,
  tenantId,
  schoolYear,
  isPipelineRunning,
  targetMajor,
  takenSubjects,
  qualityScores,
}: Props) {
  const queryClient = useQueryClient();
  const [highlightResults, setHighlightResults] = useState<Map<string, HighlightAnalysisResult>>(new Map());
  const [consultantResults, setConsultantResults] = useState<Map<string, HighlightAnalysisResult>>(new Map());
  const [comparisonMode, setComparisonMode] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [forceReanalyze, setForceReanalyze] = useState(false);
  const [batchCachedIds, setBatchCachedIds] = useState<Set<string>>(new Set());
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // 학년 탭
  const availableGrades = useMemo(() => {
    const grades = [...new Set(records.map((r) => r.grade ?? 0).filter(Boolean))].sort((a, b) => a - b);
    return grades.length > 0 ? grades : [0];
  }, [records]);
  const [selectedGrade, setSelectedGrade] = useState<number>(() => availableGrades[0]);

  // 유형 서브탭
  type RecordTypeFilter = "all" | "setek" | "changche" | "haengteuk";
  const [selectedType, setSelectedType] = useState<RecordTypeFilter>("all");

  const { typeCounts, filteredRecords } = useMemo(() => {
    const gradeFiltered = records.filter((r) => (r.grade ?? 0) === selectedGrade);
    const counts = {
      setek: gradeFiltered.filter((r) => r.type === "setek" || r.type === "personal_setek").length,
      changche: gradeFiltered.filter((r) => r.type === "changche").length,
      haengteuk: gradeFiltered.filter((r) => r.type === "haengteuk").length,
    };
    const filtered =
      selectedType === "all"
        ? gradeFiltered
        : gradeFiltered.filter((r) =>
            selectedType === "setek" ? r.type === "setek" || r.type === "personal_setek" : r.type === selectedType,
          );
    return { typeCounts: counts, filteredRecords: filtered };
  }, [records, selectedGrade, selectedType]);

  const careerHashCtx = useMemo(
    () => (targetMajor ? { targetMajor, takenSubjects: takenSubjects ?? [] } : null),
    [targetMajor, takenSubjects],
  );

  const recordLabelMap = useMemo<RecordLabelMap>(() => {
    const m = new Map<string, { label: string; grade: number }>();
    for (const r of records) {
      m.set(r.id, { label: r.subjectName ?? r.label, grade: r.grade ?? 0 });
    }
    return m;
  }, [records]);

  const tagStats = useMemo(() => countTagsByItem(activityTags, recordLabelMap), [activityTags, recordLabelMap]);
  const diagnosisQk = studentRecordKeys.diagnosisTab(studentId, schoolYear);

  // 캐시에서 AI 하이라이트 복원
  useEffect(() => {
    if (highlightResults.size > 0) return;
    fetchAnalysisCacheAction(studentId, tenantId).then((res) => {
      if (!res.success || res.data.length === 0) return;
      const map = new Map<string, HighlightAnalysisResult>();
      for (const row of res.data) {
        map.set(row.record_id, row.analysis_result as HighlightAnalysisResult);
      }
      setHighlightResults(map);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, tenantId]);

  // 컨설턴트 태그(source=manual) → HighlightAnalysisResult 형태로 변환 (비교 뷰용)
  useEffect(() => {
    const manualTags = activityTags.filter((t) => t.source === "manual");
    if (manualTags.length === 0) {
      setConsultantResults(new Map());
      return;
    }
    const map = new Map<string, HighlightAnalysisResult>();
    const byRecord = new Map<string, typeof manualTags>();
    for (const tag of manualTags) {
      const key = tag.record_id;
      if (!byRecord.has(key)) byRecord.set(key, []);
      byRecord.get(key)!.push(tag);
    }
    for (const [recordId, tags] of byRecord) {
      const highlightTags = tags.map((t) => {
        const highlightMatch = t.evidence_summary?.match(/근거:\s*"([^"]+)"/);
        return {
          competencyItem: t.competency_item as CompetencyItemCode,
          evaluation: t.evaluation as "positive" | "negative" | "needs_review",
          highlight: highlightMatch?.[1] ?? t.evidence_summary?.slice(0, 50) ?? "",
          reasoning: t.evidence_summary ?? "",
        };
      });
      map.set(recordId, {
        sections: [{ sectionType: "전체" as const, tags: highlightTags, needsReview: false }],
        competencyGrades: [],
        summary: `컨설턴트 수동 태그 ${tags.length}건`,
      });
    }
    setConsultantResults(map);
  }, [activityTags]);

  // AI 태그 확인/거부 mutation
  const tagConfirmMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await confirmActivityTagAction(tagId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
    onError: (err: Error) => setError(err.message),
  });

  const tagDeleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await deleteActivityTagAction(tagId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
    onError: (err: Error) => setError(err.message),
  });

  const gradeMutation = useMutation({
    mutationFn: async (input: { area: CompetencyArea; item: string; grade: CompetencyGrade; rubricScores?: import("@/lib/domains/student-record/types").RubricScoreEntry[] }) => {
      const result = await upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: input.area,
        competency_item: input.item,
        grade_value: input.grade,
        ...(input.rubricScores && { rubric_scores: input.rubricScores as unknown as Record<string, unknown>[] }),
      });
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
    onError: (err: Error) => setError(err.message),
  });

  // AI 분석 후 태그만 저장
  async function saveAnalysisTags(recId: string, rec: RecordForHighlight, data: HighlightAnalysisResult) {
    await deleteAiTagsForRecordAction(rec.type, recId, tenantId);

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

    await saveAnalysisCacheAction({
      tenant_id: tenantId,
      student_id: studentId,
      record_type: rec.type,
      record_id: recId,
      source: "ai",
      analysis_result: data,
      content_hash: computeRecordContentHash(rec.content, careerHashCtx),
    });
  }

  // 다중 레코드 등급 종합 저장
  async function saveAggregatedGrades(allResults: Map<string, HighlightAnalysisResult>) {
    const { aggregateCompetencyGrades } = await import("@/lib/domains/student-record/rubric-matcher");

    const allGrades = [...allResults.values()].flatMap((d) => d.competencyGrades);

    const careerRes = await computeDeterministicCareerGradesAction(studentId);
    if (careerRes.success && careerRes.data.length > 0) {
      allGrades.push(...(careerRes.data as unknown as typeof allGrades));
    }

    const aggregated = aggregateCompetencyGrades(allGrades);

    const promises = aggregated.map((ag) =>
      upsertCompetencyScoreAction({
        tenant_id: tenantId,
        student_id: studentId,
        school_year: schoolYear,
        scope: "yearly",
        competency_area: ag.area,
        competency_item: ag.item,
        grade_value: ag.finalGrade,
        notes: `[AI] ${ag.recordCount}건 ${ag.method === "rubric" ? "루브릭 기반" : "레코드"} 종합`,
        rubric_scores: ag.rubricScores as unknown as Record<string, unknown>[],
        source: "ai",
        status: "suggested",
      }),
    );
    await Promise.allSettled(promises);
    queryClient.invalidateQueries({ queryKey: diagnosisQk });
  }

  // 등급 재집계 (캐시 복원)
  const reaggregateMutation = useMutation({
    mutationFn: async () => {
      let results = highlightResults;
      if (results.size === 0) {
        const cacheRes = await fetchAnalysisCacheAction(studentId, tenantId);
        if (cacheRes.success && cacheRes.data.length > 0) {
          results = new Map<string, HighlightAnalysisResult>();
          for (const row of cacheRes.data) {
            results.set(row.record_id, row.analysis_result as HighlightAnalysisResult);
          }
          setHighlightResults(results);
        }
      }
      if (results.size === 0) throw new Error("분석 캐시가 없습니다. 먼저 일괄 분석을 실행하세요.");
      await saveAggregatedGrades(results);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
    onError: (err: Error) => setError(err.message),
  });

  // 개별 레코드 AI 분석
  async function analyzeRecord(rec: RecordForHighlight) {
    setAnalyzingId(rec.id);
    setError("");
    const result = await analyzeSetekWithHighlight({
      content: rec.content,
      recordType: rec.type,
      subjectName: rec.subjectName,
      grade: rec.grade,
      studentId,
    });
    if (result.success) {
      setHighlightResults((prev) => new Map(prev).set(rec.id, result.data));
      await saveAnalysisTags(rec.id, rec, result.data);
      await saveAggregatedGrades(new Map([[rec.id, result.data]]));
    } else {
      setError(result.error);
    }
    setAnalyzingId(null);
  }

  // 전체 레코드 일괄 분석 (증분)
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, failed: 0, skipped: 0 });
  const batchMutation = useMutation({
    mutationFn: async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const eligible = records.filter((r) => r.content.trim().length >= 20);
      setBatchProgress({ done: 0, total: eligible.length, failed: 0, skipped: 0 });
      const results = new Map<string, HighlightAnalysisResult>();
      const CONCURRENCY = 5;
      let done = 0;
      let failed = 0;
      let batchSkipped = 0;

      const cacheMap = new Map<string, { analysis_result: unknown; content_hash: string | null }>();
      if (!force) {
        const cacheRes = await fetchAnalysisCacheWithHashAction(eligible.map((r) => r.id), tenantId);
        if (cacheRes.success) {
          for (const entry of cacheRes.data) {
            cacheMap.set(entry.record_id, entry);
          }
        }
      }

      const toAnalyze: typeof eligible = [];
      for (const rec of eligible) {
        if (!force) {
          const currentHash = computeRecordContentHash(rec.content, careerHashCtx);
          const cached = cacheMap.get(rec.id);
          if (cached?.content_hash && cached.content_hash === currentHash) {
            results.set(rec.id, cached.analysis_result as HighlightAnalysisResult);
            batchSkipped++;
            done++;
            continue;
          }
        }
        toAnalyze.push(rec);
      }
      setBatchProgress({ done, total: eligible.length, failed, skipped: batchSkipped });

      for (let i = 0; i < toAnalyze.length; i += CONCURRENCY) {
        const batch = toAnalyze.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map(async (rec) => {
            const result = await analyzeSetekWithHighlight({
              content: rec.content,
              recordType: rec.type,
              subjectName: rec.subjectName,
              grade: rec.grade,
              studentId,
            });
            if (result.success) {
              results.set(rec.id, result.data);
              await saveAnalysisTags(rec.id, rec, result.data);
            } else {
              failed++;
            }
          }),
        );
        for (const s of settled) {
          if (s.status === "rejected") failed++;
        }
        done += settled.length;
        setBatchProgress({ done, total: eligible.length, failed, skipped: batchSkipped });
      }

      if (results.size > 0) {
        await saveAggregatedGrades(results);
      }

      const cachedIds = new Set<string>();
      for (const rec of eligible) {
        if (!toAnalyze.includes(rec)) cachedIds.add(rec.id);
      }
      return { results, skipped: batchSkipped, cachedIds };
    },
    onSuccess: ({ results, cachedIds }) => {
      setHighlightResults((prev) => new Map([...prev, ...results]));
      setBatchCachedIds(cachedIds);
      syncPipelineTaskStatus(studentId, "competency_analysis")
        .then(() => {
          queryClient.invalidateQueries({ queryKey: studentRecordKeys.pipeline(studentId) });
        })
        .catch(() => {});
    },
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="flex flex-col gap-6">
      {/* W-2 / S-2: 역량 차트 */}
      <CompetencyCharts
        competencyScores={competencyScores}
        activityTags={activityTags}
        records={records}
      />

      {/* AI 분석 버튼 + 확인 모달 */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">AI 역량 종합 분석</h3>
            <p className="mb-1 text-xs text-[var(--text-secondary)]">
              전체 {records.length}건의 레코드에 대해 AI 역량 분석을 실행합니다.
            </p>
            <p className="mb-4 text-xs text-[var(--text-tertiary)]">
              {forceReanalyze
                ? "캐시를 무시하고 전체 레코드를 재분석합니다. 시간이 오래 걸릴 수 있습니다."
                : "변경된 레코드만 분석하고, 기존 결과는 캐시에서 복원합니다."}
            </p>
            <div className="mb-4">
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary)] select-none">
                <input
                  type="checkbox"
                  checked={forceReanalyze}
                  onChange={(e) => setForceReanalyze(e.target.checked)}
                  className="h-3 w-3 rounded border-gray-300"
                />
                캐시 무시 (전체 재분석)
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                취소
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  batchMutation.mutate({ force: forceReanalyze });
                }}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                분석 시작
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={() => (batchMutation.isPending ? undefined : setShowConfirmModal(true))}
          disabled={batchMutation.isPending || records.length === 0 || analyzingId !== null || isPipelineRunning}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {batchMutation.isPending
            ? `분석 중... ${batchProgress.done}/${batchProgress.total}${batchProgress.skipped > 0 ? ` (캐시 ${batchProgress.skipped})` : ""}`
            : "AI 역량 종합 분석"}
        </button>
        {isPipelineRunning ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <Loader2 size={12} className="animate-spin" /> AI 초기 분석 파이프라인 진행 중
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button
              type="button"
              onClick={() => batchMutation.mutate({ force: forceReanalyze })}
              className="ml-1 font-medium underline hover:no-underline"
            >
              재시도
            </button>
          </span>
        ) : batchMutation.isSuccess && batchProgress.failed > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {batchProgress.total - batchProgress.failed - batchProgress.skipped}건 분석 ·{" "}
            {batchProgress.skipped > 0 ? `${batchProgress.skipped}건 캐시 · ` : ""}
            {batchProgress.failed}건 실패
          </span>
        ) : batchMutation.isSuccess ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-0.5 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <Check size={12} />
            {batchProgress.skipped > 0
              ? `${batchProgress.total - batchProgress.skipped}건 분석 · ${batchProgress.skipped}건 캐시 복원`
              : `${batchProgress.total}건 분석 완료`}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-tertiary)]">
            {records.length > 0 ? `${records.length}건 레코드` : "분석할 레코드가 없습니다"}
          </span>
        )}
      </div>

      {/* 콘텐츠 품질 요약 카드 */}
      {qualityScores && qualityScores.length > 0 && (
        <QualitySummaryCard qualityScores={qualityScores} recordLabelMap={recordLabelMap} />
      )}

      {/* 활동별 역량 분석: 학년 탭 + 유형 섹션 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">활동별 역량 분석</h4>
          {highlightResults.size > 0 && (
            <button
              onClick={() => setComparisonMode((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors",
                comparisonMode
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                  : "text-[var(--text-tertiary)] hover:bg-gray-100 dark:hover:bg-gray-800",
              )}
            >
              <GitCompare className="h-3 w-3" />
              {comparisonMode ? "비교 모드 끄기" : "AI/컨설턴트 비교"}
            </button>
          )}
        </div>

        {/* 학년 탭 */}
        {availableGrades.length > 1 && (
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {availableGrades.map((g) => (
              <button
                key={g}
                onClick={() => {
                  setSelectedGrade(g);
                  setSelectedType("all");
                }}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedGrade === g
                    ? "bg-white text-[var(--text-primary)] shadow-sm dark:bg-gray-700"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
                )}
              >
                {g}학년
              </button>
            ))}
          </div>
        )}

        {/* 유형 서브탭 */}
        <div className="mb-3 flex gap-1.5">
          {(
            [
              { key: "all" as RecordTypeFilter, label: "전체", count: typeCounts.setek + typeCounts.changche + typeCounts.haengteuk },
              { key: "setek" as RecordTypeFilter, label: "세특", count: typeCounts.setek },
              { key: "changche" as RecordTypeFilter, label: "창체", count: typeCounts.changche },
              { key: "haengteuk" as RecordTypeFilter, label: "행특", count: typeCounts.haengteuk },
            ] as const
          )
            .filter((t) => t.key === "all" || t.count > 0)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setSelectedType(t.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selectedType === t.key
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "text-[var(--text-tertiary)] hover:bg-gray-100 dark:hover:bg-gray-800",
                )}
              >
                {t.label}
                <span className="ml-1 text-[10px] opacity-60">{t.count}</span>
              </button>
            ))}
        </div>

        {/* 필터된 레코드 렌더링 */}
        <div className="flex flex-col gap-3">
          {filteredRecords.map((rec) => {
            const result = highlightResults.get(rec.id);
            const conResult = consultantResults.get(rec.id);
            const isAnalyzing = analyzingId === rec.id;
            const wasCached = batchCachedIds.has(rec.id);
            const qualityEntry = qualityScores?.find((q) => q.record_id === rec.id);
            const qualityBadgeNode = qualityEntry ? <QualityScoreBadge entry={qualityEntry} /> : null;

            if (result && comparisonMode) {
              return (
                <HighlightComparisonView
                  key={rec.id}
                  content={rec.content}
                  label={rec.label}
                  aiResult={result}
                  consultantResult={conResult}
                />
              );
            }

            if (result) {
              return (
                <HighlightedSetekView
                  key={rec.id}
                  content={rec.content}
                  sections={result.sections}
                  label={rec.label}
                  defaultExpanded={true}
                  onReanalyze={() => analyzeRecord(rec)}
                  isReanalyzing={isAnalyzing}
                  qualityBadge={qualityBadgeNode}
                />
              );
            }

            return (
              <div
                key={rec.id}
                className={cn("rounded-lg border border-gray-200 dark:border-gray-700", isAnalyzing && "animate-pulse")}
              >
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--text-primary)]">{rec.label}</span>
                    {qualityBadgeNode}
                    {wasCached && batchMutation.isSuccess && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        캐시
                      </span>
                    )}
                  </div>
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
                    {isAnalyzing ? "분석 중..." : "분석"}
                  </button>
                </div>
                <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700">
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{rec.content.slice(0, 150)}...</p>
                </div>
              </div>
            );
          })}
          {filteredRecords.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--text-tertiary)]">해당 유형의 레코드가 없습니다</p>
          )}
        </div>
      </div>

      {/* 분석 완료 → 종합진단 안내 */}
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

      {/* 종합 등급 + 루브릭 상세 */}
      <CompetencyGradesTable
        competencyScores={competencyScores}
        activityTags={activityTags}
        tagStats={tagStats}
        isReaggregating={reaggregateMutation.isPending}
        isBatchPending={batchMutation.isPending}
        hasHighlightResults={highlightResults.size > 0}
        onReaggregate={() => reaggregateMutation.mutate()}
        onGradeChange={(input) => gradeMutation.mutate(input)}
        onTagConfirm={(tagId) => tagConfirmMutation.mutate(tagId)}
        onTagDelete={(tagId) => tagDeleteMutation.mutate(tagId)}
        isTagConfirmPending={tagConfirmMutation.isPending}
        isTagDeletePending={tagDeleteMutation.isPending}
        isGradePending={gradeMutation.isPending}
      />
    </div>
  );
}
