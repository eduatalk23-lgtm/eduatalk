import type { PerspectiveId } from "../types";

interface GuideAssignment {
  id: string;
  status: string;
  ai_recommendation_reason: string | null;
  confirmed_at: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
}

interface GuidePanelProps {
  assignments: GuideAssignment[];
  perspective: PerspectiveId;
  /** 레벨 3 상세 모드 — AI 추천 근거, 확정 일시 등 표시 */
  detailed?: boolean;
}

export function GuidePanel({ assignments, perspective, detailed }: GuidePanelProps) {
  const filtered = assignments.filter((a) => {
    switch (perspective) {
      case "ai": return a.ai_recommendation_reason != null && a.confirmed_at == null;
      case "consultant": return a.ai_recommendation_reason == null && a.confirmed_at == null;
      case "confirmed": return a.confirmed_at != null;
    }
  });

  if (filtered.length === 0) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">해당 배정 없음</p>;
  }

  return (
    <div className="space-y-2">
      {filtered.map((a) => (
        <div key={a.id} className="rounded border border-[var(--border-secondary)] p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-primary)]">
              {a.exploration_guides?.title ?? "가이드"}
            </span>
            <span className="rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
              {a.status}
            </span>
          </div>
          {a.exploration_guides?.guide_type && detailed && (
            <p className="mt-1 text-[10px] text-[var(--text-tertiary)]">
              유형: {a.exploration_guides.guide_type}
            </p>
          )}
          {detailed && perspective === "ai" && a.ai_recommendation_reason && (
            <p className="mt-1.5 rounded bg-blue-50 p-1.5 text-[10px] leading-relaxed text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              💡 {a.ai_recommendation_reason}
            </p>
          )}
          {detailed && perspective === "confirmed" && a.confirmed_at && (
            <p className="mt-1.5 text-[10px] text-[var(--text-tertiary)]">
              ✅ {new Date(a.confirmed_at).toLocaleDateString("ko-KR")} 확정
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
