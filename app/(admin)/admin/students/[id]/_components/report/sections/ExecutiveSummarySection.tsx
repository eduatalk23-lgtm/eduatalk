"use client";

import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import type { InternalAnalysis } from "@/lib/scores/internalAnalysis";
import type { DiagnosisTabData } from "@/lib/domains/student-record/types";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { COMPETENCY_ITEMS } from "@/lib/domains/student-record/constants";

const GRADE_TO_NUM: Record<string, number> = { "A+": 5, "A-": 4, "B+": 3, "B": 2, "B-": 1, "C": 0 };

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
}: Props) {
  const { totalGpa, adjustedGpa, zIndex } = internalAnalysis;
  const primaryGpa = totalGpa ?? adjustedGpa;
  const verdict = getVerdict(primaryGpa);

  const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
  const strengths = (diagnosis?.strengths as string[] | null) ?? [];
  const weaknesses = (diagnosis?.weaknesses as string[] | null) ?? [];
  const strategies = diagnosisData.strategies ?? [];
  const overallGrade = diagnosis?.overall_grade ?? null;
  const directionStrength = diagnosis?.direction_strength ?? null;
  const courseScore = diagnosisData.courseAdequacy?.score ?? null;

  // 미니 레이더 데이터
  const radarData = COMPETENCY_ITEMS.map((item) => {
    const score = diagnosisData.competencyScores.consultant.find((s) => s.competency_item === item.code)
      ?? diagnosisData.competencyScores.ai.find((s) => s.competency_item === item.code);
    return { item: item.label.slice(0, 3), 점수: score?.grade_value ? (GRADE_TO_NUM[score.grade_value] ?? 0) : 0 };
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
      <div className="mt-4 grid grid-cols-5 gap-3" style={{ minHeight: 160 }}>
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
