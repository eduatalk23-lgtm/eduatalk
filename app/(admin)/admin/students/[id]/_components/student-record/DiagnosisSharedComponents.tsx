"use client";

import { cn } from "@/lib/cn";

// ─── Row ──

export function Row({ label, value, diff }: { label: string; value: string; diff?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <span className={cn("text-[var(--text-primary)]", diff && "font-medium text-amber-600 dark:text-amber-400")}>{value}</span>
      {diff && <span className="text-amber-500" title="AI와 차이 있음">⚡ <span className="sr-only">차이</span></span>}
    </div>
  );
}

// ─── TagList ──

export function TagList({ label, items, matchItems }: { label: string; items: string[]; matchItems?: string[] }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">{label}</span>
      <div className="flex flex-wrap gap-1">
        {items.map((s) => {
          const isMatch = matchItems?.includes(s);
          return (
            <span key={s} className={cn("rounded-full px-1.5 py-0.5 text-3xs", isMatch ? "bg-green-50 text-green-700 dark:bg-green-900/20" : "bg-bg-tertiary dark:bg-bg-tertiary")}>
              {isMatch && "✓ "}{s}
            </span>
          );
        })}
        {items.length === 0 && <span className="text-[var(--text-tertiary)]">-</span>}
      </div>
    </div>
  );
}

// ─── FormRow ──

export function FormRow({ label, children, diff }: { label: string; children: React.ReactNode; diff?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("w-16 shrink-0 pt-1 text-xs", diff ? "font-medium text-amber-600 dark:text-amber-400" : "text-[var(--text-tertiary)]")}>
        {label} {diff && <span title="AI와 차이 있음">⚡</span>}
      </span>
      {children}
    </div>
  );
}

// ─── ImprovementsList ──

const PRIORITY_COLORS: Record<string, string> = {
  "높음": "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400",
  "중간": "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400",
  "낮음": "text-text-tertiary bg-bg-secondary dark:bg-bg-secondary dark:text-text-tertiary",
};

export function ImprovementsList({ items }: { items: Array<{ priority: string; area: string; gap: string; action: string; outcome: string }> }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-[var(--text-tertiary)]">개선전략</span>
      <div className="flex flex-1 flex-col gap-1.5">
        {items.map((imp, i) => (
          <div key={i} className="rounded border border-border p-1.5 dark:border-border">
            <div className="flex items-center gap-1.5">
              <span className={cn("rounded px-1 py-0.5 text-3xs font-medium", PRIORITY_COLORS[imp.priority] ?? PRIORITY_COLORS["중간"])}>
                {imp.priority}
              </span>
              <span className="text-3xs font-medium text-[var(--text-primary)]">{imp.area}</span>
            </div>
            {imp.gap && <p className="mt-0.5 text-3xs text-[var(--text-tertiary)]">{imp.gap}</p>}
            <p className="mt-0.5 text-3xs text-blue-600 dark:text-blue-400">{imp.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
