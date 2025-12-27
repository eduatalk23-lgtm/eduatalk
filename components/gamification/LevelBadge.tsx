"use client";

import { cn } from "@/lib/cn";
import { Star } from "lucide-react";

interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const SIZE_CLASSES = {
  sm: { container: "w-8 h-8 text-xs", icon: "w-3 h-3" },
  md: { container: "w-10 h-10 text-sm", icon: "w-4 h-4" },
  lg: { container: "w-14 h-14 text-lg", icon: "w-5 h-5" },
};

const getLevelColor = (level: number) => {
  if (level >= 50) return "from-violet-500 to-purple-600";
  if (level >= 40) return "from-red-500 to-rose-600";
  if (level >= 30) return "from-amber-500 to-orange-600";
  if (level >= 20) return "from-emerald-500 to-green-600";
  if (level >= 10) return "from-blue-500 to-indigo-600";
  return "from-gray-400 to-gray-500";
};

const getLevelGlow = (level: number) => {
  if (level >= 50) return "shadow-violet-500/50";
  if (level >= 40) return "shadow-red-500/50";
  if (level >= 30) return "shadow-amber-500/50";
  if (level >= 20) return "shadow-emerald-500/50";
  if (level >= 10) return "shadow-blue-500/50";
  return "";
};

export function LevelBadge({
  level,
  size = "md",
  showLabel = true,
  className,
}: LevelBadgeProps) {
  const sizeClass = SIZE_CLASSES[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br shadow-lg",
          sizeClass.container,
          getLevelColor(level),
          level >= 10 && getLevelGlow(level)
        )}
      >
        {level}

        {/* Decorative stars for high levels */}
        {level >= 20 && (
          <Star
            className={cn(
              "absolute -top-1 -right-1 text-yellow-400 fill-yellow-400",
              sizeClass.icon
            )}
          />
        )}
        {level >= 40 && (
          <Star
            className={cn(
              "absolute -bottom-1 -left-1 text-yellow-400 fill-yellow-400",
              sizeClass.icon
            )}
          />
        )}
      </div>

      {showLabel && (
        <span className="text-gray-500 text-sm">레벨</span>
      )}
    </div>
  );
}
