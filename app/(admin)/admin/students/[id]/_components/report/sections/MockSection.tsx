import { cn } from "@/lib/cn";
import type { MockAnalysis } from "@/lib/scores/mockAnalysis";
import { GraduationCap } from "lucide-react";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { TABLE, TYPO } from "@/lib/design-tokens/report";

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
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>모의고사 데이터가 입력되지 않았습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>모의고사 성적을 입력하면 분석이 표시됩니다.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {recentExam && (
            <p className={TYPO.caption}>
              기준 시험: <span className={cn("font-semibold", TYPO.body)}>{recentExam.examTitle}</span> ({recentExam.examDate})
            </p>
          )}

          {/* 핵심 지표 3카드 */}
          <div className="grid grid-cols-3 gap-4 print-avoid-break">
            <MetricBox
              label="평균 백분위"
              value={avgPercentile != null ? `${avgPercentile.toFixed(1)}%` : "-"}
              sub="국/수/탐(상위2)"
              color={avgPercentile != null ? (avgPercentile >= 90 ? "text-indigo-700 dark:text-indigo-400" : avgPercentile >= 80 ? "text-indigo-600 dark:text-indigo-500" : undefined) : undefined}
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
              color={best3GradeSum != null ? (best3GradeSum <= 4 ? "text-emerald-700 dark:text-emerald-400" : best3GradeSum <= 6 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400") : undefined}
            />
          </div>

          {/* 등급합 해석 가이드 */}
          {best3GradeSum != null && (
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-4 py-3 print-avoid-break">
              <p className={cn("font-semibold mb-2", TYPO.caption)}>등급합 기준 배치 가이드</p>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className={`rounded py-1.5 ${best3GradeSum <= 4 ? "bg-emerald-100 font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)]"}`}>
                  3~4 최상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 5 && best3GradeSum <= 6 ? "bg-indigo-100 font-bold text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)]"}`}>
                  5~6 상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 7 && best3GradeSum <= 9 ? "bg-amber-100 font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)]"}`}>
                  7~9 중상위
                </div>
                <div className={`rounded py-1.5 ${best3GradeSum >= 10 ? "bg-red-100 font-bold text-red-800 dark:bg-red-900/30 dark:text-red-300" : "bg-[var(--surface-secondary)] text-[var(--text-tertiary)]"}`}>
                  10+ 중위 이하
                </div>
              </div>
            </div>
          )}

          {/* 시험별 추이 */}
          {mockAnalysis.trend.length > 1 && (
            <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] print-avoid-break">
              <p className={cn("font-semibold px-4 pt-3 pb-2", TYPO.caption)}>시험별 추이</p>
              <table className={cn(TABLE.wrapper, "text-xs")}>
                <thead className={TABLE.thead}>
                  <tr>
                    <th className={cn(TABLE.th, "px-4 py-2")}>시험</th>
                    <th className={cn(TABLE.th, "px-4 py-2 text-right")}>평균 백분위</th>
                    <th className={cn(TABLE.th, "px-4 py-2 text-right")}>표준점수 합</th>
                    <th className={cn(TABLE.th, "px-4 py-2 text-right")}>등급합</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {mockAnalysis.trend.map((snap, i) => (
                    <tr key={snap.examDate + snap.examTitle} className={i === 0 ? "bg-indigo-50/50 dark:bg-indigo-950/20" : ""}>
                      <td className={cn(TABLE.td, "px-4 py-2")}>
                        {snap.examTitle} <span className={TYPO.caption}>({snap.examDate})</span>
                      </td>
                      <td className={cn(TABLE.td, "px-4 py-2 text-right font-medium")}>{snap.avgPercentile != null ? `${snap.avgPercentile.toFixed(1)}%` : "-"}</td>
                      <td className={cn(TABLE.td, "px-4 py-2 text-right font-medium")}>{snap.totalStdScore ?? "-"}</td>
                      <td className={cn(TABLE.td, "px-4 py-2 text-right font-medium")}>{snap.best3GradeSum ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
    <div className="border-l-4 border-l-indigo-500 dark:border-l-indigo-400 bg-[var(--surface-primary)] py-3 pl-4 pr-3">
      <p className={TYPO.caption}>{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", color ?? TYPO.body)}>{value}</p>
      <p className={cn("mt-1", TYPO.caption)}>{sub}</p>
    </div>
  );
}
