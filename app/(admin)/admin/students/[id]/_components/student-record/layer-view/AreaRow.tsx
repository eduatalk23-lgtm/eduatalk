"use client";

import { cn } from "@/lib/cn";
import { BookOpen, Users, Book, FileText, ChevronRight } from "lucide-react";
import type { RecordArea, AreaSummary } from "./types";
import { FOCUS_RING } from "./types";

const ICONS: Record<RecordArea["type"], typeof BookOpen> = {
  setek: BookOpen,
  changche: Users,
  reading: Book,
  haengteuk: FileText,
};

interface AreaRowProps {
  area: RecordArea;
  summary: AreaSummary;
  gradePrefix?: boolean;
  onClick?: () => void;
}

export function AreaRow({ area, summary, gradePrefix, onClick }: AreaRowProps) {
  const Icon = ICONS[area.type];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick?.(); }}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        "cursor-pointer hover:bg-[var(--surface-hover)]", FOCUS_RING,
        summary.isEmpty && "opacity-60",
      )}
    >
      {/* 아이콘 */}
      <Icon className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />

      {/* 영역명 */}
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {gradePrefix ? `${area.grade}학년 ` : ""}
          {area.label}
        </span>
      </div>

      {/* 요약 텍스트 */}
      <span className="max-w-[200px] shrink-0 truncate text-xs text-[var(--text-secondary)]">
        {summary.text}
      </span>

      {/* 상태 배지 */}
      {summary.badge && (
        <span className="shrink-0 rounded bg-[var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
          {summary.badge}
        </span>
      )}

      {/* 진입 화살표 (Phase 4 연결 예정) */}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
    </div>
  );
}
