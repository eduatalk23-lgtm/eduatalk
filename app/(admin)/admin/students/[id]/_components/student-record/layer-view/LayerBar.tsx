"use client";

import { cn } from "@/lib/cn";
import { LAYER_IDS, LAYER_META, FOCUS_RING, type LayerId } from "./types";

interface LayerBarProps {
  selected: LayerId;
  onChange: (layer: LayerId) => void;
}

export function LayerBar({ selected, onChange }: LayerBarProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {LAYER_IDS.map((id) => {
        const meta = LAYER_META[id];
        const active = id === selected;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors", FOCUS_RING,
              active
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
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
