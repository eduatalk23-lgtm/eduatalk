"use client";

import { cn } from "@/lib/cn";
import { Check } from "lucide-react";
import { LAYER_IDS, LAYER_META, FOCUS_RING, type LayerId } from "./types";

interface MultiLayerBarProps {
  selected: LayerId[];
  onChange: (layers: LayerId[]) => void;
  /** 최소 선택 개수 (기본 2) */
  min?: number;
}

export function MultiLayerBar({ selected, onChange, min = 2 }: MultiLayerBarProps) {
  function toggle(id: LayerId) {
    if (selected.includes(id)) {
      if (selected.length <= min) return; // 최소 제약
      onChange(selected.filter((l) => l !== id));
    } else {
      // LAYER_IDS 순서 유지
      const next = LAYER_IDS.filter((l) => selected.includes(l) || l === id);
      onChange([...next]);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {LAYER_IDS.map((id) => {
        const meta = LAYER_META[id];
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
                ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
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
