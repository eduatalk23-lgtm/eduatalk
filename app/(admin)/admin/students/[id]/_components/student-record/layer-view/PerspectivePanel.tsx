import type { ReactNode } from "react";
import { PERSPECTIVE_META, type PerspectiveId } from "./types";

interface PerspectivePanelProps {
  perspective: PerspectiveId;
  children: ReactNode;
  /** 하단 고정 영역 (WorkflowActions 등) */
  footer?: ReactNode;
}

export function PerspectivePanel({ perspective, children, footer }: PerspectivePanelProps) {
  const meta = PERSPECTIVE_META[perspective];

  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)]">
      {/* 헤더 */}
      <div className="flex items-center gap-1.5 border-b border-[var(--border-secondary)] px-3 py-2">
        <span>{meta.emoji}</span>
        <h4 className="text-xs font-semibold text-[var(--text-primary)]">{meta.label}</h4>
      </div>

      {/* 본문 (스크롤) */}
      <div className="flex-1 overflow-y-auto p-3">
        {children}
      </div>

      {/* 하단 고정 (액션 버튼 등) */}
      {footer && (
        <div className="shrink-0 border-t border-[var(--border-secondary)] px-3 py-2">
          {footer}
        </div>
      )}
    </div>
  );
}
