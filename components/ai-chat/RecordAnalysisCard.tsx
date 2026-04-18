import { cn } from "@/lib/cn";
import type {
  AnalyzeRecordOutput,
  AnalyzeRecordStatus,
} from "@/lib/domains/ai-chat/actions/record-analysis";

type Props = {
  output: AnalyzeRecordOutput;
};

const STATUS_LABEL: Record<AnalyzeRecordStatus, string> = {
  no_analysis: "분석 전",
  running: "분석 진행 중",
  partial: "부분 완료",
  completed: "분석 완료",
};

const STATUS_TONE: Record<AnalyzeRecordStatus, string> = {
  no_analysis: "bg-zinc-100 text-zinc-700",
  running: "bg-blue-100 text-blue-700",
  partial: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export function RecordAnalysisCard({ output }: Props) {
  if (!output.ok) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <p className="text-xs font-medium text-rose-600">생기부 분석 조회 실패</p>
        <p className="mt-1">{output.reason}</p>
        {output.candidates && output.candidates.length > 0 && (
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-rose-700">
            {output.candidates.slice(0, 5).map((c) => (
              <li key={c.id}>
                · {c.name ?? "(이름 없음)"}
                {c.grade != null ? ` · ${c.grade}학년` : ""}
                {c.schoolName ? ` · ${c.schoolName}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const { studentName, status, progress, summary } = output;
  const statusLabel = STATUS_LABEL[status];

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {studentName ?? "학생"}
          </span>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[11px] font-medium",
              STATUS_TONE[status],
            )}
          >
            {statusLabel}
          </span>
        </div>
        <ProgressChips progress={progress} />
      </div>

      {summary ? (
        <div className="flex flex-col gap-2.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <div className="flex items-baseline gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span>{summary.schoolYear}학년도 종합</span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-semibold",
                overallGradeTone(summary.overallGrade),
              )}
            >
              {summary.overallGrade}
            </span>
            {summary.recordDirection && (
              <span className="truncate text-zinc-600 dark:text-zinc-300">
                · {summary.recordDirection}
              </span>
            )}
          </div>

          {summary.strengths.length > 0 && (
            <SummaryGroup title="강점" tone="positive" items={summary.strengths} />
          )}
          {summary.weaknesses.length > 0 && (
            <SummaryGroup title="보완 포인트" tone="negative" items={summary.weaknesses} />
          )}
          {summary.recommendedMajors.length > 0 && (
            <SummaryGroup
              title="추천 전공"
              tone="neutral"
              items={summary.recommendedMajors}
            />
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {status === "no_analysis"
            ? "아직 종합 진단이 생성되지 않았어요. 상세에서 분석을 시작할 수 있어요."
            : "진단 요약이 아직 DB에 없습니다. 분석이 완료되면 여기에 표시됩니다."}
        </p>
      )}
    </div>
  );
}

function ProgressChips({
  progress,
}: {
  progress: {
    completedGrades: number[];
    runningGrades: number[];
    synthesisStatus: "none" | "running" | "completed" | "other";
  };
}) {
  const parts: string[] = [];
  if (progress.completedGrades.length > 0) {
    parts.push(`완료 ${progress.completedGrades.join("·")}학년`);
  }
  if (progress.runningGrades.length > 0) {
    parts.push(`진행 ${progress.runningGrades.join("·")}학년`);
  }
  if (progress.synthesisStatus === "completed") {
    parts.push("종합 완료");
  } else if (progress.synthesisStatus === "running") {
    parts.push("종합 진행");
  }
  if (parts.length === 0) return null;
  return (
    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
      {parts.join(" · ")}
    </span>
  );
}

function SummaryGroup({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "positive" | "negative" | "neutral";
  items: string[];
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-700 dark:text-rose-400"
        : "text-zinc-700 dark:text-zinc-300";

  return (
    <div className="flex flex-col gap-1">
      <p className={cn("text-[11px] font-medium", toneClass)}>{title}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-zinc-800 dark:text-zinc-200">
        {items.map((item, i) => (
          <li key={`${i}-${item.slice(0, 12)}`} className="leading-snug">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function overallGradeTone(grade: string): string {
  if (grade.startsWith("A")) return "bg-emerald-100 text-emerald-700";
  if (grade.startsWith("B")) return "bg-blue-100 text-blue-700";
  return "bg-amber-100 text-amber-700";
}
