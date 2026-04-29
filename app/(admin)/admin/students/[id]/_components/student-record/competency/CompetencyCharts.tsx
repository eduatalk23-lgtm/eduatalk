"use client";

// ============================================
// 역량 레이더 차트 (3영역 독립) + 학기별 성장 추이 + Heatmap + Box Plot
// ============================================

import { useMemo } from "react";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import {
  buildAreaRadarData,
  buildGrowthDataFromScores,
  buildSemesterHeatmapData,
  buildSemesterQualityBoxData,
  buildRecordSemesterMapping,
  type ContentQualityWithSemester,
  type SemesterRangeOptions,
  type SubjectSemesterMap,
  type GrowthTrendInfo,
} from "@/lib/domains/student-record/chart-data";
import { COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag, RecordTabData } from "@/lib/domains/student-record";
import type { RecordForHighlight } from "./competency-helpers";
import {
  AREA_COLORS,
  CompetencyAxisTick,
  type RechartsPolarTickProps,
} from "./AreaCompetencyDetail";
import { useStudentRecordContext } from "../StudentRecordContext";
import { SemesterHeatmap } from "../../shared-charts/SemesterHeatmap";
import { QualityBoxPlot } from "../../shared-charts/QualityBoxPlot";

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
  /** 학기별 차트용 (optional — 있으면 학기 단위 차트 표시) */
  recordDataByGrade?: Record<number, RecordTabData>;
  /** 내신 성적 기반 학기 보정 맵 (optional — 없으면 setek.semester 그대로 사용) */
  subjectSemesterMap?: SubjectSemesterMap;
  /** 품질 점수 (5축 상세, Box Plot용) */
  qualityScores?: Array<{
    record_type: string;
    record_id: string;
    overall_score: number;
    specificity?: number;
    coherence?: number;
    depth?: number;
    grammar?: number;
    scientific_validity?: number | null;
  }>;
};

export function CompetencyCharts({ competencyScores, activityTags, records, recordDataByGrade, subjectSemesterMap, qualityScores }: Props) {
  const { subjects } = useStudentRecordContext();

  // subject name map
  const subjectNamesById = useMemo(
    () => Object.fromEntries((subjects ?? []).map((s) => [s.id, s.name])),
    [subjects],
  );

  // 3영역 독립 레이더 데이터
  const areaSections = useMemo(
    () =>
      buildAreaRadarData(
        competencyScores.filter((s) => s.source === "ai"),
        competencyScores.filter((s) => s.source === "manual"),
      ),
    [competencyScores],
  );
  const hasRadarData = areaSections.some((sec) =>
    sec.items.some((i) => i.AI > 0 || i.컨설턴트 > 0),
  );

  const { recharts, loading: chartsLoading } = useRecharts();

  // 학생 현재 학년 (recordDataByGrade의 최대 key)
  const studentGrade = useMemo(() => {
    if (!recordDataByGrade) return undefined;
    const grades = Object.keys(recordDataByGrade).map(Number);
    return grades.length > 0 ? Math.max(...grades) : undefined;
  }, [recordDataByGrade]);

  // 수시 범위 제한 + 학기 보정
  const rangeOptions: SemesterRangeOptions | undefined = useMemo(
    () => studentGrade ? { maxSemester: { grade: studentGrade, semester: 1 }, subjectSemesterMap } : undefined,
    [studentGrade, subjectSemesterMap],
  );

  // 설계 모드 학년
  const designGrades = useMemo(() => {
    if (!recordDataByGrade) return [];
    return Object.entries(recordDataByGrade)
      .filter(([, rd]) => {
        const hasNeis = rd.seteks?.some((s) => s.imported_content?.trim()) ||
          rd.changche?.some((c) => c.imported_content?.trim());
        return !hasNeis;
      })
      .map(([g]) => Number(g));
  }, [recordDataByGrade]);

  // A4: competency_scores 기반 학년별 성장 추이 (activity_tags → scores 통폐합)
  const { data: growthLineData, trendInfo } = useMemo(
    () => buildGrowthDataFromScores(competencyScores),
    [competencyScores],
  );

  const growthLines = useMemo(() => {
    if (!growthLineData || growthLineData.length < 2) return [];
    return (["academic", "career", "community"] as const)
      .map((area) => COMPETENCY_AREA_LABELS[area])
      .filter((label) => growthLineData.some((d) => label in d));
  }, [growthLineData]);

  // 학기별 Heatmap 데이터
  const heatmapData = useMemo(() => {
    if (!recordDataByGrade) return null;
    return buildSemesterHeatmapData(activityTags, recordDataByGrade, rangeOptions);
  }, [activityTags, recordDataByGrade, rangeOptions]);

  // 학기별 Box Plot 데이터
  const qualityBoxData = useMemo(() => {
    if (!qualityScores || qualityScores.length === 0 || !recordDataByGrade) return { boxes: null, axisTrends: null };
    const { recordSemesterMap: recMap } = buildRecordSemesterMapping(recordDataByGrade, subjectSemesterMap);
    const subjectMap = new Map<string, string>();
    for (const tabData of Object.values(recordDataByGrade)) {
      for (const s of tabData?.seteks ?? []) subjectMap.set(s.id, s.subject_id);
    }
    const enriched: ContentQualityWithSemester[] = qualityScores
      .map((q) => {
        const info = recMap.get(q.record_id);
        if (!info) return null;
        return {
          record_id: q.record_id,
          record_type: q.record_type,
          overall_score: q.overall_score,
          specificity: q.specificity ?? 0,
          coherence: q.coherence ?? 0,
          depth: q.depth ?? 0,
          grammar: q.grammar ?? 0,
          scientific_validity: q.scientific_validity ?? null,
          grade: info.grade,
          semester: info.semester,
          subject_id: subjectMap.get(q.record_id),
        };
      })
      .filter((q): q is ContentQualityWithSemester => q !== null);
    return buildSemesterQualityBoxData(enriched, subjectNamesById, rangeOptions);
  }, [qualityScores, recordDataByGrade, subjectNamesById, subjectSemesterMap, rangeOptions]);

  // Y축 하한 동적 계산
  const yMin = useMemo(() => {
    if (!growthLineData) return 0;
    let min = 5;
    for (const d of growthLineData) {
      for (const [k, v] of Object.entries(d)) {
        if (k !== "학년" && typeof v === "number" && v < min) min = v;
      }
    }
    return Math.max(0, Math.floor(min) - 1);
  }, [growthLineData]);

  const AREA_COLORS_LINE: Record<string, string> = {
    [COMPETENCY_AREA_LABELS.academic]: AREA_COLORS.academic,
    [COMPETENCY_AREA_LABELS.career]: AREA_COLORS.career,
    [COMPETENCY_AREA_LABELS.community]: AREA_COLORS.community,
  };

  if (!hasRadarData) return null;

  return (
    <>
      {/* W-2: 3영역 독립 레이더 (AI vs 컨설턴트 오버레이) */}
      <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">역량 프로필 (3영역)</h4>
          <div className="flex items-center gap-3 text-3xs text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-3 border-t border-dashed border-current" />
              AI
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-[2px] w-3 border-t border-current" />
              컨설턴트
            </span>
          </div>
        </div>
        {chartsLoading || !recharts ? (
          <ChartLoadingSkeleton height={240} />
        ) : (
          (() => {
            const {
              RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
              ResponsiveContainer, Tooltip,
            } = recharts;
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {areaSections.map((sec) => {
                  const color = AREA_COLORS[sec.area];
                  const hasAi = sec.items.some((i) => i.AI > 0);
                  const hasCon = sec.items.some((i) => i.컨설턴트 > 0);
                  return (
                    <div key={sec.area} className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-2">
                      <div className="flex items-center justify-between px-1 pb-1">
                        <span className="text-2xs font-semibold text-[var(--text-primary)]">{sec.label}</span>
                        <span className="rounded-full px-1.5 py-0.5 text-3xs font-bold" style={{ backgroundColor: color + "20", color }}>
                          {sec.items.some((i) => i.AI > 0 || i.컨설턴트 > 0) ? sec.avgGrade : "-"}
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart data={sec.items} cx="50%" cy="50%" outerRadius="58%" margin={{ top: 12, right: 32, bottom: 12, left: 32 }}>
                          <PolarGrid stroke="var(--border-secondary, #e5e7eb)" />
                          <PolarAngleAxis
                            dataKey="item"
                            tick={(tickProps: RechartsPolarTickProps) => (
                              <CompetencyAxisTick {...tickProps} items={sec.items} color={color} />
                            )}
                          />
                          <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                          {hasAi && (
                            <Radar name="AI" dataKey="AI" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={1.5} strokeDasharray="5 3" />
                          )}
                          {hasCon && (
                            <Radar name="컨설턴트" dataKey="컨설턴트" stroke={color} fill={color} fillOpacity={0.28} strokeWidth={2} />
                          )}
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                      {sec.mismatchCount > 0 && (
                        <p className="pt-0.5 text-center text-3xs text-amber-600 dark:text-amber-400">
                          AI↔컨설턴트 불일치 {sec.mismatchCount}건
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>

      {/* A4: 학년별 3영역 성장 추이 LineChart (competency_scores 기반) */}
      {!chartsLoading && recharts && growthLineData && growthLineData.length >= 2 && growthLines.length > 0 && (() => {
        const {
          LineChart, Line, XAxis, YAxis, CartesianGrid,
          ResponsiveContainer: RC, Tooltip: TT, Legend: LG,
        } = recharts;
        return (
          <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">학년별 역량 성장 추이</h4>
              {trendInfo && (
                <span className={`rounded-full px-2 py-0.5 text-3xs font-medium ${
                  trendInfo.overallTrend === "rising" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : trendInfo.overallTrend === "falling" ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : trendInfo.overallTrend === "volatile" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-bg-secondary text-text-secondary dark:bg-bg-secondary dark:text-text-tertiary"
                }`}>
                  {trendInfo.overallTrend === "rising" ? "성장세" : trendInfo.overallTrend === "falling" ? "하락세" : trendInfo.overallTrend === "volatile" ? "변동" : "안정"}
                  {trendInfo.anomalies.length > 0 && ` · 이상 ${trendInfo.anomalies.length}`}
                </span>
              )}
            </div>
            <RC width="100%" height={180}>
              <LineChart data={growthLineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary, #f0f0f0)" />
                <XAxis dataKey="학년" tick={{ fontSize: 10 }} />
                <YAxis domain={[yMin, 5]} tick={{ fontSize: 10 }} tickCount={6 - yMin} />
                <TT contentStyle={{ fontSize: 11 }} />
                <LG wrapperStyle={{ fontSize: 9 }} iconSize={8} />
                {growthLines.map((label) => (
                  <Line
                    key={label}
                    type="monotone"
                    dataKey={label}
                    stroke={AREA_COLORS_LINE[label] ?? "#6b7280"}
                    strokeWidth={2}
                    strokeDasharray={
                      label === COMPETENCY_AREA_LABELS.career ? "6,3"
                        : label === COMPETENCY_AREA_LABELS.community ? "2,3"
                        : undefined
                    }
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </RC>
            {trendInfo && trendInfo.anomalies.length > 0 && (
              <div className="mt-2 space-y-1">
                {trendInfo.anomalies.map((a, i) => (
                  <p key={i} className="text-3xs text-amber-600 dark:text-amber-400">
                    ⚠ {a.competencyName}: {a.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* 학기별 역량 Heatmap */}
      {heatmapData && (
        <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
          <SemesterHeatmap data={heatmapData} designGrades={designGrades} />
        </div>
      )}

      {/* 학기별 품질 Box Plot */}
      {qualityBoxData.boxes && qualityBoxData.boxes.length >= 2 && (
        <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
          <QualityBoxPlot boxes={qualityBoxData.boxes} axisTrends={qualityBoxData.axisTrends} designGrades={designGrades} />
        </div>
      )}
    </>
  );
}
