"use client";

import { cn } from "@/lib/cn";
import { Flame, Shield } from "lucide-react";

interface StreakDisplayProps {
  currentStreak: number;
  longestStreak: number;
  streakProtectionCount?: number;
  size?: "sm" | "md" | "lg";
  showDetails?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: { icon: "w-5 h-5", number: "text-lg", label: "text-xs" },
  md: { icon: "w-8 h-8", number: "text-2xl", label: "text-sm" },
  lg: { icon: "w-12 h-12", number: "text-4xl", label: "text-base" },
};

export function StreakDisplay({
  currentStreak,
  longestStreak,
  streakProtectionCount = 0,
  size = "md",
  showDetails = true,
  className,
}: StreakDisplayProps) {
  const sizeClass = SIZE_CLASSES[size];

  // Flame intensity based on streak length
  const getFlameIntensity = (streak: number) => {
    if (streak >= 30) return "text-red-500 animate-pulse";
    if (streak >= 14) return "text-orange-500";
    if (streak >= 7) return "text-amber-500";
    if (streak >= 3) return "text-yellow-500";
    return "text-gray-400";
  };

  const getFlameGlow = (streak: number) => {
    if (streak >= 30) return "drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]";
    if (streak >= 14) return "drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]";
    if (streak >= 7) return "drop-shadow-[0_0_6px_rgba(245,158,11,0.3)]";
    return "";
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Main streak display */}
      <div className="flex items-center gap-2">
        <div className={cn("relative", currentStreak > 0 && "animate-bounce-slow")}>
          <Flame
            className={cn(
              sizeClass.icon,
              getFlameIntensity(currentStreak),
              getFlameGlow(currentStreak),
              "transition-all duration-300"
            )}
          />
          {/* Secondary flames for long streaks */}
          {currentStreak >= 14 && (
            <>
              <Flame
                className={cn(
                  "absolute -left-1 -top-1 w-3 h-3",
                  getFlameIntensity(currentStreak),
                  "opacity-60"
                )}
              />
              <Flame
                className={cn(
                  "absolute -right-1 -top-1 w-3 h-3",
                  getFlameIntensity(currentStreak),
                  "opacity-60"
                )}
              />
            </>
          )}
        </div>
        <div className="flex flex-col">
          <span className={cn("font-bold", sizeClass.number)}>
            {currentStreak}
          </span>
          <span className={cn("text-gray-500", sizeClass.label)}>
            일 연속
          </span>
        </div>
      </div>

      {/* Details section */}
      {showDetails && (
        <div className="flex items-center gap-3 text-gray-500 border-l border-gray-200 pl-3">
          <div className="text-center">
            <div className={cn("font-semibold text-gray-700", sizeClass.label)}>
              {longestStreak}
            </div>
            <div className="text-xs text-gray-400">최장 기록</div>
          </div>

          {/* Streak protection */}
          {streakProtectionCount > 0 && (
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className={cn("font-medium text-blue-600", sizeClass.label)}>
                {streakProtectionCount}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
