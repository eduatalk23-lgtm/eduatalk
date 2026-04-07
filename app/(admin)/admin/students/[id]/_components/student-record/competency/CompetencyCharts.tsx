"use client";

// ============================================
// 역량 레이더 차트 + 성장 추이 라인 차트
// Phase 6.1 W-2 / S-2
// ============================================

import { useMemo } from "react";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { buildRadarData } from "@/lib/domains/student-record/chart-data";
import { COMPETENCY_AREA_LABELS, COMPETENCY_ITEMS } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag } from "@/lib/domains/student-record";
import type { RecordForHighlight } from "./competency-helpers";

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
};

export function CompetencyCharts({ competencyScores, activityTags, records }: Props) {
  const radarData = useMemo(
    () =>
      buildRadarData(
        competencyScores.filter((s) => s.source === "ai"),
        competencyScores.filter((s) => s.source === "manual"),
      ),
    [competencyScores],
  );
  const hasRadarData = radarData.some((d) => d.AI > 0 || d.컨설턴트 > 0);
  const { recharts, loading: chartsLoading } = useRecharts();

  // S-2: 성장 추이 라인 차트 데이터 계산
  const { lineData, lines, AREA_COLORS_LINE } = useMemo(() => {
    const recordGradeMap: Record<number, Record<string, number>> = {};
    for (const rec of records) {
      if (!rec.grade) continue;
      for (const tag of activityTags) {
        if (tag.record_id !== rec.id) continue;
        const gradeKey = rec.grade;
        if (!recordGradeMap[gradeKey]) recordGradeMap[gradeKey] = {};
        const areaMap = recordGradeMap[gradeKey];
        const item = COMPETENCY_ITEMS.find((i) => i.code === tag.competency_item);
        if (!item) continue;
        const areaLabel = COMPETENCY_AREA_LABELS[item.area];
        if (!areaMap[`${areaLabel}_pos`]) areaMap[`${areaLabel}_pos`] = 0;
        if (!areaMap[`${areaLabel}_tot`]) areaMap[`${areaLabel}_tot`] = 0;
        areaMap[`${areaLabel}_tot`]++;
        if (tag.evaluation === "positive") areaMap[`${areaLabel}_pos`]++;
      }
    }

    const sortedGrades = Object.keys(recordGradeMap).map(Number).sort();
    const data = sortedGrades.map((g) => {
      const m = recordGradeMap[g] ?? {};
      const point: Record<string, string | number> = { 학년: `${g}학년` };
      for (const area of ["academic", "career", "community"] as const) {
        const label = COMPETENCY_AREA_LABELS[area];
        const pos = m[`${label}_pos`] ?? 0;
        const tot = m[`${label}_tot`] ?? 0;
        if (tot > 0) point[label] = Number(((pos / tot) * 5).toFixed(1));
      }
      return point;
    });

    const areaColors: Record<string, string> = {
      [COMPETENCY_AREA_LABELS.academic]: "#6366f1",
      [COMPETENCY_AREA_LABELS.career]: "#8b5cf6",
      [COMPETENCY_AREA_LABELS.community]: "#10b981",
    };

    const validLines = Object.values(COMPETENCY_AREA_LABELS).filter((label) =>
      data.some((d) => label in d),
    );

    return { lineData: data, lines: validLines, AREA_COLORS_LINE: areaColors, sortedGrades };
  }, [records, activityTags]);

  if (!hasRadarData) return null;

  return (
    <>
      {/* W-2: 역량 레이더 차트 */}
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

      {/* S-2: 역량 성장 추이 라인 차트 */}
      {!chartsLoading && recharts && lineData.length >= 2 && lines.length > 0 && (() => {
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
    </>
  );
}
