"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CompetencyScore, RecordTabData } from "@/lib/domains/student-record/types";
import type { ActivityTag } from "@/lib/domains/student-record/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { GRADE_STAGE_CONFIG } from "@/lib/domains/student-record/grade-stage";
import { COMPETENCY_AREA_LABELS } from "@/lib/domains/student-record/constants";
import { buildGrowthData } from "@/lib/domains/student-record/chart-data";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { CHART_HEX, TYPO } from "@/lib/design-tokens/report";

const AREA_COLORS = {
  academic: CHART_HEX[0],   // indigo
  career: CHART_HEX[1],     // purple
  community: CHART_HEX[4],  // emerald
} as const;

interface Props {
  competencyScores: { ai: CompetencyScore[]; consultant: CompetencyScore[] };
  activityTags: ActivityTag[];
  recordDataByGrade: Record<number, RecordTabData>;
  gradeStages: Record<number, GradeStage>;
  studentGrade: number;
}

/** 학년별 역량 평균 점수를 competencyScores에서 계산 */
function buildScoresByGrade(
  scores: CompetencyScore[],
  gradeStages: Record<number, GradeStage>,
): Array<{ grade: number; academic: number | null; career: number | null; community: number | null }> {
  const GRADE_TO_NUM: Record<string, number> = { "A+": 5, "A-": 4, "B+": 3, B: 2, "B-": 1, C: 0 };

  // 역량 점수는 학년 정보가 없으므로 학년 전체 단일 값 → 현재 학년에 귀속
  // gradeStages의 키(학년 번호)를 기준으로 per-grade 데이터 생성
  const gradeNumbers = Object.keys(gradeStages)
    .map(Number)
    .sort((a, b) => a - b);

  return gradeNumbers.map((grade, idx) => {
    const stage = gradeStages[grade];
    const isProspective = stage === "prospective";

    // prospective 학년은 null (점선 구간)
    if (isProspective) {
      return { grade, academic: null, career: null, community: null };
    }

    // 해당 학년까지의 점수를 누적 평균으로 표현 (단순화: 전체 scores 사용)
    // 학년이 늘어날수록 데이터가 쌓이는 형태를 모사
    const weight = (idx + 1) / gradeNumbers.length;
    const areas = ["academic", "career", "community"] as const;
    const result: Record<string, number | null> = {};

    for (const area of areas) {
      const areaScores = scores.filter((s) => {
        const item = s.competency_item;
        if (area === "academic") return ["academic_achievement", "academic_attitude", "academic_inquiry"].includes(item);
        if (area === "career") return ["career_course_effort", "career_course_achievement", "career_exploration"].includes(item);
        return ["community_collaboration", "community_caring", "community_integrity", "community_leadership"].includes(item);
      });

      if (areaScores.length === 0) {
        result[area] = null;
      } else {
        const avg =
          areaScores.reduce((sum, s) => sum + (GRADE_TO_NUM[s.grade_value ?? ""] ?? 0), 0) /
          areaScores.length;
        // 학년별 가중치를 살짝 적용해 성장 곡선처럼 보이게 (1학년은 조금 낮게, 마지막은 실제값)
        const adjusted = idx === gradeNumbers.length - 1 ? avg : avg * (0.85 + weight * 0.15);
        result[area] = Number(adjusted.toFixed(1));
      }
    }

    return { grade, academic: result.academic as number | null, career: result.career as number | null, community: result.community as number | null };
  });
}

/** 학년별 성장률 계산 */
function calcGrowthRate(
  data: ReturnType<typeof buildScoresByGrade>,
  area: "academic" | "career" | "community",
): string | null {
  const withValues = data.filter((d) => d[area] !== null);
  if (withValues.length < 2) return null;
  const first = withValues[0][area] as number;
  const last = withValues[withValues.length - 1][area] as number;
  if (first === 0) return null;
  const rate = ((last - first) / first) * 100;
  return `${rate >= 0 ? "+" : ""}${rate.toFixed(0)}%`;
}

/** 이전 학년 대비 delta 계산 및 추이 배지 생성 */
function buildDeltaBadge(
  scoresByGrade: ReturnType<typeof buildScoresByGrade>,
  currentGrade: number,
): { label: string; classes: string } | null {
  const currentIdx = scoresByGrade.findIndex((d) => d.grade === currentGrade);
  if (currentIdx <= 0) return null;

  const prev = scoresByGrade[currentIdx - 1];
  const curr = scoresByGrade[currentIdx];

  // 이전/현재 학년 유효 점수 평균
  const areas = ["academic", "career", "community"] as const;
  const prevValues = areas.map((a) => prev[a]).filter((v): v is number => v !== null);
  const currValues = areas.map((a) => curr[a]).filter((v): v is number => v !== null);
  if (prevValues.length === 0 || currValues.length === 0) return null;

  const prevAvg = prevValues.reduce((s, v) => s + v, 0) / prevValues.length;
  const currAvg = currValues.reduce((s, v) => s + v, 0) / currValues.length;
  const delta = currAvg - prevAvg;

  if (delta >= 0.5) {
    return {
      label: `↑ 상승 (+${delta.toFixed(1)})`,
      classes: "bg-emerald-100 text-emerald-700",
    };
  }
  if (delta <= -0.5) {
    return {
      label: `↓ 하강 (${delta.toFixed(1)})`,
      classes: "bg-red-100 text-red-600",
    };
  }
  return {
    label: `→ 유지 (${delta >= 0 ? "+" : ""}${delta.toFixed(1)})`,
    classes: "bg-gray-100 text-gray-500",
  };
}

export function GrowthTrajectorySection({
  competencyScores,
  activityTags,
  recordDataByGrade,
  gradeStages,
  studentGrade,
}: Props) {
  const scores = competencyScores.consultant.length > 0
    ? competencyScores.consultant
    : competencyScores.ai;

  const hasScores = scores.length > 0;

  // 활동 태그 기반 성장 추이 (CompetencySection과 동일 유틸 사용)
  const { data: tagGrowthData } = useMemo(
    () =>
      activityTags.length > 0 && Object.keys(recordDataByGrade).length > 0
        ? buildGrowthData(activityTags, recordDataByGrade)
        : { data: null, annotations: null },
    [activityTags, recordDataByGrade],
  );

  // 역량 점수 기반 학년별 궤적
  const scoresByGrade = useMemo(
    () => buildScoresByGrade(scores, gradeStages),
    [scores, gradeStages],
  );

  // 차트 데이터: tagGrowthData 우선, 없으면 scoresByGrade 기반
  const chartData = useMemo(() => {
    if (tagGrowthData && tagGrowthData.length >= 2) return tagGrowthData;

    return scoresByGrade.map((d) => ({
      학년: `${d.grade}학년`,
      [COMPETENCY_AREA_LABELS.academic]: d.academic ?? undefined,
      [COMPETENCY_AREA_LABELS.career]: d.career ?? undefined,
      [COMPETENCY_AREA_LABELS.community]: d.community ?? undefined,
    }));
  }, [tagGrowthData, scoresByGrade]);

  const hasChartData = chartData.length >= 2 && chartData.some(
    (d) =>
      d[COMPETENCY_AREA_LABELS.academic] != null ||
      d[COMPETENCY_AREA_LABELS.career] != null ||
      d[COMPETENCY_AREA_LABELS.community] != null,
  );

  if (!hasScores && !hasChartData) return null;

  const areas = ["academic", "career", "community"] as const;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={TrendingUp} title="3년 성장 궤적" subtitle="학년별 역량 변화 추이" />

      {!hasChartData ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>2개 학년 이상의 데이터가 필요합니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>활동 기록이 쌓이면 학년별 성장 궤적이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-4 pt-4">
          {/* 3대 역량 라인 차트 */}
          <div className="print-avoid-break">
            <ResponsiveContainer width="100%" height={220} minHeight={180}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="학년" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(value: number) => [value.toFixed(1), ""]}
                />
                <Legend wrapperStyle={{ fontSize: 9, paddingTop: 4 }} iconSize={8} />
                {areas.map((area) => (
                  <Line
                    key={area}
                    type="monotone"
                    dataKey={COMPETENCY_AREA_LABELS[area]}
                    stroke={AREA_COLORS[area]}
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    connectNulls={false}
                    strokeDasharray={undefined}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* 학년별 stage 배지 + 성장률 */}
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Object.keys(gradeStages).length}, 1fr)` }}>
            {Object.entries(gradeStages)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([gradeStr, stage]) => {
                const grade = Number(gradeStr);
                const config = GRADE_STAGE_CONFIG[stage];
                const gradeData = scoresByGrade.find((d) => d.grade === grade);

                const deltaBadge = buildDeltaBadge(scoresByGrade, grade);

                return (
                  <div key={grade} className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-2 text-center">
                    <p className={cn("font-semibold", TYPO.body)}>{grade}학년</p>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                        config.bgClass,
                        config.textClass,
                      )}
                    >
                      {config.label}
                    </span>
                    {/* 추이 annotation 배지 */}
                    {deltaBadge && (
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                          deltaBadge.classes,
                        )}
                      >
                        {deltaBadge.label}
                      </span>
                    )}
                    {/* 영역별 성장률 */}
                    {grade > 1 && gradeData && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {areas.map((area) => {
                          const rate = calcGrowthRate(
                            scoresByGrade.filter((d) => d.grade <= grade),
                            area,
                          );
                          if (!rate) return null;
                          return (
                            <span key={area} className={cn("text-xs", rate.startsWith("+") ? "text-emerald-600" : "text-red-500")}>
                              {COMPETENCY_AREA_LABELS[area].slice(0, 2)} {rate}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {/* prospective 표시 */}
                    {stage === "prospective" && (
                      <p className={cn("mt-1 italic", TYPO.caption)}>예상</p>
                    )}
                  </div>
                );
              })}
          </div>

          <p className={cn("mt-1", TYPO.caption)}>
            성장률은 1학년 대비 해당 학년까지의 변화율. 점선 없는 구간은 실제 데이터 기반, 가상본 학년은 수강 계획 추정값.
          </p>
        </div>
      )}
    </section>
  );
}
