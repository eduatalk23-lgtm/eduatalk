"use client";

// ============================================
// 역량 레이더 차트 (3영역 독립) + 성장 추이 라인 차트
// Phase 6.1 W-2 / S-2 (2026-04-09 영역 중심 개편)
// ============================================

import { useMemo } from "react";
import { useRecharts, ChartLoadingSkeleton } from "@/components/charts/LazyRecharts";
import { buildAreaRadarData } from "@/lib/domains/student-record/chart-data";
import { COMPETENCY_AREA_LABELS, COMPETENCY_ITEMS } from "@/lib/domains/student-record";
import type { CompetencyScore, ActivityTag } from "@/lib/domains/student-record";
import type { RecordForHighlight } from "./competency-helpers";
import {
  AREA_COLORS,
  CompetencyAxisTick,
  type RechartsPolarTickProps,
} from "./AreaCompetencyDetail";

type Props = {
  competencyScores: CompetencyScore[];
  activityTags: ActivityTag[];
  records: RecordForHighlight[];
};

export function CompetencyCharts({ competencyScores, activityTags, records }: Props) {
  // 3영역 독립 레이더 데이터 (항목 라벨 중복으로 인한 축 병합 버그 방지)
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
      [COMPETENCY_AREA_LABELS.academic]: AREA_COLORS.academic,
      [COMPETENCY_AREA_LABELS.career]: AREA_COLORS.career,
      [COMPETENCY_AREA_LABELS.community]: AREA_COLORS.community,
    };

    const validLines = Object.values(COMPETENCY_AREA_LABELS).filter((label) =>
      data.some((d) => label in d),
    );

    return { lineData: data, lines: validLines, AREA_COLORS_LINE: areaColors };
  }, [records, activityTags]);

  if (!hasRadarData) return null;

  return (
    <>
      {/* W-2: 3영역 독립 레이더 (AI vs 컨설턴트 오버레이) */}
      <div className="rounded-lg border border-[var(--border-secondary)] bg-white p-4 dark:bg-[var(--surface-primary)]">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">역량 프로필 (3영역)</h4>
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
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
              RadarChart,
              Radar,
              PolarGrid,
              PolarAngleAxis,
              PolarRadiusAxis,
              ResponsiveContainer,
              Tooltip,
            } = recharts;
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {areaSections.map((sec) => {
                  const color = AREA_COLORS[sec.area];
                  const hasAi = sec.items.some((i) => i.AI > 0);
                  const hasCon = sec.items.some((i) => i.컨설턴트 > 0);
                  return (
                    <div
                      key={sec.area}
                      className="rounded-md border border-[var(--border-primary)] bg-[var(--surface-primary)] p-2"
                    >
                      <div className="flex items-center justify-between px-1 pb-1">
                        <span className="text-[11px] font-semibold text-[var(--text-primary)]">
                          {sec.label}
                        </span>
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: color + "20", color }}
                        >
                          {sec.items.some((i) => i.AI > 0 || i.컨설턴트 > 0)
                            ? sec.avgGrade
                            : "-"}
                        </span>
                      </div>
                      {/* 3영역 모두 동일 높이/마진으로 시각적 사이즈 통일 */}
                      <ResponsiveContainer width="100%" height={240}>
                        <RadarChart
                          data={sec.items}
                          cx="50%"
                          cy="50%"
                          outerRadius="58%"
                          margin={{ top: 12, right: 32, bottom: 12, left: 32 }}
                        >
                          <PolarGrid stroke="var(--border-secondary, #e5e7eb)" />
                          <PolarAngleAxis
                            dataKey="item"
                            tick={(tickProps: RechartsPolarTickProps) => (
                              <CompetencyAxisTick
                                {...tickProps}
                                items={sec.items}
                                color={color}
                              />
                            )}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 5]}
                            tick={false}
                            axisLine={false}
                          />
                          {hasAi && (
                            <Radar
                              name="AI"
                              dataKey="AI"
                              stroke={color}
                              fill={color}
                              fillOpacity={0.12}
                              strokeWidth={1.5}
                              strokeDasharray="5 3"
                            />
                          )}
                          {hasCon && (
                            <Radar
                              name="컨설턴트"
                              dataKey="컨설턴트"
                              stroke={color}
                              fill={color}
                              fillOpacity={0.28}
                              strokeWidth={2}
                            />
                          )}
                          <Tooltip contentStyle={{ fontSize: 11 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                      {sec.mismatchCount > 0 && (
                        <p className="pt-0.5 text-center text-[9px] text-amber-600 dark:text-amber-400">
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

      {/* S-2: 역량 성장 추이 라인 차트 */}
      {!chartsLoading && recharts && lineData.length >= 2 && lines.length > 0 && (() => {
        const {
          LineChart,
          Line,
          XAxis,
          YAxis,
          CartesianGrid,
          ResponsiveContainer: RC,
          Tooltip: TT,
          Legend: LG,
        } = recharts;
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
