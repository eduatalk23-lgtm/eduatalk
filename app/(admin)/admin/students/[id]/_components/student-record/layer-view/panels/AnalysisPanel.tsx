import type { PerspectiveId } from "../types";

interface ActivityTag {
  record_type: string;
  record_id: string;
  competency_item?: string;
  evaluation?: string;
  evidence_summary?: string;
  source?: string;
  status?: string;
}

interface AnalysisPanelProps {
  tags: ActivityTag[];
  perspective: PerspectiveId;
  /** 레벨 3 상세 모드 — 근거 요약 표시 */
  detailed?: boolean;
}

const EVAL_COLORS: Record<string, string> = {
  positive: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  negative: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  needs_review: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function AnalysisPanel({ tags, perspective, detailed }: AnalysisPanelProps) {
  const filtered = tags.filter((t) => {
    switch (perspective) {
      case "ai": return t.source === "ai";
      case "consultant": return t.source === "manual";
      case "confirmed": return t.status === "confirmed";
    }
  });

  if (filtered.length === 0) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">해당 태그 없음</p>;
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-[var(--text-tertiary)]">{filtered.length}개 태그</p>
      {filtered.map((t, i) => (
        <div key={i} className="rounded border border-[var(--border-secondary)] px-2 py-1.5">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${EVAL_COLORS[t.evaluation ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
              {t.evaluation ?? "—"}
            </span>
            <span className="text-xs text-[var(--text-primary)]">{t.competency_item}</span>
          </div>
          {detailed && t.evidence_summary && (
            <p className="mt-1 pl-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {t.evidence_summary}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
