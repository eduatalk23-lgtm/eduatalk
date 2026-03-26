"use client";

import { cn } from "@/lib/cn";
import { PERSPECTIVE_IDS, PERSPECTIVE_META, FOCUS_RING, type PerspectiveId } from "./types";

interface PerspectiveFilterProps {
  selected: PerspectiveId;
  onChange: (perspective: PerspectiveId) => void;
  disabled?: boolean;
}

export function PerspectiveFilter({ selected, onChange, disabled }: PerspectiveFilterProps) {
  return (
    <div className={cn("flex items-center gap-1", disabled && "opacity-40 pointer-events-none")}>
      <span className="mr-1 text-[10px] text-[var(--text-tertiary)]">관점</span>
      {PERSPECTIVE_IDS.map((id) => {
        const meta = PERSPECTIVE_META[id];
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            disabled={disabled}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors", FOCUS_RING,
              active
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
            )}
          >
            <span>{meta.emoji}</span>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
