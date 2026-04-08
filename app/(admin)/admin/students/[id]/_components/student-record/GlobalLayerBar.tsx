"use client";

import { cn } from "@/lib/cn";
import { FileText, Search, Compass, PenLine } from "lucide-react";
import type { SetekLayerTab } from "./stages/record/SetekEditor";

const GLOBAL_TABS: { key: SetekLayerTab; label: string; icon: typeof FileText }[] = [
  { key: "neis", label: "NEIS", icon: FileText },
  { key: "draft", label: "가안", icon: PenLine },
  { key: "direction", label: "방향", icon: Compass },
  { key: "analysis", label: "분석", icon: Search },
];

interface GlobalLayerBarProps {
  activeTab: SetekLayerTab;
  onChange: (tab: SetekLayerTab) => void;
}

export function GlobalLayerBar({ activeTab, onChange }: GlobalLayerBarProps) {
  return (
    <div className="flex gap-0.5 overflow-x-auto">
      {GLOBAL_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap",
            activeTab === tab.key
              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
              : "text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-secondary)]",
          )}
        >
          <tab.icon className="h-3 w-3 shrink-0" />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
