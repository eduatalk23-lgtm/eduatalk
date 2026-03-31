"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { BADGE, CARD, TYPO, PROGRESS } from "@/lib/design-tokens/report";
import type { StudentPercentile } from "@/lib/domains/student-record/cohort/percentile";
import type { CohortBenchmark } from "@/lib/domains/student-record/cohort/benchmark";

interface Props {
  percentile: StudentPercentile | null;
  cohortStats: CohortBenchmark | null;
  targetMajor: string | null;
  coursePlans?: Array<{ subject?: { name: string } | null; plan_status: string }>;
}

/** 상위 N% 표시용 — percentile은 "내 위치" (높을수록 좋음) */
function TopPercentLabel({ p }: { p: number }) {
  const top = 100 - p;
  const cls =
    top <= 20
      ? "text-emerald-600 dark:text-emerald-400 font-bold"
      : top <= 40
        ? "text-blue-600 dark:text-blue-400 font-semibold"
        : top <= 60
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-500 dark:text-red-400";
  return <span className={cls}>상위 {top}%</span>;
}

interface PercentileBarProps {
  label: string;
  percentile: number;
  valueLabel?: string;
}

function PercentileBar({ label, percentile, valueLabel }: PercentileBarProps) {
  const displayPercent = percentile; // 높을수록 좋음 기준
  return (
    <div className="flex items-center gap-3">
      <span className={cn("w-20 shrink-0 text-right", TYPO.caption)}>{label}</span>
      <div className="flex-1">
        <div className={PROGRESS.track}>
          <div
            className={cn(PROGRESS.bar, PROGRESS.barColor(displayPercent))}
            style={{ width: `${displayPercent}%` }}
            role="progressbar"
            aria-valuenow={displayPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${label} 퍼센타일 ${displayPercent}%`}
          />
        </div>
      </div>
      <div className="w-24 shrink-0 text-right">
        <TopPercentLabel p={displayPercent} />
        {valueLabel && (
          <span className={cn("ml-1.5", TYPO.caption)}>{valueLabel}</span>
        )}
      </div>
    </div>
  );
}

export function CohortBenchmarkSection({
  percentile,
  cohortStats,
  targetMajor,
  coursePlans = [],
}: Props) {
  const cohortSize = percentile?.cohortSize ?? cohortStats?.cohortSize ?? 0;

  // 코호트 부족
  if (cohortSize < 5 || (!percentile && !cohortStats)) {
    return (
      <section className="print-avoid-break">
        <ReportSectionHeader
          icon={Users}
          title="코호트 벤치마크"
          subtitle={`동일 진로(${targetMajor ?? "미설정"}) 학생 대비 상대 위치`}
        />
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-secondary)] p-6 text-center">
          <p className={TYPO.body}>동일 진로 학생이 부족하여 벤치마크를 제공할 수 없습니다.</p>
          <p className={cn("mt-1", TYPO.caption)}>
            최소 5명 이상의 동일 진로 학생 데이터가 필요합니다.
          </p>
        </div>
      </section>
    );
  }

  // 이 학생이 수강한 과목 이름 집합
  const mySubjects = new Set(
    coursePlans.map((p) => p.subject?.name).filter(Boolean),
  );

  return (
    <section className="print-avoid-break">
      <ReportSectionHeader
        icon={Users}
        title="코호트 벤치마크"
        subtitle={`동일 진로(${targetMajor ?? "미설정"}) 학생 ${cohortSize}명 대비 상대 위치`}
      />

      <div className="mt-4 space-y-5">
        {/* 종합 퍼센타일 배너 */}
        {percentile && (
          <div className={CARD.indigo}>
            <div className="flex items-center justify-between">
              <div>
                <p className={TYPO.subsectionTitle}>종합 상위 위치</p>
                <p className={cn("mt-1", TYPO.caption)}>
                  동일 진로 {cohortSize}명 기준 · GPA 30% + 역량 60% + 품질 10%
                </p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                  상위 {100 - percentile.overallPercentile}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 퍼센타일 바 5개 */}
        {percentile && (
          <div className="space-y-2.5 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4">
            <p className={cn(TYPO.subsectionTitle, "mb-3")}>영역별 상대 위치</p>
            <PercentileBar
              label="GPA"
              percentile={percentile.gpaPercentile}
              valueLabel={cohortStats?.avgGpa != null ? `(평균 ${cohortStats.avgGpa.toFixed(2)})` : undefined}
            />
            <PercentileBar label="학업역량" percentile={percentile.academicPercentile} />
            <PercentileBar label="진로역량" percentile={percentile.careerPercentile} />
            <PercentileBar label="공동체역량" percentile={percentile.communityPercentile} />
            <PercentileBar label="콘텐츠 품질" percentile={percentile.qualityPercentile} />
          </div>
        )}

        {/* 강점 / 약점 */}
        {percentile && (percentile.strengthsVsCohort.length > 0 || percentile.weaknessesVsCohort.length > 0) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {percentile.strengthsVsCohort.length > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                <p className={cn("mb-1.5 font-semibold text-emerald-700 dark:text-emerald-400", TYPO.caption)}>
                  코호트 대비 강점
                </p>
                <ul className="space-y-1">
                  {percentile.strengthsVsCohort.map((s, i) => (
                    <li key={i} className={cn("flex items-start gap-1.5", TYPO.caption)}>
                      <span className="mt-0.5 shrink-0 text-emerald-500">+</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {percentile.weaknessesVsCohort.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                <p className={cn("mb-1.5 font-semibold text-amber-700 dark:text-amber-400", TYPO.caption)}>
                  코호트 대비 보완점
                </p>
                <ul className="space-y-1">
                  {percentile.weaknessesVsCohort.map((w, i) => (
                    <li key={i} className={cn("flex items-start gap-1.5", TYPO.caption)}>
                      <span className="mt-0.5 shrink-0 text-amber-500">!</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 인기 과목 비교 */}
        {cohortStats && cohortStats.topCourses.length > 0 && (
          <div className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4">
            <p className={cn(TYPO.subsectionTitle, "mb-3")}>
              인기 과목 이수율 (동일 진로 학생 기준)
            </p>
            <div className="flex flex-wrap gap-2">
              {cohortStats.topCourses.map((course) => {
                const isTaken = mySubjects.has(course.subjectName);
                return (
                  <div
                    key={course.subjectName}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1",
                      TYPO.label,
                      isTaken ? BADGE.emerald : BADGE.gray,
                    )}
                  >
                    <span>{course.subjectName}</span>
                    <span className="opacity-70">{Math.round(course.takeRate * 100)}%</span>
                    {isTaken && <span>✓</span>}
                  </div>
                );
              })}
            </div>
            <p className={cn("mt-2", TYPO.caption)}>
              초록 = 본인 이수, 회색 = 미이수 · 숫자는 코호트 이수율
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
