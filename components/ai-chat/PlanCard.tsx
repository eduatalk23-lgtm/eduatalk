/**
 * Phase C-3 S3 3단계 (2026-04-21): designStudentPlan tool 출력을 위한 카드.
 *
 * read-only 우선 — Sprint 후속에서 추천 과목 채택/거절 토글, 학기 배정 편집 등이 추가됨.
 * subagent run 의 요약(summary) 만 표시. 상세 후속 질문(followUpQuestions) 도 노출.
 */

import { cn } from "@/lib/cn";
import type { DesignStudentPlanOutput } from "@/lib/mcp/tools/designStudentPlan";

type Props = {
  output: DesignStudentPlanOutput;
};

function adequacyTone(score?: number): string {
  if (score == null) return "bg-zinc-100 text-zinc-700";
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-blue-100 text-blue-700";
  if (score >= 40) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

export function PlanCard({ output }: Props) {
  if (!output.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="text-xs font-medium text-rose-600">수강 계획 설계 실패</p>
        <p className="mt-1">{output.reason}</p>
      </div>
    );
  }

  const { studentName, summary, durationMs, stepCount } = output;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            수강 계획 · {studentName ?? "학생"}
          </span>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {summary.headline}
          </p>
        </div>
        {typeof summary.adequacyScore === "number" && (
          <span
            className={cn(
              "shrink-0 rounded-md px-2 py-1 text-xs font-semibold",
              adequacyTone(summary.adequacyScore),
            )}
          >
            적합도 {summary.adequacyScore}
          </span>
        )}
      </div>

      {summary.keyFindings.length > 0 && (
        <Section title="핵심 발견" tone="neutral" items={summary.keyFindings} />
      )}
      {summary.conflicts.length > 0 && (
        <Section title="충돌" tone="negative" items={summary.conflicts} />
      )}
      {summary.recommendedCourses.length > 0 && (
        <Section
          title="추천 과목"
          tone="positive"
          items={summary.recommendedCourses}
        />
      )}
      {summary.recommendedActions.length > 0 && (
        <Section
          title="추천 액션"
          tone="positive"
          items={summary.recommendedActions}
        />
      )}
      {summary.followUpQuestions && summary.followUpQuestions.length > 0 && (
        <Section
          title="후속 질문"
          tone="neutral"
          items={summary.followUpQuestions}
        />
      )}

      <footer className="border-t border-zinc-100 pt-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        plan-sub · {stepCount} step · {(durationMs / 1000).toFixed(1)}s
      </footer>
    </div>
  );
}

function Section({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative" | "neutral";
  items: string[];
}) {
  const titleClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-700 dark:text-rose-400"
        : "text-zinc-700 dark:text-zinc-300";

  return (
    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
      <p className={cn("text-[11px] font-medium", titleClass)}>{title}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-zinc-800 dark:text-zinc-200">
        {items.map((item, i) => (
          <li key={`${i}-${item.slice(0, 16)}`} className="leading-snug">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
