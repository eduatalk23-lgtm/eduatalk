"use client";

import { cn } from "@/lib/cn";
import { LevelInfo } from "@/lib/domains/gamification/types";
import { Sparkles } from "lucide-react";

interface XPProgressBarProps {
  levelInfo: LevelInfo;
  totalXp: number;
  className?: string;
  showDetails?: boolean;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASSES = {
  sm: { bar: "h-2", text: "text-xs" },
  md: { bar: "h-3", text: "text-sm" },
  lg: { bar: "h-4", text: "text-base" },
};

export function XPProgressBar({
  levelInfo,
  totalXp,
  className,
  showDetails = true,
  size = "md",
}: XPProgressBarProps) {
  const { level, xpForCurrentLevel, xpForNextLevel, currentProgress } = levelInfo;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={cn("w-full", className)}>
      {/* Level and XP info */}
      {showDetails && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn("font-bold text-purple-600", sizeClass.text)}>
              Lv.{level}
            </span>
            <span className={cn("text-gray-500", sizeClass.text)}>
              {xpForCurrentLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP
            </span>
          </div>
          <div className="flex items-center gap-1 text-amber-500">
            <Sparkles className="w-4 h-4" />
            <span className={cn("font-medium", sizeClass.text)}>
              {totalXp.toLocaleString()} XP
            </span>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div
        className={cn(
          "w-full bg-gray-200 rounded-full overflow-hidden",
          sizeClass.bar
        )}
      >
        <div
          className="h-full bg-gradient-to-r from-purple-500 via-purple-600 to-indigo-600 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${Math.min(currentProgress, 100)}%` }}
        >
          {/* Shine animation */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>

      {/* Next level hint */}
      {showDetails && (
        <div className={cn("mt-1 text-gray-400 text-right", sizeClass.text)}>
          다음 레벨까지 {(xpForNextLevel - xpForCurrentLevel).toLocaleString()} XP
        </div>
      )}
    </div>
  );
}
