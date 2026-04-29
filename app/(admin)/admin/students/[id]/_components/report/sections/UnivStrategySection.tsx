import { Building2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { EmptyState } from "../EmptyState";
import { BADGE, CARD, SPACING, TYPO } from "@/lib/design-tokens/report";

interface UnivStrategy {
  university_name: string;
  admission_type: string;
  admission_name: string;
  ideal_student: string | null;
  evaluation_factors: Record<string, number> | null;
  interview_format: string | null;
  interview_details: string | null;
  min_score_criteria: string | null;
  key_tips: string[] | null;
}

interface CompetencyScoreSummary {
  area: string;
  label: string;
  grade: string;
}

interface UnivStrategySectionProps {
  strategies: UnivStrategy[];
  competencyScores?: CompetencyScoreSummary[];
}

// 역량 grade → 수치 변환
function gradeToScore(grade: string): number {
  const map: Record<string, number> = {
    "A+": 5,
    A: 4.5,
    "A-": 4,
    "B+": 3.5,
    B: 3,
    "B-": 2.5,
    "C+": 2,
    C: 1.5,
  };
  return map[grade] ?? 0;
}

// 평가 요소 키워드 → 역량 area 매핑
const EVAL_FACTOR_TO_AREA: Record<string, string> = {
  학업역량: "academic",
  진로역량: "career",
  공동체역량: "community",
  발전가능성: "academic",
  인성: "community",
  전공적합성: "career",
};

function computeFit(
  factors: Record<string, number>,
  scores: CompetencyScoreSummary[],
): number {
  const areaScoreMap = new Map<string, number[]>();
  for (const s of scores) {
    const existing = areaScoreMap.get(s.area) ?? [];
    existing.push(gradeToScore(s.grade));
    areaScoreMap.set(s.area, existing);
  }

  // 영역별 평균
  const areaAvg = new Map<string, number>();
  for (const [area, vals] of areaScoreMap) {
    areaAvg.set(area, vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const [label, weight] of Object.entries(factors)) {
    const area = EVAL_FACTOR_TO_AREA[label];
    const avg = area ? (areaAvg.get(area) ?? 0) : 0;
    weightedSum += (avg / 5) * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

function FitBadge({ fit }: { fit: number }) {
  if (fit >= 80) {
    return (
      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        적합
      </span>
    );
  }
  if (fit >= 60) {
    return (
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
        보통
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold text-red-600 dark:text-red-400">
      보완 필요
    </span>
  );
}

function StudentFitOverlay({
  factors,
  scores,
}: {
  factors: Record<string, number>;
  scores: CompetencyScoreSummary[];
}) {
  const entries = Object.entries(factors).sort((a, b) => b[1] - a[1]);
  const overallFit = computeFit(factors, scores);

  // 영역별 평균 점수 매핑
  const areaScoreMap = new Map<string, number>();
  const areaGradeMap = new Map<string, string>();
  for (const s of scores) {
    const existing = areaScoreMap.get(s.area) ?? 0;
    areaScoreMap.set(s.area, existing + gradeToScore(s.grade));
    if (!areaGradeMap.has(s.area)) areaGradeMap.set(s.area, s.grade);
  }

  return (
    <div className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-secondary)] p-3">
      <p className={cn("mb-2 font-semibold", TYPO.caption)}>학생 Fit 분석</p>

      <div className={SPACING.itemGap}>
        {entries.map(([label, pct]) => {
          const area = EVAL_FACTOR_TO_AREA[label];
          const studentGrade = area ? areaGradeMap.get(area) : null;
          const studentScore = area ? (areaScoreMap.get(area) ?? 0) : 0;
          const itemFit = pct > 0 ? Math.round((studentScore / 5) * 100) : 0;

          return (
            <div key={label} className="grid grid-cols-[5rem_1fr_auto_auto] items-center gap-2">
              <span className={TYPO.caption}>{label}</span>
              <div className="flex items-center gap-1">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary dark:bg-bg-secondary">
                  <div
                    className={`h-full rounded-full ${EVAL_FACTOR_COLORS[label] ?? "bg-gray-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn("w-8 text-right font-semibold tabular-nums", TYPO.caption)}>
                  {pct}%
                </span>
              </div>
              <span className={cn("w-12 text-center font-semibold", TYPO.caption)}>
                {studentGrade ?? "-"}
              </span>
              {itemFit >= 80 ? (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">적합</span>
              ) : itemFit >= 60 ? (
                <span className="text-xs text-amber-600 dark:text-amber-400">보통</span>
              ) : (
                <span className="text-xs text-red-500 dark:text-red-400">보완</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 종합 Fit */}
      <div className="mt-3 flex items-center gap-3 border-t border-[var(--border-primary)] pt-2">
        <span className={cn("font-semibold", TYPO.caption)}>종합 Fit</span>
        <div className="flex flex-1 items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary dark:bg-bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${
                overallFit >= 80
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : overallFit >= 60
                    ? "bg-amber-500 dark:bg-amber-400"
                    : "bg-red-500 dark:bg-red-400"
              }`}
              style={{ width: `${overallFit}%` }}
            />
          </div>
          <span className={cn("w-10 text-right font-bold tabular-nums", TYPO.caption)}>
            {overallFit}%
          </span>
        </div>
        <FitBadge fit={overallFit} />
      </div>
    </div>
  );
}

const EVAL_FACTOR_COLORS: Record<string, string> = {
  학업역량: "bg-indigo-500 dark:bg-indigo-400",
  진로역량: "bg-emerald-500 dark:bg-emerald-400",
  공동체역량: "bg-amber-500 dark:bg-amber-400",
  발전가능성: "bg-violet-500 dark:bg-violet-400",
  인성: "bg-rose-500 dark:bg-rose-400",
  전공적합성: "bg-blue-500 dark:bg-blue-400",
};

function EvalFactorChart({ factors }: { factors: Record<string, number> }) {
  const entries = Object.entries(factors).sort((a, b) => b[1] - a[1]);
  return (
    <div className={SPACING.itemGap}>
      {entries.map(([label, pct]) => (
        <div key={label} className="flex items-center gap-2">
          <span className={cn("w-20 shrink-0", TYPO.caption)}>{label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg-tertiary dark:bg-bg-secondary">
            <div
              className={`h-full rounded-full ${EVAL_FACTOR_COLORS[label] ?? "bg-gray-400 dark:bg-bg-secondary0"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className={cn("w-8 text-right font-semibold", TYPO.caption)}>{pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function UnivStrategySection({ strategies, competencyScores = [] }: UnivStrategySectionProps) {
  if (!strategies || strategies.length === 0) {
    return (
      <section className="print-break-before">
        <ReportSectionHeader icon={Building2} title="대학별 지원 전략" subtitle="전형 평가 기준 · 핵심 전략" />
        <EmptyState
          title="대학별 지원 전략이 없습니다"
          description="컨설턴트가 대학을 지정하면 평가 기준과 핵심 전략이 자동으로 표시됩니다."
        />
      </section>
    );
  }

  return (
    <section className="print-break-before">
      <ReportSectionHeader icon={Building2} title="대학별 지원 전략" subtitle="전형 평가 기준 · 핵심 전략" />

      <div className={SPACING.sectionGap}>
        {strategies.map((s, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] p-4 shadow-sm print-avoid-break"
          >
            {/* 대학명 + 전형 */}
            <div className="flex flex-wrap items-baseline gap-2 border-b border-[var(--border-primary)] pb-3">
              <h3 className="text-base font-bold text-[var(--text-primary)]">{s.university_name}</h3>
              <span className={cn("rounded px-1.5 py-0.5", TYPO.label, BADGE.indigo)}>
                {s.admission_type}
              </span>
              {s.admission_name && (
                <span className={TYPO.caption}>{s.admission_name}</span>
              )}
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {/* 평가 요소 */}
              {s.evaluation_factors && Object.keys(s.evaluation_factors).length > 0 && (
                <div>
                  <p className={cn("mb-2 font-semibold", TYPO.caption)}>평가 요소 비중</p>
                  <EvalFactorChart factors={s.evaluation_factors} />
                </div>
              )}

              {/* 학생 Fit 오버레이 */}
              {s.evaluation_factors &&
                Object.keys(s.evaluation_factors).length > 0 &&
                competencyScores.length > 0 && (
                  <StudentFitOverlay
                    factors={s.evaluation_factors}
                    scores={competencyScores}
                  />
                )}

              {/* 인재상 */}
              {s.ideal_student && (
                <div>
                  <p className={cn("mb-1 font-semibold", TYPO.caption)}>인재상</p>
                  <p className={cn("leading-relaxed", TYPO.caption)}>{s.ideal_student}</p>
                </div>
              )}
            </div>

            {/* 면접 */}
            {(s.interview_format || s.interview_details) && (
              <div className="mt-3 rounded bg-[var(--surface-secondary)] p-2.5">
                <p className={cn("mb-1 font-semibold", TYPO.caption)}>면접</p>
                {s.interview_format && (
                  <p className={TYPO.caption}>
                    <span className="font-medium">형식: </span>{s.interview_format}
                  </p>
                )}
                {s.interview_details && (
                  <p className={cn("mt-0.5", TYPO.caption)}>{s.interview_details}</p>
                )}
              </div>
            )}

            {/* 수능 최저 */}
            {s.min_score_criteria && (
              <div className={cn("mt-2 rounded px-2.5 py-1.5 border", CARD.amber)}>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">수능 최저: </span>{s.min_score_criteria}
                </p>
              </div>
            )}

            {/* 핵심 팁 */}
            {s.key_tips && s.key_tips.length > 0 && (
              <div className="mt-3">
                <p className={cn("mb-1.5 font-semibold", TYPO.caption)}>핵심 전략</p>
                <ul className="space-y-1">
                  {s.key_tips.map((tip, ti) => (
                    <li key={ti} className={cn("flex items-start gap-1.5", TYPO.caption)}>
                      <span className="mt-0.5 shrink-0 text-indigo-400 dark:text-indigo-500">·</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
