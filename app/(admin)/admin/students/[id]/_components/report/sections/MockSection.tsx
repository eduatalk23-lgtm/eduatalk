import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { GraduationCap } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";

interface MockSectionProps {
  mockAnalysis: MockAnalysis;
}

export function MockSection({ mockAnalysis }: MockSectionProps) {
  const { recentExam, avgPercentile, totalStdScore, best3GradeSum } = mockAnalysis;
  const hasData = recentExam || avgPercentile != null || totalStdScore != null;

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={GraduationCap} title="모의고사 분석" subtitle="백분위 · 표준점수 · 등급합" />

      {!hasData ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <p className="text-sm text-gray-500">모의고사 데이터가 입력되지 않았습니다.</p>
          <p className="mt-1 text-xs text-gray-500">모의고사 성적을 입력하면 분석이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {recentExam && (
            <p className="report-caption">
              기준 시험: <span className="font-semibold text-gray-700">{recentExam.examTitle}</span> ({recentExam.examDate})
            </p>
          )}

          {/* 핵심 지표 3카드 */}
          <div className="grid grid-cols-3 gap-4 print-avoid-break">
            <MetricBox
              label="평균 백분위"
              value={avgPercentile != null ? `${avgPercentile.toFixed(1)}%` : "-"}
              sub="국/수/탐(상위2)"
              color={avgPercentile != null ? (avgPercentile >= 90 ? "text-indigo-700" : avgPercentile >= 80 ? "text-indigo-600" : "text-gray-900") : undefined}
            />
            <MetricBox
              label="표준점수 합"
              value={totalStdScore != null ? String(totalStdScore) : "-"}
              sub="국/수/탐(상위2)"
            />
            <MetricBox
              label="상위 3과목 등급합"
              value={best3GradeSum != null ? String(best3GradeSum) : "-"}
              sub="국·수·영·탐 중"
              color={best3GradeSum != null ? (best3GradeSum <= 4 ? "text-emerald-700" : best3GradeSum <= 6 ? "text-amber-600" : "text-red-600") : undefined}
            />
          </div>

          {/* 등급합 해석 가이드 */}
          {best3GradeSum != null && (
            <div className="rounded-lg border border-gray-200 px-4 py-3 print-avoid-break">
              <p className="report-caption font-semibold mb-2">등급합 기준 배치 가이드</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className={`rounded py-1.5 ${best3GradeSum <= 4 ? "bg-emerald-100 font-bold text-emerald-800" : "bg-gray-50 text-gray-500"}`}>
                  3~4 최상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 5 && best3GradeSum <= 6 ? "bg-indigo-100 font-bold text-indigo-800" : "bg-gray-50 text-gray-500"}`}>
                  5~6 상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 7 && best3GradeSum <= 9 ? "bg-amber-100 font-bold text-amber-800" : "bg-gray-50 text-gray-500"}`}>
                  7~9 중상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 10 ? "bg-red-100 font-bold text-red-800" : "bg-gray-50 text-gray-500"}`}>
                  10+ 중위 이하
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function MetricBox({ label, value, sub, color }: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="border-l-4 border-l-indigo-500 bg-white py-3 pl-4 pr-3">
      <p className="report-caption">{label}</p>
      <p className={`report-metric mt-1 text-2xl ${color ?? "text-gray-900"}`}>{value}</p>
      <p className="report-caption mt-1">{sub}</p>
    </div>
  );
}
