"use client";

import { cn } from "@/lib/cn";
import { Check } from "lucide-react";
import { PERSPECTIVE_IDS, PERSPECTIVE_META, FOCUS_RING, type PerspectiveId } from "./types";

interface PerspectiveBarProps {
  selected: PerspectiveId[];
  onChange: (perspectives: PerspectiveId[]) => void;
  /** 최소 선택 개수 (기본 2) */
  min?: number;
}

export function PerspectiveBar({ selected, onChange, min = 2 }: PerspectiveBarProps) {
  function toggle(id: PerspectiveId) {
    if (selected.includes(id)) {
      if (selected.length <= min) return;
      onChange(selected.filter((p) => p !== id));
    } else {
      // PERSPECTIVE_IDS 순서 유지
      const next = PERSPECTIVE_IDS.filter((p) => selected.includes(p) || p === id);
      onChange([...next]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {PERSPECTIVE_IDS.map((id) => {
        const meta = PERSPECTIVE_META[id];
        const active = selected.includes(id);
        const locked = active && selected.length <= min;
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            aria-disabled={locked || undefined}
            onClick={() => toggle(id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", FOCUS_RING,
              active
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
              locked && "opacity-60 cursor-not-allowed",
            )}
          >
            {active && <Check className="h-3 w-3" />}
            <span>{meta.emoji}</span>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
