"use client";

import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown, Check, Minus } from "lucide-react";
import type { LevelingResult, DifficultyLevel } from "@/lib/domains/student-record/leveling/types";
import { DIFFICULTY_LABELS } from "@/lib/domains/student-record/leveling/types";

interface LevelingCardProps {
  leveling: LevelingResult;
}

// ─── 레벨 라벨 ──────────────────────────────

function levelText(level: DifficultyLevel | null): string {
  if (level === null) return "미분석";
  return `L${level} ${DIFFICULTY_LABELS[level]}`;
}

const LEVEL_COLORS: Record<DifficultyLevel, string> = {
  1: "bg-bg-tertiary text-text-primary dark:bg-bg-secondary dark:text-text-disabled",
  2: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  3: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  4: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  5: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function LevelBadge({ level }: { level: DifficultyLevel | null }) {
  if (level === null) {
    return (
      <span className="rounded px-2 py-0.5 text-xs font-medium bg-bg-tertiary text-text-tertiary dark:bg-bg-secondary dark:text-text-tertiary">
        미분석
      </span>
    );
  }
  return (
    <span className={cn("rounded px-2 py-0.5 text-xs font-bold", LEVEL_COLORS[level])}>
      {levelText(level)}
    </span>
  );
}

// ─── 갭 인디케이터 ─────────────────────────────

function GapIndicator({ gap }: { gap: number }) {
  if (gap > 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
        <ArrowUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
          목표 대비 {gap}단계 부족
        </span>
      </div>
    );
  }
  if (gap < 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
        <ArrowDown className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          목표 대비 {Math.abs(gap)}단계 초과
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
        목표와 일치
      </span>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────

export function LevelingCard({ leveling }: LevelingCardProps) {
  const items = [
    { label: "기대 수준", sublabel: leveling.tierLabel, level: leveling.expectedLevel },
    { label: "내신 기반", sublabel: leveling.hasGpaData ? "GPA 산출" : "데이터 없음", level: leveling.adequateFromGpa },
    { label: "현재 수준", sublabel: leveling.currentLevel != null ? "분석 결과" : "미분석", level: leveling.currentLevel },
    { label: "적용 레벨", sublabel: "최종 결정", level: leveling.adequateLevel },
  ];

  return (
    <div className="space-y-3">
      {/* 학교권 배지 */}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-300">
          {leveling.tierLabel}
        </span>
        <Minus className="h-3 w-3 text-[var(--text-tertiary)]" />
        <span className="text-xs text-[var(--text-secondary)]">
          적용: {levelText(leveling.adequateLevel)}
        </span>
      </div>

      {/* 4값 그리드 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-lg border border-[var(--border-secondary)] p-3",
              item.label === "적용 레벨" && "ring-2 ring-violet-300 dark:ring-violet-700",
            )}
          >
            <p className="text-2xs font-medium text-[var(--text-secondary)]">{item.label}</p>
            <p className="text-3xs text-[var(--text-tertiary)]">{item.sublabel}</p>
            <div className="mt-1.5">
              <LevelBadge level={item.level} />
            </div>
          </div>
        ))}
      </div>

      {/* 갭 표시 */}
      <GapIndicator gap={leveling.gap} />
    </div>
  );
}
