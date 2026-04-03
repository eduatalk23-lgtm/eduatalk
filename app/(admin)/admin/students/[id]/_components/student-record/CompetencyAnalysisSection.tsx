"use client";

// ============================================
// 역량 분석 통합 섹션
// Phase 6.1 — 종합 등급(상단) + 세특별 하이라이트(중단) + 태그 요약(하단)
// ============================================

import { useState, useMemo, useEffect, Fragment } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/cn";
import { analyzeSetekWithHighlight } from "@/lib/domains/student-record/llm/actions/analyzeWithHighlight";
import { upsertCompetencyScoreAction, addActivityTagsBatchAction, deleteAiTagsForRecordAction, confirmActivityTagAction, deleteActivityTagAction, fetchAnalysisCacheAction, saveAnalysisCacheAction, fetchAnalysisCacheWithHashAction, computeDeterministicCareerGradesAction } from "@/lib/domains/student-record/actions/diagnosis";
import { computeRecordContentHash } from "@/lib/domains/student-record/content-hash";
import { syncPipelineTaskStatus } from "@/lib/domains/student-record/actions/pipeline";
import type { ActivityTagInsert, RubricScoreEntry } from "@/lib/domains/student-record/types";
import { COMPETENCY_ITEMS, COMPETENCY_AREA_LABELS, COMPETENCY_RUBRIC_QUESTIONS } from "@/lib/domains/student-record";
import { deriveItemGradeFromRubrics, aggregateTagsByQuestion } from "@/lib/domains/student-record/rubric-matcher";
import type { CompetencyScore, ActivityTag, CompetencyArea, CompetencyGrade, CompetencyItemCode } from "@/lib/domains/student-record";
import type { HighlightAnalysisResult } from "@/lib/domains/student-record/llm/types";
import { studentRecordKeys } from "@/lib/query-options/studentRecord";
import { HighlightedSetekView, CompetencyBadge } from "./HighlightedSetekView";
import { HighlightComparisonView } from "./HighlightComparisonView";
import { QualityScoreBadge, QualitySummaryCard } from "./QualityScoreBadge";
import type { QualityScoreEntry } from "./QualityScoreBadge";

import { Sparkles, ArrowDown, Check, X, ChevronRight, Loader2, GitCompare } from "lucide-react";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { buildRadarData, buildGrowthData } from "@/lib/domains/student-record/chart-data";
import { COMPETENCY_AREA_LABELS as AREA_LABELS_CHART } from "@/lib/domains/student-record/constants";

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
  /** 증분 분석 캐시 키에 포함 — 변경 시 캐시 자동 무효화 */
  targetMajor?: string | null;
  takenSubjects?: string[];
  /** Phase 1-3 역량 분석에서 생성된 콘텐츠 품질 점수 */
  qualityScores?: QualityScoreEntry[];
};

const GRADES: CompetencyGrade[] = ["A+", "A-", "B+", "B", "B-", "C"];
const AREAS: CompetencyArea[] = ["academic", "career", "community"];

function findScore(scores: CompetencyScore[], code: string): string {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.grade_value ?? "";
}

function findNarrative(scores: CompetencyScore[], code: string): string | null {
  return scores.find((s) => s.competency_item === code && s.scope === "yearly")?.narrative ?? null;
}

function findRubricScores(scores: CompetencyScore[], code: string, source: string): RubricScoreEntry[] {
  const score = scores.find((s) => s.competency_item === code && s.scope === "yearly" && s.source === source);
  if (!score?.rubric_scores || !Array.isArray(score.rubric_scores)) return [];
  return score.rubric_scores as unknown as RubricScoreEntry[];
}

// 태그 통계 — 학년별/레코드별 그룹핑
type TagsByRecord = {
  recordId: string;
  recordLabel: string;
  grade: number;
  tags: ActivityTag[];
};
type TagStatsGrouped = {
  positive: number;
  negative: number;
  needs_review: number;
  recordCount: number;
  byGrade: Map<number, TagsByRecord[]>;
};
type RecordLabelMap = Map<string, { label: string; grade: number }>;

function countTagsByItem(tags: ActivityTag[], recordLabelMap: RecordLabelMap) {
  const map = new Map<string, TagStatsGrouped>();
  for (const tag of tags) {
    const key = tag.competency_item;
    const entry = map.get(key) ?? { positive: 0, negative: 0, needs_review: 0, recordCount: 0, byGrade: new Map<number, TagsByRecord[]>() };
    if (tag.evaluation === "positive") entry.positive++;
    else if (tag.evaluation === "negative") entry.negative++;
    else entry.needs_review++;

    // 학년 → 레코드 그룹핑
    const recInfo = recordLabelMap.get(tag.record_id);
    const grade = recInfo?.grade ?? 0;
    const recordLabel = recInfo?.label ?? tag.record_type;

    if (!entry.byGrade.has(grade)) entry.byGrade.set(grade, []);
    const gradeRecords = entry.byGrade.get(grade)!;
    let recordGroup = gradeRecords.find((rg: TagsByRecord) => rg.recordId === tag.record_id);
    if (!recordGroup) {
      recordGroup = { recordId: tag.record_id, recordLabel, grade, tags: [] };
      gradeRecords.push(recordGroup);
    }
    recordGroup.tags.push(tag);

    map.set(key, entry);
  }
  // recordCount 계산
  for (const entry of map.values()) {
    let count = 0;
    for (const records of entry.byGrade.values()) count += records.length;
    entry.recordCount = count;
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
  const [expandedTagItem, setExpandedTagItem] = useState<string | null>(null);
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
  // 선택 학년의 유형별 건수 + 필터된 레코드
  const { typeCounts, filteredRecords } = useMemo(() => {
    const gradeFiltered = records.filter((r) => (r.grade ?? 0) === selectedGrade);
    const counts = {
      setek: gradeFiltered.filter((r) => r.type === "setek" || r.type === "personal_setek").length,
      changche: gradeFiltered.filter((r) => r.type === "changche").length,
      haengteuk: gradeFiltered.filter((r) => r.type === "haengteuk").length,
    };
    const filtered = selectedType === "all"
      ? gradeFiltered
      : gradeFiltered.filter((r) =>
          selectedType === "setek" ? (r.type === "setek" || r.type === "personal_setek") : r.type === selectedType,
        );
    return { typeCounts: counts, filteredRecords: filtered };
  }, [records, selectedGrade, selectedType]);
  const careerHashCtx = useMemo(() =>
    targetMajor ? { targetMajor, takenSubjects: takenSubjects ?? [] } : null,
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
      // evidence_summary에서 근거 텍스트 추출: [컨설턴트] 근거: "..." 형식
      const highlightTags = tags.map((t) => {
        const highlightMatch = t.evidence_summary?.match(/근거:\s*"([^"]+)"/);
        return {
          competencyItem: t.competency_item as import("@/lib/domains/student-record").CompetencyItemCode,
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
  });

  const tagDeleteMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const result = await deleteActivityTagAction(tagId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: diagnosisQk }),
  });

  const [expandedRubricItem, setExpandedRubricItem] = useState<string | null>(null);
  const [expandedRubricQ, setExpandedRubricQ] = useState<string | null>(null); // "item:qi" key

  const gradeMutation = useMutation({
    mutationFn: async (input: { area: CompetencyArea; item: string; grade: CompetencyGrade; rubricScores?: RubricScoreEntry[] }) => {
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

    // 분석 결과 캐시 저장 (content_hash 포함 — 증분 분석용)
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

  // 다중 레코드의 등급을 종합하여 1회 저장 (AI 텍스트 등급 + 결정론적 이수/성적 등급)
  async function saveAggregatedGrades(allResults: Map<string, HighlightAnalysisResult>) {
    const { aggregateCompetencyGrades } = await import("@/lib/domains/student-record/rubric-matcher");

    const allGrades = [...allResults.values()].flatMap((d) => d.competencyGrades);

    // 결정론적 등급: 서버에서 이수율+성적 기반으로 계산 (파이프라인과 동일 로직)
    const careerRes = await computeDeterministicCareerGradesAction(studentId);
    if (careerRes.success && careerRes.data.length > 0) {
      allGrades.push(...careerRes.data as unknown as typeof allGrades);
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

  // 등급 재집계 (캐시에서 복원 — AI 호출 없이 루브릭 등급 재생성)
  const reaggregateMutation = useMutation({
    mutationFn: async () => {
      // 캐시가 없으면 서버에서 조회
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
      // 개별 분석은 등급도 즉시 저장 (단일 레코드이므로 충돌 없음)
      await saveAggregatedGrades(new Map([[rec.id, result.data]]));
    } else {
      setError(result.error);
    }
    setAnalyzingId(null);
  }

  // 전체 레코드 일괄 분석 (증분: 캐시 히트 시 스킵, 동시성 3개 제한)
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

      // 증분: 배치 캐시 조회 (강제 재분석 시 스킵)
      const cacheMap = new Map<string, { analysis_result: unknown; content_hash: string | null }>();
      if (!force) {
        const cacheRes = await fetchAnalysisCacheWithHashAction(eligible.map((r) => r.id), tenantId);
        if (cacheRes.success) {
          for (const entry of cacheRes.data) {
            cacheMap.set(entry.record_id, entry);
          }
        }
      }

      // 캐시 히트 레코드 먼저 처리 (LLM 호출 X)
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

      // 신규/변경 레코드만 AI 분석
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
      // 전체 레코드 등급 종합 저장 (캐시 복원 + 신규 분석 합산)
      if (results.size > 0) {
        await saveAggregatedGrades(results);
      }
      // 캐시 히트된 레코드 ID Set
      const cachedIds = new Set<string>();
      for (const rec of eligible) {
        if (!toAnalyze.includes(rec)) cachedIds.add(rec.id);
      }
      return { results, skipped: batchSkipped, cachedIds };
    },
    onSuccess: ({ results, cachedIds }) => {
      setHighlightResults((prev) => new Map([...prev, ...results]));
      setBatchCachedIds(cachedIds);
      syncPipelineTaskStatus(studentId, "competency_analysis").then(() => {
        queryClient.invalidateQueries({ queryKey: studentRecordKeys.pipeline(studentId) });
      }).catch(() => {});
    },
    onError: (err: Error) => setError(err.message),
  });

  // W-2: 레이더 차트 데이터
  const radarData = useMemo(
    () => buildRadarData(competencyScores.filter((s) => s.source === "ai"), competencyScores.filter((s) => s.source === "manual")),
    [competencyScores],
  );
  const hasRadarData = radarData.some((d) => d.AI > 0 || d.컨설턴트 > 0);
  const { recharts, loading: chartsLoading } = useRecharts();

  return (
    <div className="flex flex-col gap-6">
      {/* W-2: 역량 레이더 차트 */}
      {hasRadarData && (
        <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
          <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">역량 프로필</h4>
          {chartsLoading || !recharts ? (
            <ChartLoadingSkeleton height={220} />
          ) : (() => {
            const { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } = recharts;
            return (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                  <PolarGrid stroke="var(--border-secondary, #e5e7eb)" />
                  <PolarAngleAxis dataKey="item" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 9 }} tickCount={6} />
                  <Radar name="AI" dataKey="AI" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="5 3" />
                  <Radar name="컨설턴트" dataKey="컨설턴트" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                </RadarChart>
              </ResponsiveContainer>
            );
          })()}
        </div>
      )}

      {/* S-2: 역량 성장 추이 라인 차트 */}
      {hasRadarData && !chartsLoading && recharts && (() => {
        // records에서 record_id→grade 매핑 구축
        const recordGradeMap: Record<number, Record<string, number>> = {};
        for (const rec of records) {
          if (!rec.grade) continue;
          // 학년별 항목별 집계
          for (const tag of activityTags) {
            if (tag.record_id !== rec.id) continue;
            const gradeKey = rec.grade;
            if (!recordGradeMap[gradeKey]) recordGradeMap[gradeKey] = {};
            const areaMap = recordGradeMap[gradeKey];
            const item = COMPETENCY_ITEMS.find((i) => i.code === tag.competency_item);
            if (!item) continue;
            const areaLabel = AREA_LABELS_CHART[item.area];
            if (!areaMap[`${areaLabel}_pos`]) areaMap[`${areaLabel}_pos`] = 0;
            if (!areaMap[`${areaLabel}_tot`]) areaMap[`${areaLabel}_tot`] = 0;
            areaMap[`${areaLabel}_tot`]++;
            if (tag.evaluation === "positive") areaMap[`${areaLabel}_pos`]++;
          }
        }

        const grades = Object.keys(recordGradeMap).map(Number).sort();
        if (grades.length < 2) return null;

        const AREA_COLORS_LINE: Record<string, string> = {
          [AREA_LABELS_CHART.academic]: "#6366f1",
          [AREA_LABELS_CHART.career]: "#8b5cf6",
          [AREA_LABELS_CHART.community]: "#10b981",
        };

        const lineData = grades.map((g) => {
          const m = recordGradeMap[g] ?? {};
          const point: Record<string, string | number> = { 학년: `${g}학년` };
          for (const area of ["academic", "career", "community"] as const) {
            const label = AREA_LABELS_CHART[area];
            const pos = m[`${label}_pos`] ?? 0;
            const tot = m[`${label}_tot`] ?? 0;
            if (tot > 0) point[label] = Number(((pos / tot) * 5).toFixed(1));
          }
          return point;
        });

        const lines = Object.values(AREA_LABELS_CHART).filter((label) =>
          lineData.some((d) => label in d),
        );

        if (lines.length === 0) return null;

        const { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer: RC, Tooltip: TT, Legend: LG } = recharts;
        return (
          <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
            <h4 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">역량 성장 추이</h4>
            <RC width="100%" height={180}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary, #f0f0f0)" />
                <XAxis dataKey="학년" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                <TT contentStyle={{ fontSize: 11 }} />
                <LG wrapperStyle={{ fontSize: 9 }} iconSize={8} />
                {lines.map((label) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={AREA_COLORS_LINE[label] ?? "#6b7280"}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </RC>
          </div>
        );
      })()}

      {/* ─── AI 분석 버튼 + 확인 모달 ──────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowConfirmModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
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
                onClick={() => { setShowConfirmModal(false); batchMutation.mutate({ force: forceReanalyze }); }}
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
          onClick={() => batchMutation.isPending ? undefined : setShowConfirmModal(true)}
          disabled={batchMutation.isPending || records.length === 0 || analyzingId !== null || isPipelineRunning}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Sparkles size={14} />
          {batchMutation.isPending
            ? `분석 중... ${batchProgress.done}/${batchProgress.total}${batchProgress.skipped > 0 ? ` (캐시 ${batchProgress.skipped})` : ""}`
            : "AI 역량 종합 분석"}
        </button>
        {/* 상태 필 — 파이프라인 / 에러 / 부분 실패를 하나로 */}
        {isPipelineRunning ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            <Loader2 size={12} className="animate-spin" /> AI 초기 분석 파이프라인 진행 중
          </span>
        ) : error ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button type="button" onClick={() => batchMutation.mutate({ force: forceReanalyze })}
              className="ml-1 font-medium underline hover:no-underline">재시도</button>
          </span>
        ) : batchMutation.isSuccess && batchProgress.failed > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
            {batchProgress.total - batchProgress.failed - batchProgress.skipped}건 분석 · {batchProgress.skipped > 0 ? `${batchProgress.skipped}건 캐시 · ` : ""}{batchProgress.failed}건 실패
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

      {/* ─── 콘텐츠 품질 요약 카드 ── */}
      {qualityScores && qualityScores.length > 0 && (
        <QualitySummaryCard
          qualityScores={qualityScores}
          recordLabelMap={recordLabelMap}
        />
      )}

      {/* ─── 활동별 역량 분석: 학년 탭 + 유형 섹션 ── */}
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
                onClick={() => { setSelectedGrade(g); setSelectedType("all"); }}
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
          {([
            { key: "all" as RecordTypeFilter, label: "전체", count: typeCounts.setek + typeCounts.changche + typeCounts.haengteuk },
            { key: "setek" as RecordTypeFilter, label: "세특", count: typeCounts.setek },
            { key: "changche" as RecordTypeFilter, label: "창체", count: typeCounts.changche },
            { key: "haengteuk" as RecordTypeFilter, label: "행특", count: typeCounts.haengteuk },
          ] as const).filter((t) => t.key === "all" || t.count > 0).map((t) => (
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
            const qualityBadgeNode = qualityEntry
              ? <QualityScoreBadge entry={qualityEntry} />
              : null;

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
              <div key={rec.id} className={cn("rounded-lg border border-gray-200 dark:border-gray-700", isAnalyzing && "animate-pulse")}>
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-[var(--text-primary)]">{rec.label}</span>
                    {qualityBadgeNode}
                    {wasCached && batchMutation.isSuccess && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">캐시</span>
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

      {/* ─── 종합 등급 + 루브릭 상세 (2레벨 아코디언) ── */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-[var(--text-primary)]">종합 등급 + 루브릭 상세</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">항목 클릭 시 루브릭 질문 펼침</span>
          <span className="flex-1" />
          {highlightResults.size > 0 && (
            <button
              onClick={() => reaggregateMutation.mutate()}
              disabled={reaggregateMutation.isPending || batchMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[10px] text-[var(--text-secondary)] transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              {reaggregateMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <ArrowDown size={10} />}
              등급 재집계
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/50">
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
                      {/* ── 상위 항목 행 ── */}
                      <tr className={cn(
                        "border-b border-gray-100 dark:border-gray-700/50",
                        idx === items.length - 1 && !isExpanded && "border-b-2 border-gray-200 dark:border-gray-600",
                        isExpanded && "bg-indigo-50/30 dark:bg-indigo-900/10",
                      )}>
                        <td className={cn(
                          "px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] border-r border-gray-100 dark:border-gray-700/50",
                          idx > 0 && "text-transparent select-none",
                        )}>
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
                            <span className={cn("text-[11px] font-semibold", aiGrade.startsWith("A") ? "text-blue-600" : aiGrade.startsWith("B") ? "text-green-600" : "text-amber-600")}>
                              {aiGrade}
                            </span>
                          ) : <span className="text-[var(--text-tertiary)]">-</span>}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <select
                            value={consultantGrade || currentGrade}
                            onChange={(e) =>
                              gradeMutation.mutate({ area, item: item.code, grade: e.target.value as CompetencyGrade })
                            }
                            className={cn(
                              "w-14 rounded border px-1 py-0.5 text-center text-[11px]",
                              "border-gray-300 bg-[var(--background)] dark:border-gray-600",
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
                              className="cursor-pointer text-[10px] hover:underline"
                            >
                              {stats.positive > 0 && <span className="text-green-600">+{stats.positive}</span>}
                              {stats.negative > 0 && <span className="ml-0.5 text-red-500">-{stats.negative}</span>}
                            </button>
                          ) : <span className="text-[var(--text-tertiary)]">-</span>}
                        </td>
                      </tr>
                      {/* ── 하위 루브릭 질문 행 (아코디언) + 질문별 근거 ── */}
                      {isExpanded && (() => {
                        const aiNarrative = findNarrative(competencyScores.filter((s) => s.source === "ai"), item.code);
                        const qStats = aggregateTagsByQuestion(item.code, activityTags);
                        return (
                          <>
                            {aiNarrative && (
                              <tr className="bg-blue-50/30 dark:bg-blue-900/10">
                                <td colSpan={5} className="px-4 py-1.5 text-[10px] leading-relaxed text-blue-700 dark:text-blue-300">
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
                              <tr className={cn(
                                "border-b border-gray-50 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-800/20",
                                qi === questions.length - 1 && idx === items.length - 1 && !isQExpanded && "border-b-2 border-gray-200 dark:border-gray-600",
                              )}>
                                <td className="border-r border-gray-100 dark:border-gray-700/50" />
                                <td className="py-1.5 pl-8 pr-3 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                  {q}
                                  {noEvidence && (
                                    <span className="ml-1.5 rounded bg-gray-100 px-1 py-px text-[8px] text-gray-400 dark:bg-gray-700 dark:text-gray-500">근거없음</span>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  {aiR ? (
                                    <span className={cn("text-[10px] font-semibold", aiR.grade.startsWith("A") ? "text-blue-600" : aiR.grade.startsWith("B") ? "text-green-600" : "text-amber-600")}>
                                      {aiR.grade}
                                    </span>
                                  ) : <span className="text-[10px] text-gray-300">-</span>}
                                </td>
                                <td className="px-2 py-1.5 text-center">
                                  <select
                                    value={conR?.grade ?? ""}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      const newGrade = e.target.value as CompetencyGrade;
                                      const updated = [...conRubrics.filter((r) => r.questionIndex !== qi), { questionIndex: qi, grade: newGrade, reasoning: conR?.reasoning ?? "" }];
                                      const derived = deriveItemGradeFromRubrics(updated);
                                      gradeMutation.mutate({ area, item: item.code, grade: derived ?? newGrade, rubricScores: updated });
                                    }}
                                    disabled={gradeMutation.isPending}
                                    className={cn(
                                      "w-14 rounded border px-0.5 py-0.5 text-center text-[10px]",
                                      "border-gray-200 bg-[var(--background)] dark:border-gray-600",
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
                                      className="text-[9px] hover:underline"
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
                                  <td className="border-r border-gray-100 dark:border-gray-700/50" />
                                  <td colSpan={4} className="bg-gray-50/60 py-1.5 pl-10 pr-3 dark:bg-gray-800/30">
                                    <div className="flex flex-col gap-0.5">
                                      {qStat.evidences.map((ev, ei) => (
                                        <p key={ei} className="text-[10px] leading-relaxed text-[var(--text-tertiary)]">
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
                      {/* ── 태그 상세 (펼침) ── */}
                      {expandedTagItem === item.code && stats && (
                        <tr>
                          <td colSpan={5} className="bg-gray-50/50 px-4 py-2 dark:bg-gray-800/30">
                            <div className="flex flex-col gap-1.5">
                              {[...stats.byGrade.entries()]
                                .sort(([a], [b]) => a - b)
                                .map(([grade, recordGroups]) => (
                                  <div key={grade}>
                                    {stats.byGrade.size > 1 && (
                                      <div className="text-[9px] font-semibold text-[var(--text-tertiary)] mb-0.5">{grade}학년</div>
                                    )}
                                    {recordGroups.map((rg) => (
                                      <div key={rg.recordId} className="mb-1">
                                        <div className="text-[9px] text-[var(--text-tertiary)] mb-0.5">📄 {rg.recordLabel}</div>
                                        <div className="ml-4 flex flex-col gap-0.5">
                                          {rg.tags.map((tag) => {
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
                                                  <span className="flex shrink-0 gap-0.5">
                                                    <button onClick={() => tagConfirmMutation.mutate(tag.id)} disabled={tagConfirmMutation.isPending} className="rounded p-1 text-green-600 hover:bg-green-100 disabled:opacity-50" title="확정">
                                                      {tagConfirmMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                                                    </button>
                                                    <button onClick={() => tagDeleteMutation.mutate(tag.id)} disabled={tagDeleteMutation.isPending} className="rounded p-1 text-red-500 hover:bg-red-100 disabled:opacity-50" title="거부">
                                                      {tagDeleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
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

    </div>
  );
}
