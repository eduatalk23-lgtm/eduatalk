"use client";

import { useMemo } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import type {
  DiagnosisTabData,
  RecordTabData,
} from "@/lib/domains/student-record/types";
import {
  COMPETENCY_ITEMS,
  COMPETENCY_AREA_LABELS,
} from "@/lib/domains/student-record/constants";
import { gradeToNum } from "@/lib/domains/student-record/rubric-matcher";
import {
  buildAreaRadarData,
  buildSemesterGrowthData,
  buildSemesterHeatmapData,
  buildSubjectSemesterMap,
  type SemesterRangeOptions,
} from "@/lib/domains/student-record/chart-data";
import { SemesterHeatmap } from "../../shared-charts/SemesterHeatmap";
import { Brain } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { TYPO } from "@/lib/design-tokens/report";
import { SectionActionSummary } from "./SectionActionSummary";
import {
  AreaCompetencyDetailGroup,
  AREA_COLORS,
} from "../../student-record/competency/AreaCompetencyDetail";

// 역량 항목 코드 → 레이블 빠른 조회
const COMPETENCY_ITEM_LABEL: Record<string, string> = Object.fromEntries(
  COMPETENCY_ITEMS.map((i) => [i.code, i.label]),
);

interface CompetencySectionProps {
  diagnosisData: DiagnosisTabData;
  recordDataByGrade?: Record<number, RecordTabData>;
  studentGrade?: number;
  internalScores?: Array<{ grade?: number | null; semester?: number | null; subject_id?: string | null }>;
}

export function CompetencySection({ diagnosisData, recordDataByGrade, studentGrade, internalScores }: CompetencySectionProps) {
  const { competencyScores, activityTags } = diagnosisData;
  const aiScores = competencyScores.ai;
  const consultantScores = competencyScores.consultant;
  const hasAnyData = aiScores.length > 0 || consultantScores.length > 0;

  // 영역별 평균 (도넛용)
  const areaSections = useMemo(
    () => buildAreaRadarData(aiScores, consultantScores),
    [aiScores, consultantScores],
  );

  const donutData = useMemo(
    () =>
      areaSections.map((sec) => ({
        name: sec.label,
        value: sec.avgScore,
        color: AREA_COLORS[sec.area],
      })),
    [areaSections],
  );

  // 내신 성적 기반 학기 보정 + 수시 범위 제한
  const subjectSemesterMap = useMemo(
    () => internalScores ? buildSubjectSemesterMap(internalScores) : undefined,
    [internalScores],
  );
  const rangeOptions: SemesterRangeOptions | undefined = useMemo(
    () => studentGrade ? { maxSemester: { grade: studentGrade, semester: 1 }, subjectSemesterMap } : undefined,
    [studentGrade, subjectSemesterMap],
  );

  // 학기별 성장 추이 (LineChart용)
  const { data: semesterGrowthData } = useMemo(
    () =>
      recordDataByGrade
        ? buildSemesterGrowthData(activityTags, recordDataByGrade, rangeOptions)
        : { data: null, annotations: null },
    [activityTags, recordDataByGrade, rangeOptions],
  );

  const growthLines = useMemo(() => {
    if (!semesterGrowthData || semesterGrowthData.length < 2) return [];
    return (["academic", "career", "community"] as const)
      .map((area) => ({
        label: COMPETENCY_AREA_LABELS[area],
        color: AREA_COLORS[area],
      }))
      .filter((line) => semesterGrowthData.some((d) => line.label in d));
  }, [semesterGrowthData]);

  const hasGrowthChart = !!semesterGrowthData && semesterGrowthData.length >= 2 && growthLines.length > 0;

  const yMin = useMemo(() => {
    if (!semesterGrowthData) return 0;
    let min = 5;
    for (const d of semesterGrowthData) {
      for (const [k, v] of Object.entries(d)) {
        if (k !== "학기" && typeof v === "number" && v < min) min = v;
      }
    }
    return Math.max(0, Math.floor(min) - 1);
  }, [semesterGrowthData]);

  // 학기별 역량 Heatmap
  const heatmapData = useMemo(
    () => recordDataByGrade
      ? buildSemesterHeatmapData(activityTags, recordDataByGrade, rangeOptions)
      : null,
    [activityTags, recordDataByGrade, rangeOptions],
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

  return (
    <section className="print-break-before">
      <ReportSectionHeader
        icon={Brain}
        title="역량 분석"
        subtitle="3개 영역 · 총평 · 루브릭 질문별 근거"
      />

      {!hasAnyData ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>역량 평가 데이터가 입력되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>
            AI 역량 분석을 실행하면 레이더 차트와 영역별 상세 분석이 생성됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          {/* Tier 0: 영역별 평균 도넛 + 학기별 성장 추이 */}
          <div
            className={cn(
              "grid grid-cols-1 gap-4 print-avoid-break",
              hasGrowthChart && "md:grid-cols-2",
            )}
          >
            {/* 도넛 */}
            <div>
              <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>
                영역별 평균
              </h3>
              <ResponsiveContainer width="100%" height={220} minHeight={180}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }: { name?: string; value: number }) =>
                      `${name ?? ""} ${value}`
                    }
                    labelLine={false}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-3">
                {donutData.map((d) => (
                  <span key={d.name} className={cn("flex items-center gap-1", TYPO.caption)}>
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>

            {/* 학기별 역량 성장 추이 LineChart */}
            {hasGrowthChart && (
              <div>
                <h3 className={cn("mb-1 text-center font-semibold", TYPO.caption)}>
                  학기별 역량 성장 추이
                </h3>
                <ResponsiveContainer width="100%" height={220} minHeight={180}>
                  <LineChart
                    data={semesterGrowthData ?? []}
                    margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary, #f0f0f0)" />
                    <XAxis
                      dataKey="학기"
                      tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
                        const isDesign = designGrades.includes(Number(payload.value.split("-")[0]));
                        return (
                          <text x={x} y={y + 12} textAnchor="middle" fontSize={10}
                            fill={isDesign ? "#3b82f6" : "var(--text-secondary, #6b7280)"}>
                            {payload.value}{isDesign ? "*" : ""}
                          </text>
                        );
                      }}
                    />
                    <YAxis domain={[yMin, 5]} tick={{ fontSize: 10 }} tickCount={6 - yMin} />
                    <Tooltip
                      contentStyle={{ fontSize: 11 }}
                      formatter={(value: number) => [value.toFixed(1), ""]}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} iconSize={8} />
                    {growthLines.map((line) => (
                      <Line
                        key={line.label}
                        type="monotone"
                        dataKey={line.label}
                        stroke={line.color}
                        strokeWidth={2.5}
                        strokeDasharray={
                          line.label === COMPETENCY_AREA_LABELS.career ? "6,3"
                            : line.label === COMPETENCY_AREA_LABELS.community ? "2,3"
                            : undefined
                        }
                        dot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* 학기별 역량 Heatmap (10항목 상세) */}
          {heatmapData && <SemesterHeatmap data={heatmapData} designGrades={designGrades} />}

          {/* Tier 1: 영역별 상세 패널 (3개, 상시 노출) */}
          <AreaCompetencyDetailGroup
            aiScores={aiScores}
            consultantScores={consultantScores}
            activityTags={activityTags}
          />

          {/* 가장 낮은 역량 기반 다음 단계 */}
          {(() => {
            const scores = [...(consultantScores.length > 0 ? consultantScores : aiScores)];
            const weakCompetencies = scores
              .filter((s) => s.grade_value)
              .sort(
                (a, b) =>
                  gradeToNum(a.grade_value ?? "") - gradeToNum(b.grade_value ?? ""),
              )
              .slice(0, 2)
              .map((c) => {
                const itemLabel = COMPETENCY_ITEM_LABEL[c.competency_item] ?? c.competency_item;
                const areaLabel =
                  COMPETENCY_AREA_LABELS[
                    c.competency_area as keyof typeof COMPETENCY_AREA_LABELS
                  ] ?? "";
                return `${areaLabel ? `[${areaLabel}] ` : ""}${itemLabel}(현재 ${
                  c.grade_value ?? "-"
                }등급) → 관련 활동 기록에서 구체적 사례를 추가하세요`;
              });
            return weakCompetencies.length > 0 ? (
              <SectionActionSummary actions={weakCompetencies} />
            ) : null;
          })()}
        </div>
      )}
    </section>
  );
}
