import type { ReactNode } from "react";

interface AreaSectionProps {
  number: number;
  label: string;
  children: ReactNode;
}

export function AreaSection({ number: num, label, children }: AreaSectionProps) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">
        <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--surface-hover)] text-[10px] font-bold">
          {num}
        </span>
        {label}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}
