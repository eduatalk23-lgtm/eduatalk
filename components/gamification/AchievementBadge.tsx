"use client";

import * as Icons from "lucide-react";
import { cn } from "@/lib/cn";
import {
  AchievementDefinition,
  AchievementTier,
  TIER_COLORS,
  TIER_LABELS,
} from "@/lib/domains/gamification/types";

interface AchievementBadgeProps {
  achievement: AchievementDefinition;
  earned?: boolean;
  earnedAt?: string;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  sm: "w-12 h-12",
  md: "w-16 h-16",
  lg: "w-20 h-20",
};

const ICON_SIZES = {
  sm: "w-5 h-5",
  md: "w-7 h-7",
  lg: "w-9 h-9",
};

export function AchievementBadge({
  achievement,
  earned = false,
  earnedAt,
  size = "md",
  showTooltip = true,
  onClick,
}: AchievementBadgeProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const IconComponent = (Icons as any)[achievement.iconName] || Icons.Award;
  const tierColor = TIER_COLORS[achievement.tier];
  const tierLabel = TIER_LABELS[achievement.tier];

  const getBorderStyle = (tier: AchievementTier) => {
    switch (tier) {
      case "diamond":
        return "bg-gradient-to-br from-cyan-300 via-blue-400 to-purple-400";
      case "platinum":
        return "bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400";
      case "gold":
        return "bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500";
      case "silver":
        return "bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500";
      case "bronze":
      default:
        return "bg-gradient-to-br from-amber-600 via-amber-700 to-amber-800";
    }
  };

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          "relative rounded-full p-[3px] transition-all duration-300",
          getBorderStyle(achievement.tier),
          earned
            ? "opacity-100 shadow-lg hover:scale-105"
            : "opacity-40 grayscale",
          onClick && earned && "cursor-pointer",
          !onClick && "cursor-default"
        )}
      >
        <div
          className={cn(
            "rounded-full bg-white flex items-center justify-center",
            SIZE_CLASSES[size]
          )}
        >
          <IconComponent
            className={cn(ICON_SIZES[size])}
            style={{ color: earned ? tierColor : "#9CA3AF" }}
          />
        </div>

        {/* Shine effect for earned */}
        {earned && (
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/30 to-transparent pointer-events-none" />
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
          <div className="font-semibold">{achievement.name}</div>
          {achievement.description && (
            <div className="text-gray-300 mt-0.5">{achievement.description}</div>
          )}
          <div className="flex items-center gap-2 mt-1 text-gray-400">
            <span style={{ color: tierColor }}>{tierLabel}</span>
            {earned && earnedAt && (
              <span>
                · {new Date(earnedAt).toLocaleDateString("ko-KR")} 획득
              </span>
            )}
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
