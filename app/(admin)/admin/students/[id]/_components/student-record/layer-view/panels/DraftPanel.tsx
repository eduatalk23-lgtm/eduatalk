import type { PerspectiveId } from "../types";

interface DraftPanelProps {
  record: {
    content?: string;
    ai_draft_content?: string | null;
    ai_draft_at?: string | null;
    confirmed_content?: string | null;
    confirmed_at?: string | null;
    confirmed_by?: string | null;
    char_limit?: number;
  } | null;
  perspective: PerspectiveId;
  /** 레벨 3 상세 모드 — 생성 시각, 확정 정보 등 표시 */
  detailed?: boolean;
}

export function DraftPanel({ record, perspective, detailed }: DraftPanelProps) {
  if (!record) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">레코드 없음</p>;
  }

  let content: string | null | undefined;
  let label: string;
  let metaDate: string | null = null;

  switch (perspective) {
    case "ai":
      content = record.ai_draft_content;
      label = "AI 초안";
      if (detailed && record.ai_draft_at) {
        metaDate = new Date(record.ai_draft_at).toLocaleDateString("ko-KR");
      }
      break;
    case "consultant":
      content = record.content;
      label = "컨설턴트 가안";
      break;
    case "confirmed":
      content = record.confirmed_content;
      label = "확정본";
      if (detailed && record.confirmed_at) {
        metaDate = new Date(record.confirmed_at).toLocaleDateString("ko-KR");
      }
      break;
  }

  if (!content) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">{label} 미작성</p>;
  }

  const charCount = content.length;
  const limit = record.char_limit ?? 500;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>{label}{metaDate ? ` · ${metaDate}` : ""}</span>
        <span>{charCount}/{limit}자</span>
      </div>
      <div className={`overflow-y-auto rounded border border-[var(--border-secondary)] p-2 ${detailed ? "max-h-[480px]" : "max-h-64"}`}>
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
          {content}
        </p>
      </div>
    </div>
  );
}
