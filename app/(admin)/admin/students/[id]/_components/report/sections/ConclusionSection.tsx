import { cn } from "@/lib/cn";
import { ClipboardList } from "lucide-react";
import type { DiagnosisTabData, RoadmapItem } from "@/lib/domains/student-record/types";
import type { GradeStage } from "@/lib/domains/student-record/grade-stage";
import { GRADE_STAGE_CONFIG } from "@/lib/domains/student-record/grade-stage";
import { ReportSectionHeader } from "../ReportSectionHeader";
import { BADGE, CARD, SPACING, TYPO } from "@/lib/design-tokens/report";
import { PRIORITY_LABELS } from "../constants";

interface ConclusionSectionProps {
  diagnosisData: DiagnosisTabData;
  strategies: Array<{
    target_area: string;
    strategy_content: string;
    priority: string | null;
    status: string;
  }>;
  roadmapItems: Array<RoadmapItem>;
  gradeStages: Record<number, GradeStage>;
  studentGrade: number;
  targetMajor: string | null;
}

// 최대 3개의 "지금 해야 할 일" 추출
function buildTopActions(
  diagnosisData: DiagnosisTabData,
  strategies: ConclusionSectionProps["strategies"],
  roadmapItems: ConclusionSectionProps["roadmapItems"],
  studentGrade: number,
): Array<{ label: string; priority: string; source: string }> {
  const actions: Array<{ label: string; priority: string; source: string }> = [];

  const currentMonth = new Date().getMonth() + 1;
  const currentSemester = currentMonth >= 3 && currentMonth <= 8 ? 1 : 2;

  // 1순위: 컨설턴트 또는 AI 진단 개선사항 (높음/critical 최대 2개)
  const diagnosis = diagnosisData.consultantDiagnosis ?? diagnosisData.aiDiagnosis;
  const improvements = (diagnosis?.improvements as Array<{ priority?: string; action?: string; area?: string }> | null) ?? [];
  for (const imp of improvements) {
    if (actions.length >= 2) break;
    if ((imp.priority === "높음" || imp.priority === "critical") && imp.action) {
      actions.push({ label: imp.action, priority: "critical", source: "진단 기반" });
    }
  }

  // 2순위: critical 전략 미완료 (1개)
  if (actions.length < 3) {
    const criticalStrategy = strategies.find(
      (s) => s.priority === "critical" && s.status !== "done",
    );
    if (criticalStrategy) {
      actions.push({
        label: criticalStrategy.strategy_content,
        priority: "high",
        source: "보완 전략",
      });
    }
  }

  // 3순위: 현재 학년 in_progress 로드맵 (부족분 채우기)
  const currentItems = roadmapItems.filter(
    (r) =>
      r.grade === studentGrade &&
      (r.semester === currentSemester || r.semester === null) &&
      r.status === "in_progress",
  );
  for (const item of currentItems) {
    if (actions.length >= 3) break;
    actions.push({ label: item.plan_content, priority: "medium", source: "실행 계획" });
  }

  // 그래도 부족하면 high 전략으로 보충
  if (actions.length < 3) {
    const highStrategies = strategies.filter(
      (s) => s.priority === "high" && s.status !== "done",
    );
    for (const s of highStrategies) {
      if (actions.length >= 3) break;
      // 이미 추가된 label 중복 방지
      if (!actions.some((a) => a.label === s.strategy_content)) {
        actions.push({ label: s.strategy_content, priority: "high", source: "보완 전략" });
      }
    }
  }

  return actions.slice(0, 3);
}

const PRIORITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-amber-100 text-amber-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-bg-tertiary text-text-secondary",
};

// 학년별 진행 현황 점 표시
function GradeProgressDots({
  grade,
  stage,
}: {
  grade: number;
  stage: GradeStage | undefined;
}) {
  const stageIndex = stage
    ? ["prospective", "ai_draft", "consultant", "confirmed", "final"].indexOf(
        stage,
      )
    : -1;
  const config = stage ? GRADE_STAGE_CONFIG[stage] : null;
  const label = config?.label ?? "미시작";

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-[var(--text-primary)]">
        {grade}학년
      </span>
      <div className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "inline-block h-2 w-2 rounded-full",
              i <= stageIndex
                ? "bg-indigo-500 dark:bg-indigo-400"
                : "bg-bg-tertiary dark:bg-bg-tertiary",
            )}
          />
        ))}
      </div>
      <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
    </div>
  );
}

export function ConclusionSection({
  diagnosisData,
  strategies,
  roadmapItems,
  gradeStages,
  studentGrade,
  targetMajor,
}: ConclusionSectionProps) {
  const { aiDiagnosis, consultantDiagnosis } = diagnosisData;
  const diagnosis = consultantDiagnosis ?? aiDiagnosis;

  // 전체 평가 한 줄
  const overallLine =
    diagnosis?.record_direction ??
    (targetMajor
      ? `${targetMajor} 계열 진학을 목표로 하는 학생입니다.`
      : null);

  const topActions = buildTopActions(diagnosisData, strategies, roadmapItems, studentGrade);

  const gradeEntries = Object.entries(gradeStages)
    .map(([g, s]) => ({ grade: Number(g), stage: s }))
    .sort((a, b) => a.grade - b.grade);

  // 핵심 병목 서사: 가장 시급한 약점 + 그 개선 행동 + 예상 결과
  const improvements = (diagnosis?.improvements as Array<{ priority?: string; area?: string; action?: string; outcome?: string; gap?: string }> | null) ?? [];
  const topImprovement = improvements.find((i) => i.priority === "높음" || i.priority === "critical") ?? improvements[0] ?? null;
  const topWeakness = (diagnosis?.weaknesses as string[] | null)?.[0] ?? null;

  const bottleneckNarrative = (() => {
    if (topWeakness && topImprovement?.action) {
      const outcomeText = topImprovement.outcome ?? "전체 역량 균형이 향상될 것으로 예상됩니다";
      return `현재 가장 큰 병목은 "${topWeakness}"입니다. ${topImprovement.action}하면 ${outcomeText}.`;
    }
    if (topWeakness) {
      return `현재 가장 큰 병목은 "${topWeakness}"입니다. 이를 우선 개선하면 전체 역량 균형이 향상됩니다.`;
    }
    return diagnosis?.record_direction ?? null;
  })();

  return (
    <section className="print-break-before">
      <ReportSectionHeader
        icon={ClipboardList}
        title="종합 결론"
        subtitle="핵심 병목 + 할 일 + 전체 평가"
      />

      <div className={cn("space-y-5 pt-4")}>
        {/* 핵심 병목 서사 */}
        {bottleneckNarrative && (
          <div className={cn(CARD.amber)}>
            <p className={cn(TYPO.caption, "mb-1 font-semibold text-amber-700 dark:text-amber-300")}>
              핵심 병목 및 예상 변화
            </p>
            <p className={cn(TYPO.body, "font-semibold leading-relaxed")}>{bottleneckNarrative}</p>
          </div>
        )}

        {/* 전체 평가 */}
        {(overallLine ?? diagnosis?.overall_grade) && (
          <div className={cn(CARD.indigo)}>
            <p className={cn(TYPO.caption, "mb-1 font-semibold text-indigo-700 dark:text-indigo-300")}>
              전체 평가
            </p>
            {diagnosis?.overall_grade && (
              <p className={cn(TYPO.caption, "mb-0.5")}>
                종합 등급:{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {diagnosis.overall_grade}
                </span>
              </p>
            )}
            {overallLine && (
              <p className={cn(TYPO.body, "leading-relaxed")}>{overallLine}</p>
            )}
          </div>
        )}

        {/* 지금 해야 할 3가지 */}
        {topActions.length > 0 && (
          <div>
            <p className={cn(TYPO.subsectionTitle, "mb-2")}>
              지금 해야 할 {topActions.length}가지
            </p>
            <ol className={cn(SPACING.itemGap, "list-none")}>
              {topActions.map((action, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg border border-[var(--border-primary)] bg-[var(--surface-primary)] px-3 py-2"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {i + 1}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs font-medium",
                          PRIORITY_BADGE[action.priority] ?? BADGE.gray,
                        )}
                      >
                        {PRIORITY_LABELS[action.priority] ?? action.priority}
                      </span>
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-xs",
                          action.source === "진단 기반"
                            ? BADGE.red
                            : action.source === "보완 전략"
                              ? BADGE.blue
                              : BADGE.violet,
                        )}
                      >
                        {action.source}
                      </span>
                    </div>
                    <p className={cn(TYPO.body)}>{action.label}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* 3년 진행 현황 */}
        {gradeEntries.length > 0 && (
          <div>
            <p className={cn(TYPO.subsectionTitle, "mb-2")}>3년 진행 현황</p>
            <div className="flex flex-wrap gap-4">
              {gradeEntries.map(({ grade, stage }) => (
                <GradeProgressDots key={grade} grade={grade} stage={stage} />
              ))}
            </div>
            <p className={cn("mt-1.5", TYPO.caption)}>
              채워진 점: 가상본 / AI초안 / 검토중 / 확정 / 최종 (왼쪽부터)
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
