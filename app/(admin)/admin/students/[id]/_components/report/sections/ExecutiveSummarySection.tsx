"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { GRADE_STAGE_CONFIG, STAGE_COMPLETION, STAGE_ORDER } from "@/lib/domains/student-record/grade-stage";
import { cn } from "@/lib/cn";
import { BADGE, CARD, SPACING, TYPO } from "@/lib/design-tokens/report";
import type { StudentPercentile } from "@/lib/domains/student-record/cohort/percentile";
import { GRADE_TO_NUMERIC } from "@/lib/domains/student-record/cohort/benchmark";

interface Props {
  studentName: string | null;
  targetMajor: string | null;
  internalAnalysis: InternalAnalysis;
  diagnosisData: DiagnosisTabData;
  mockAnalysis: MockAnalysis;
  /** P3-3 대시보드 확장 */
  edgeCount?: number;
  storylineCount?: number;
  totalActivityCount?: number;
  /** E-3: 가이드 배정 건수 */
  guideAssignmentCount?: number;
  /** 학년별 진행 단계 */
  gradeStages?: Record<number, GradeStage>;
  /** 다음 3개월 포커스용 전략 목록 */
  strategies?: Array<{
    target_area: string;
    strategy_content: string;
    priority: string;
    status: string;
  }>;
  /** 코호트 퍼센타일 요약 */
  cohortPercentile?: StudentPercentile | null;
}

function getVerdict(gpa: number | null): { label: string; color: string; bg: string } {
  if (gpa == null) return { label: "산출 불가", color: "text-gray-500", bg: "bg-gray-50" };
  if (gpa <= 2) return { label: "최상위권", color: "text-emerald-700", bg: "bg-emerald-50" };
  if (gpa <= 3) return { label: "상위권", color: "text-blue-700", bg: "bg-blue-50" };
  if (gpa <= 4.5) return { label: "중상위권", color: "text-indigo-700", bg: "bg-indigo-50" };
  if (gpa <= 6) return { label: "중위권", color: "text-amber-700", bg: "bg-amber-50" };
  return { label: "하위권", color: "text-red-700", bg: "bg-red-50" };
}

export function ExecutiveSummarySection({
  studentName,
  targetMajor,
  internalAnalysis,
  diagnosisData,
  mockAnalysis,
  edgeCount = 0,
  storylineCount = 0,
  totalActivityCount = 0,
  guideAssignmentCount = 0,
  gradeStages,
  strategies = [],
  cohortPercentile,
}: Props) {
  const { totalGpa, adjustedGpa, zIndex } = internalAnalysis;
  const primaryGpa = totalGpa ?? adjustedGpa;
  const verdict = getVerdict(primaryGpa);

  const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
  const strengths = (diagnosis?.strengths as string[] | null) ?? [];
  const weaknesses = (diagnosis?.weaknesses as string[] | null) ?? [];
  const diagnosisStrategies = diagnosisData.strategies ?? [];
  const overallGrade = diagnosis?.overall_grade ?? null;
  const directionStrength = diagnosis?.direction_strength ?? null;
  const courseScore = diagnosisData.courseAdequacy?.score ?? null;

  // 미니 레이더 데이터
  const radarData = COMPETENCY_ITEMS.map((item) => {
    const score = diagnosisData.competencyScores.consultant.find((s) => s.competency_item === item.code)
      ?? diagnosisData.competencyScores.ai.find((s) => s.competency_item === item.code);
    return { item: item.label.slice(0, 3), 점수: score?.grade_value ? (GRADE_TO_NUMERIC[score.grade_value] ?? 0) : 0 };
  });
  const hasRadar = radarData.some((d) => d.점수 > 0);

  return (
    <section className="mb-8 print-avoid-break">
      {/* 한줄 요약 배너 */}
      <div className={`rounded-lg ${verdict.bg} px-6 py-4`}>
        <div className="flex items-baseline gap-3">
          <span className={`text-2xl font-bold ${verdict.color}`}>
            {verdict.label}
          </span>
          <span className="text-sm text-gray-600">
            {studentName ?? "학생"} · 내신 평균 {primaryGpa?.toFixed(2) ?? "-"}등급
            {targetMajor && ` · 목표 ${targetMajor}`}
          </span>
        </div>
        {diagnosis?.record_direction && (
          <p className="mt-1 text-sm text-gray-700">{diagnosis.record_direction}</p>
        )}
      </div>

      {/* 핵심 지표 4카드 + 미니 레이더 */}
      <div className="mt-4 grid min-h-[160px] grid-cols-5 gap-3">
        {/* 카드 4개 */}
        <div className="col-span-3 grid grid-cols-2 gap-3">
          <MetricCard
            label="내신 평균등급"
            value={primaryGpa?.toFixed(2) ?? "-"}
            sub={totalGpa != null ? "석차등급 기준" : adjustedGpa != null ? "조정등급 기준" : undefined}
            accent="indigo"
          />
          <MetricCard
            label="종합 역량등급"
            value={overallGrade ?? "-"}
            sub={directionStrength ? `방향 강도: ${directionStrength === "strong" ? "강" : directionStrength === "moderate" ? "중" : "약"}` : undefined}
            accent="indigo"
          />
          <MetricCard
            label="교과이수적합도"
            value={courseScore != null ? `${courseScore}점` : "-"}
            sub={courseScore != null ? `/ 100 (${diagnosisData.courseAdequacy?.majorCategory ?? ""})` : undefined}
            color={courseScore != null ? (courseScore >= 70 ? "text-emerald-600" : courseScore >= 50 ? "text-amber-600" : "text-red-600") : undefined}
            accent="emerald"
          />
          <MetricCard
            label="모평 백분위"
            value={mockAnalysis.avgPercentile != null ? `${mockAnalysis.avgPercentile.toFixed(1)}%` : "-"}
            sub={mockAnalysis.recentExam?.examTitle ?? undefined}
            accent="amber"
          />
        </div>

        {/* 미니 레이더 */}
        <div className="col-span-2">
          {hasRadar ? (
            <ResponsiveContainer width="100%" height={150}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis dataKey="item" tick={{ fontSize: 8 }} />
                <PolarRadiusAxis angle={90} domain={[0, 5]} tick={false} axisLine={false} />
                <Radar dataKey="점수" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={1.5} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-500">
              역량 분석 후 표시
            </div>
          )}
        </div>
      </div>

      {/* 다음 3개월 포커스 */}
      {(() => {
        const topWeakness = (weaknesses as string[])[0] ?? null;
        const topStrategy = strategies.find(
          (s) => s.priority === "critical" && s.status !== "done",
        )?.strategy_content ?? strategies.find((s) => s.status !== "done")?.strategy_content ?? null;
        const improvements = (diagnosis?.improvements as Array<{ priority?: string; action?: string; outcome?: string }> | null) ?? [];
        const targetOutcome =
          improvements.find((i) => i.priority === "높음" || i.priority === "critical")?.outcome ??
          improvements[0]?.outcome ??
          (topWeakness ? "해당 역량 1등급 향상" : null);

        if (!topWeakness && !topStrategy && !targetOutcome) return null;

        return (
          <div className={cn(CARD.amber, "mt-4")}>
            <div className="mb-2 flex items-center justify-between">
            <p className={cn(TYPO.subsectionTitle)}>다음 3개월 포커스</p>
            <p className={cn(TYPO.caption)}>상세 분석은 하단 "종합 결론" 참조</p>
          </div>
            <div className={SPACING.itemGap}>
              {topWeakness && (
                <div className="flex items-start gap-2">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5", TYPO.label, BADGE.red)}>약점</span>
                  <p className={TYPO.body}>{topWeakness}</p>
                </div>
              )}
              {topStrategy && (
                <div className="flex items-start gap-2">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5", TYPO.label, BADGE.blue)}>전략</span>
                  <p className={TYPO.body}>{topStrategy}</p>
                </div>
              )}
              {targetOutcome && (
                <div className="flex items-start gap-2">
                  <span className={cn("shrink-0 rounded px-1.5 py-0.5", TYPO.label, BADGE.emerald)}>목표</span>
                  <p className={TYPO.body}>{targetOutcome}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 강점/약점 한줄 */}
      {(strengths.length > 0 || weaknesses.length > 0) && (
        <div className="mt-3 flex gap-4 text-xs">
          {strengths.length > 0 && (
            <div className="flex-1">
              <span className="font-semibold text-emerald-700">강점: </span>
              <span className="text-gray-700">{strengths.slice(0, 3).join(" · ")}</span>
            </div>
          )}
          {weaknesses.length > 0 && (
            <div className="flex-1">
              <span className="font-semibold text-red-600">약점: </span>
              <span className="text-gray-700">{weaknesses.slice(0, 3).join(" · ")}</span>
            </div>
          )}
        </div>
      )}

      {/* P3-3: 2행째 보조 지표 */}
      {(edgeCount > 0 || storylineCount > 0 || totalActivityCount > 0 || strategies.length > 0) && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          <MiniMetric label="활동 연결" value={`${edgeCount}개`} />
          <MiniMetric
            label="전략 이행률"
            value={strategies.length > 0
              ? `${Math.round((strategies.filter((s) => s.status === "done" || s.status === "in_progress").length / strategies.length) * 100)}%`
              : "-"
            }
          />
          <MiniMetric label="스토리라인" value={`${storylineCount}개`} />
          <MiniMetric label="활동 총 건수" value={`${totalActivityCount}건`} />
          <MiniMetric label="배정 가이드" value={`${guideAssignmentCount}건`} />
        </div>
      )}

      {/* 코호트 퍼센타일 한 줄 */}
      {cohortPercentile && cohortPercentile.cohortSize >= 5 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-indigo-50 px-3 py-2 text-xs dark:bg-indigo-950/30">
          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
            동일 진로 {cohortPercentile.cohortSize}명 중
          </span>
          {cohortPercentile.overallPercentile != null ? (
            <span className="text-indigo-600 dark:text-indigo-400">
              종합 상위 {100 - cohortPercentile.overallPercentile}%
            </span>
          ) : (
            <span className="text-gray-400">종합 데이터 부족</span>
          )}
          <span className="text-gray-400">|</span>
          {cohortPercentile.gpaPercentile != null ? (
            <span className="text-indigo-600 dark:text-indigo-400">
              GPA 상위 {100 - cohortPercentile.gpaPercentile}%
            </span>
          ) : (
            <span className="text-gray-400">GPA 데이터 부족</span>
          )}
          <span className="text-gray-400">|</span>
          {cohortPercentile.academicPercentile != null && cohortPercentile.careerPercentile != null ? (
            <span className="text-indigo-600 dark:text-indigo-400">
              학업 상위 {100 - cohortPercentile.academicPercentile}% · 진로 상위 {100 - cohortPercentile.careerPercentile}%
            </span>
          ) : cohortPercentile.academicPercentile != null ? (
            <span className="text-indigo-600 dark:text-indigo-400">
              학업 상위 {100 - cohortPercentile.academicPercentile}%
            </span>
          ) : (
            <span className="text-gray-400">역량 데이터 부족</span>
          )}
        </div>
      )}

      {/* 학년별 진행률 대시보드 */}
      {gradeStages && Object.keys(gradeStages).length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">3년 진행 현황</p>
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">학년별 진행 현황</caption>
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-1.5 pr-4 text-left font-medium text-gray-500">학년</th>
                <th className="pb-1.5 pr-4 text-left font-medium text-gray-500">상태</th>
                <th className="pb-1.5 text-left font-medium text-gray-500">완성도</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(gradeStages)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([grade, stage]) => {
                  const config = GRADE_STAGE_CONFIG[stage];
                  const completion = STAGE_COMPLETION[stage];
                  const stageIdx = STAGE_ORDER.indexOf(stage);
                  return (
                    <tr key={grade} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-4 font-medium text-gray-800">{grade}학년</td>
                      <td className="py-1.5 pr-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.bgClass} ${config.textClass}`}>
                          {/* 단계 점 인디케이터 */}
                          <span className="flex gap-0.5">
                            {STAGE_ORDER.map((_, i) => (
                              <span
                                key={i}
                                className={`inline-block h-1 w-1 rounded-full ${i <= stageIdx ? `bg-${config.color}-500` : "bg-gray-300"}`}
                              />
                            ))}
                          </span>
                          {config.label}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-200"
                            role="progressbar"
                            aria-valuenow={completion}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${grade}학년 완성도 ${completion}%`}
                          >
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                          <span className="text-gray-500">{completion}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-gray-200 px-2 py-2 text-center">
      <p className="report-caption">{label}</p>
      <p className="report-metric mt-0.5 text-sm text-gray-800">{value}</p>
    </div>
  );
}

const METRIC_BORDER: Record<string, string> = {
  indigo: "border-l-indigo-500",
  emerald: "border-l-emerald-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
  default: "border-l-gray-300",
};

function MetricCard({ label, value, sub, color, accent }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  accent?: keyof typeof METRIC_BORDER;
}) {
  const border = METRIC_BORDER[accent ?? "default"];
  return (
    <div className={`border-l-4 ${border} bg-white py-3 pl-4 pr-3`}>
      <p className="report-caption">{label}</p>
      <p className={`report-metric mt-1 text-2xl ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="report-caption mt-1">{sub}</p>}
    </div>
  );
}
