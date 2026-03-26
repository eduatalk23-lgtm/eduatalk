import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { LAYER_META, FOCUS_RING, type LayerId } from "./types";

interface LayerPanelProps {
  layer: LayerId;
  children: ReactNode;
  /** 헤더 클릭 → 레벨 3 진입 */
  onHeaderClick?: () => void;
}

export function LayerPanel({ layer, children, onHeaderClick }: LayerPanelProps) {
  const meta = LAYER_META[layer];

  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-[var(--border-secondary)] bg-[var(--surface-primary)]">
      {/* 헤더 */}
      <div
        className={cn(
          "flex items-center gap-1.5 border-b border-[var(--border-secondary)] px-3 py-2",
          onHeaderClick && "cursor-pointer transition-colors hover:bg-[var(--surface-hover)]",
          onHeaderClick && FOCUS_RING,
        )}
        onClick={onHeaderClick}
        role={onHeaderClick ? "button" : undefined}
        tabIndex={onHeaderClick ? 0 : undefined}
        onKeyDown={onHeaderClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onHeaderClick(); } } : undefined}
      >
        <span>{meta.emoji}</span>
        <h4 className="text-xs font-semibold text-[var(--text-primary)]">{meta.label}</h4>
        {onHeaderClick && <ChevronRight className="ml-auto h-3 w-3 text-[var(--text-tertiary)]" />}
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-y-auto p-3">
        {children}
      </div>
    </div>
  );
}
