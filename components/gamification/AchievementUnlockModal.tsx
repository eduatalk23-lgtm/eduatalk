"use client";

import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { AchievementBadge } from "./AchievementBadge";
import { AchievementWithDefinition, TIER_LABELS } from "@/lib/domains/gamification/types";

interface AchievementUnlockModalProps {
  achievements: AchievementWithDefinition[];
  onClose: () => void;
  onAcknowledge?: (achievementIds: string[]) => Promise<void> | void;
}

export function AchievementUnlockModal({
  achievements,
  onClose,
  onAcknowledge,
}: AchievementUnlockModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const currentAchievement = achievements[currentIndex];
  const hasMore = currentIndex < achievements.length - 1;

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Create confetti effect
    if (isVisible && currentAchievement) {
      createConfetti();
    }
  }, [isVisible, currentIndex, currentAchievement]);

  const handleNext = () => {
    if (hasMore) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      handleClose();
    }
  };

  const handleClose = async () => {
    setIsVisible(false);

    // acknowledge 완료 대기 - 중복 모달 방지를 위해 DB 업데이트 보장
    if (onAcknowledge) {
      await onAcknowledge(achievements.map((a) => a.id));
    }

    // 애니메이션 완료 후 모달 닫기
    setTimeout(onClose, 300);
  };

  if (!currentAchievement) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center transition-all duration-300",
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-transparent"
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          "relative bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden transition-all duration-500",
          isVisible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-75 translate-y-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {/* Decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-50 via-white to-purple-50" />
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-yellow-200/30 to-amber-300/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br from-purple-200/30 to-indigo-300/30 rounded-full blur-3xl" />

        {/* Content */}
        <div className="relative px-8 py-10 flex flex-col items-center text-center">
          {/* Header */}
          <div className="flex items-center gap-2 text-amber-500 mb-4">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">업적 달성!</span>
            <Sparkles className="w-5 h-5" />
          </div>

          {/* Badge */}
          <div className="mb-6 animate-bounce-in">
            <AchievementBadge
              achievement={currentAchievement.definition}
              earned
              size="lg"
              showTooltip={false}
            />
          </div>

          {/* Achievement info */}
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {currentAchievement.definition.name}
          </h2>

          {currentAchievement.definition.description && (
            <p className="text-gray-500 mb-3">
              {currentAchievement.definition.description}
            </p>
          )}

          <div className="flex items-center gap-3 text-sm">
            <span
              className="font-medium"
              style={{
                color: `var(--tier-${currentAchievement.definition.tier}, #CD7F32)`,
              }}
            >
              {TIER_LABELS[currentAchievement.definition.tier]}
            </span>
            {currentAchievement.definition.xpReward > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-amber-500 font-medium">
                  +{currentAchievement.definition.xpReward} XP
                </span>
              </>
            )}
          </div>

          {/* Progress indicator */}
          {achievements.length > 1 && (
            <div className="flex items-center gap-1 mt-6">
              {achievements.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentIndex
                      ? "w-4 bg-purple-500"
                      : i < currentIndex
                        ? "bg-purple-300"
                        : "bg-gray-200"
                  )}
                />
              ))}
            </div>
          )}

          {/* Action button */}
          <button
            onClick={handleNext}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium rounded-full hover:shadow-lg hover:shadow-purple-500/30 transition-all"
          >
            {hasMore ? "다음" : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple confetti effect
function createConfetti() {
  const colors = ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#9B59B6"];
  const container = document.body;

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement("div");
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${50 + (Math.random() - 0.5) * 40}vw;
      top: 50vh;
      border-radius: ${Math.random() > 0.5 ? "50%" : "0"};
      pointer-events: none;
      z-index: 9999;
      animation: confetti-fall ${1.5 + Math.random()}s ease-out forwards;
      transform: rotate(${Math.random() * 360}deg);
    `;
    container.appendChild(confetti);

    setTimeout(() => confetti.remove(), 3000);
  }
}
