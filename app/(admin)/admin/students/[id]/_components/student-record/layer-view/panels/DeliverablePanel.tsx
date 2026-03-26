interface DeliverablePanelProps {
  fileCounts: Record<string, number>;
}

export function DeliverablePanel({ fileCounts }: DeliverablePanelProps) {
  const total = Object.values(fileCounts).reduce((s, c) => s + c, 0);

  if (total === 0) {
    return <p className="py-4 text-center text-xs text-[var(--text-tertiary)]">제출된 결과물 없음</p>;
  }

  return (
    <div className="space-y-2">
      {Object.entries(fileCounts).map(([assignmentId, count]) => (
        <div key={assignmentId} className="flex items-center justify-between rounded border border-[var(--border-secondary)] px-2 py-1.5">
          <span className="text-xs text-[var(--text-secondary)]">배정 {assignmentId.slice(0, 8)}…</span>
          <span className="text-xs font-medium text-[var(--text-primary)]">{count}건</span>
        </div>
      ))}
      <p className="text-[10px] text-[var(--text-tertiary)]">총 {total}건</p>
    </div>
  );
}
