import type { PerspectiveId } from "../types";

interface SetekGuide {
  subject_id: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus?: string[];
  cautions?: string | null;
  teacher_points?: string[];
}

interface DirectionPanelProps {
  guides: SetekGuide[];
  perspective: PerspectiveId;
  /** 레벨 3 상세 모드 — 전체 가이드 + 역량 포커스 표시 */
  detailed?: boolean;
}

export function DirectionPanel({ guides, perspective, detailed }: DirectionPanelProps) {
  const filtered = guides.filter((g) => {
    switch (perspective) {
      case "ai": return g.source === "ai";
      case "consultant": return g.source === "manual";
      case "confirmed": return g.status === "confirmed";
    }
  });

  if (filtered.length === 0) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">해당 방향 가이드 없음</p>;
  }

  // detailed: 전체 가이드 표시 / 기본: 첫 번째만
  const displayGuides = detailed ? filtered : [filtered[0]];

  return (
    <div className="space-y-3">
      {displayGuides.map((guide, idx) => (
        <GuideItem key={idx} guide={guide} detailed={detailed} hasMultiple={displayGuides.length > 1} />
      ))}
    </div>
  );
}

function GuideItem({
  guide,
  detailed,
  hasMultiple,
}: {
  guide: SetekGuide;
  detailed?: boolean;
  hasMultiple: boolean;
}) {
  return (
    <div className={hasMultiple ? "space-y-2 rounded border border-[var(--border-secondary)] p-2" : "space-y-2"}>
      {/* 키워드 */}
      {guide.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {guide.keywords.map((kw) => (
            <span key={kw} className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* 역량 포커스 (detailed) */}
      {detailed && guide.competency_focus && guide.competency_focus.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {guide.competency_focus.map((cf) => (
            <span key={cf} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {cf}
            </span>
          ))}
        </div>
      )}

      {/* 방향 텍스트 */}
      <div className={`overflow-y-auto rounded border border-[var(--border-secondary)] p-2 ${detailed ? "max-h-[360px]" : "max-h-48"}`}>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
          {guide.direction}
        </p>
      </div>

      {/* 주의사항 */}
      {guide.cautions && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠ {guide.cautions}
        </p>
      )}

      {/* 교사 포인트 */}
      {guide.teacher_points && guide.teacher_points.length > 0 && (
        <div>
          <p className="text-[10px] font-medium text-[var(--text-tertiary)]">교사 전달</p>
          <ul className="mt-0.5 space-y-0.5">
            {guide.teacher_points.map((tp, i) => (
              <li key={i} className="text-[10px] text-[var(--text-secondary)]">· {tp}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
