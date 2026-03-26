interface ActualPanelProps {
  record: {
    imported_content?: string | null;
    imported_at?: string | null;
    imported_content_bytes?: number | null;
  } | null;
}

export function ActualPanel({ record }: ActualPanelProps) {
  if (!record?.imported_content) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">미임포트 — NEIS 데이터 없음</p>;
  }

  const charCount = record.imported_content.length;
  const dateStr = record.imported_at
    ? new Date(record.imported_at).toLocaleDateString("ko-KR")
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary)]">
        <span>NEIS 원본 (읽기전용)</span>
        <span>{charCount}자{dateStr ? ` · ${dateStr}` : ""}</span>
      </div>
      <div className="max-h-64 overflow-y-auto rounded border border-[var(--border-secondary)] bg-[var(--surface-secondary)] p-2">
        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)]">
          {record.imported_content}
        </p>
      </div>
    </div>
  );
}
