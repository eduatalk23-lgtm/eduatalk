"use client";

import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { CompetencyScore, RecordTabData } from "@/lib/domains/student-record/types";
import type { ActivityTag } from "@/lib/domains/student-record/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { GRADE_STAGE_CONFIG } from "@/lib/domains/student-record/grade-stage";
import { COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import {
  buildGrowthDataFromScores,
  buildSemesterHeatmapData,
  buildSemesterQualityBoxData,
  buildSubjectSemesterMap,
  buildRecordSemesterMapping,
  type ContentQualityWithSemester,
  type SemesterRangeOptions,
} from "@/lib/domains/student-record/chart-data";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { CHART_HEX, TYPO } from "@/lib/design-tokens/report";
import { SemesterHeatmap } from "../../shared-charts/SemesterHeatmap";
import { QualityBoxPlot } from "../../shared-charts/QualityBoxPlot";

const AREA_COLORS = {
  academic: CHART_HEX[0],
  career: CHART_HEX[1],
  community: CHART_HEX[4],
} as const;

interface Props {
  competencyScores: { ai: CompetencyScore[]; consultant: CompetencyScore[] };
  activityTags: ActivityTag[];
  recordDataByGrade: Record<number, RecordTabData>;
  gradeStages: Record<number, GradeStage>;
  studentGrade: number;
  contentQualityDetailed?: Array<{
    record_id: string;
    record_type: string;
    overall_score: number;
    specificity: number;
    coherence: number;
    depth: number;
    grammar: number;
    scientific_validity: number | null;
  }>;
  subjectNamesById?: Record<string, string>;
  /** 내신 성적 (과목별 학기 보정용) */
  internalScores?: Array<{ grade?: number | null; semester?: number | null; subject_id?: string | null }>;
}

export function GrowthTrajectorySection({
  competencyScores,
  activityTags,
  recordDataByGrade,
  gradeStages,
  studentGrade,
  contentQualityDetailed,
  subjectNamesById,
  internalScores,
}: Props) {
  const scores = competencyScores.consultant.length > 0
    ? competencyScores.consultant
    : competencyScores.ai;

  // 설계 모드 학년 (NEIS imported_content 없는 학년)
  const designGrades = useMemo(() => {
    return Object.entries(recordDataByGrade)
      .filter(([, rd]) => {
        const hasNeis = rd.seteks?.some((s) => s.imported_content?.trim()) ||
          rd.changche?.some((c) => c.imported_content?.trim());
        return !hasNeis;
      })
      .map(([g]) => Number(g));
  }, [recordDataByGrade]);

  // 내신 성적 기반 학기 보정 맵
  const subjectSemesterMap = useMemo(
    () => internalScores ? buildSubjectSemesterMap(internalScores) : undefined,
    [internalScores],
  );

  // 수시 범위: 마지막 학년 1학기까지 + 학기 보정
  const rangeOptions: SemesterRangeOptions = useMemo(
    () => ({ maxSemester: { grade: studentGrade, semester: 1 }, subjectSemesterMap }),
    [studentGrade, subjectSemesterMap],
  );

  // A4: competency_scores 기반 학년별 성장 추이 (activity_tags → scores 통폐합)
  const { data: growthLineData, trendInfo } = useMemo(
    () => buildGrowthDataFromScores(scores),
    [scores],
  );

  const growthLines = useMemo(() => {
    if (!growthLineData || growthLineData.length < 2) return [];
    return (["academic", "career", "community"] as const)
      .map((area) => ({ label: COMPETENCY_AREA_LABELS[area], color: AREA_COLORS[area] }))
      .filter((line) => growthLineData.some((d) => line.label in d));
  }, [growthLineData]);

  const hasLineChart = !!growthLineData && growthLineData.length >= 2 && growthLines.length > 0;

  // 학기별 역량 Heatmap
  const heatmapData = useMemo(
    () => buildSemesterHeatmapData(activityTags, recordDataByGrade, rangeOptions),
    [activityTags, recordDataByGrade, rangeOptions],
  );

  // 학기별 품질 Box Plot
  const qualityBoxData = useMemo(() => {
    if (!contentQualityDetailed || contentQualityDetailed.length === 0) return { boxes: null, axisTrends: null };
    const { recordSemesterMap: recMap } = buildRecordSemesterMapping(recordDataByGrade, subjectSemesterMap);
    // subject_id도 필요하므로 seteks에서 추가 매핑
    const subjectMap = new Map<string, string>();
    for (const tabData of Object.values(recordDataByGrade)) {
      for (const s of tabData?.seteks ?? []) subjectMap.set(s.id, s.subject_id);
    }
    const enriched: ContentQualityWithSemester[] = contentQualityDetailed
      .map((q) => {
        const info = recMap.get(q.record_id);
        if (!info) return null;
        return { ...q, grade: info.grade, semester: info.semester, subject_id: subjectMap.get(q.record_id) };
      })
      .filter((q): q is ContentQualityWithSemester => q !== null);
    return buildSemesterQualityBoxData(enriched, subjectNamesById ?? {}, rangeOptions);
  }, [contentQualityDetailed, recordDataByGrade, subjectNamesById, subjectSemesterMap, rangeOptions]);

  const hasAnyData = hasLineChart || !!heatmapData;

  // Y축 하한 동적 계산 — 데이터 최소값에서 1 빼되 0 이상
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

  if (!hasAnyData && scores.length === 0) return null;

  const areas = ["academic", "career", "community"] as const;

  // 접근성: 흑백 인쇄에서도 영역 구분 가능하도록 strokeDasharray 차등
  const LINE_DASH: Record<string, string | undefined> = {
    [COMPETENCY_AREA_LABELS.academic]: undefined,    // 실선
    [COMPETENCY_AREA_LABELS.career]: "6,3",          // 긴 점선
    [COMPETENCY_AREA_LABELS.community]: "2,3",       // 짧은 점선
  };

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={TrendingUp} title="3년 성장 궤적" subtitle="학년별 역량 변화 추이" />

      {!hasAnyData ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>2개 학년 이상의 데이터가 필요합니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>활동 기록이 쌓이면 학년별 성장 궤적이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          {/* A4: 학년별 3영역 LineChart (competency_scores 기반) */}
          {hasLineChart && (
            <div className="print-avoid-break">
              {trendInfo && (
                <p className={cn("mb-2", TYPO.caption)}>{trendInfo.summary}</p>
              )}
              <ResponsiveContainer width="100%" height={220} minHeight={180}>
                <LineChart data={growthLineData!} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary, #f0f0f0)" />
                  <XAxis dataKey="학년" tick={{ fontSize: 10 }} />
                  <YAxis domain={[yMin, 5]} tick={{ fontSize: 10 }} tickCount={6 - yMin} />
                  <Tooltip contentStyle={{ fontSize: 11 }} formatter={(value: number) => [value.toFixed(1), ""]} />
                  <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} iconSize={8} />
                  {growthLines.map((line) => (
                    <Line
                      key={line.label}
                      type="monotone"
                      dataKey={line.label}
                      stroke={line.color}
                      strokeWidth={2.5}
                      strokeDasharray={LINE_DASH[line.label]}
                      dot={{ r: 4 }}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
              {trendInfo && trendInfo.anomalies.length > 0 && (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
                  {trendInfo.anomalies.map((a, i) => (
                    <p key={i} className={cn("text-amber-700 dark:text-amber-400", TYPO.caption)}>
                      {a.competencyName}: {a.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 학년별 stage 배지 */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Object.keys(gradeStages).length}, 1fr)` }}>
            {Object.entries(gradeStages)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([gradeStr, stage]) => {
                const grade = Number(gradeStr);
                const config = GRADE_STAGE_CONFIG[stage];
                return (
                  <div key={grade} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-2 text-center">
                    <p className={cn("font-semibold", TYPO.body)}>{grade}학년</p>
                    <span className={cn("mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium", config.bgClass, config.textClass)}>
                      {config.label}
                    </span>
                    {stage === "prospective" && (
                      <p className={cn("mt-1 italic", TYPO.caption)}>예상</p>
                    )}
                  </div>
                );
              })}
          </div>

          {/* 학기별 역량 Heatmap */}
          {heatmapData && <SemesterHeatmap data={heatmapData} designGrades={designGrades} className="mt-4" />}

          {/* 학기별 품질 Box Plot */}
          {qualityBoxData.boxes && qualityBoxData.boxes.length >= 2 && (
            <QualityBoxPlot boxes={qualityBoxData.boxes} axisTrends={qualityBoxData.axisTrends} designGrades={designGrades} className="mt-4" />
          )}
        </div>
      )}
    </section>
  );
}
