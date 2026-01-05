"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Trophy, Star, Sparkles, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AchievedMilestone, MilestoneType } from "@/lib/domains/today/types/milestone";

interface MilestoneToastProps {
  milestone: AchievedMilestone;
  onClose: () => void;
  autoCloseMs?: number;
  soundEnabled?: boolean;
}

/**
 * 마일스톤 아이콘 컴포넌트
 */
function MilestoneIcon({
  type,
  celebrationLevel,
}: {
  type: MilestoneType;
  celebrationLevel: "minor" | "major" | "epic";
}) {
  const iconClassName = cn(
    "h-6 w-6",
    celebrationLevel === "epic" && "text-yellow-500",
    celebrationLevel === "major" && "text-purple-500",
    celebrationLevel === "minor" && "text-blue-500"
  );

  switch (type) {
    case "daily_goal":
      return <Trophy className={iconClassName} />;
    case "study_120min":
      return <Star className={iconClassName} />;
    case "streak_3days":
    case "streak_7days":
      return <Sparkles className={iconClassName} />;
    default:
      return <Clock className={iconClassName} />;
  }
}

/**
 * 마일스톤 토스트 컴포넌트
 *
 * 학습 중 마일스톤 달성 시 표시되는 토스트 알림
 */
export function MilestoneToast({
  milestone,
  onClose,
  autoCloseMs = 5000,
  soundEnabled = true,
}: MilestoneToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // 사운드 재생
  useEffect(() => {
    if (soundEnabled && milestone.celebrationLevel !== "minor") {
      // Web Audio API를 사용한 간단한 알림음
      try {
        const audioContext = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // 축하 사운드 패턴
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch {
        // Audio not supported, ignore
      }
    }
  }, [soundEnabled, milestone.celebrationLevel]);

  // 입장/퇴장 애니메이션
  useEffect(() => {
    // 입장
    const showTimer = setTimeout(() => setIsVisible(true), 50);

    // 자동 닫기
    const closeTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(onClose, 300);
    }, autoCloseMs);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(closeTimer);
    };
  }, [autoCloseMs, onClose]);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  // 배경색 및 테두리 스타일
  const containerStyles = cn(
    "fixed top-4 left-1/2 -translate-x-1/2 z-50",
    "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg",
    "transform transition-all duration-300 ease-out",
    "border-2",
    // 애니메이션 상태
    isVisible && !isExiting
      ? "translate-y-0 opacity-100 scale-100"
      : "-translate-y-4 opacity-0 scale-95",
    // 축하 레벨별 스타일
    milestone.celebrationLevel === "epic" &&
      "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300",
    milestone.celebrationLevel === "major" &&
      "bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-300",
    milestone.celebrationLevel === "minor" &&
      "bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300"
  );

  return (
    <div className={containerStyles} role="alert" aria-live="polite">
      {/* 아이콘 */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          milestone.celebrationLevel === "epic" && "bg-yellow-100",
          milestone.celebrationLevel === "major" && "bg-purple-100",
          milestone.celebrationLevel === "minor" && "bg-blue-100"
        )}
      >
        <MilestoneIcon
          type={milestone.type}
          celebrationLevel={milestone.celebrationLevel}
        />
      </div>

      {/* 메시지 */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-bold",
            milestone.celebrationLevel === "epic" && "text-yellow-800",
            milestone.celebrationLevel === "major" && "text-purple-800",
            milestone.celebrationLevel === "minor" && "text-blue-800"
          )}
        >
          {milestone.message}
        </p>
        {milestone.subMessage && (
          <p
            className={cn(
              "text-xs mt-0.5",
              milestone.celebrationLevel === "epic" && "text-yellow-600",
              milestone.celebrationLevel === "major" && "text-purple-600",
              milestone.celebrationLevel === "minor" && "text-blue-600"
            )}
          >
            {milestone.subMessage}
          </p>
        )}
      </div>

      {/* 닫기 버튼 */}
      <button
        onClick={handleClose}
        className={cn(
          "shrink-0 rounded-full p-1 transition-colors",
          milestone.celebrationLevel === "epic" &&
            "text-yellow-400 hover:bg-yellow-100 hover:text-yellow-600",
          milestone.celebrationLevel === "major" &&
            "text-purple-400 hover:bg-purple-100 hover:text-purple-600",
          milestone.celebrationLevel === "minor" &&
            "text-blue-400 hover:bg-blue-100 hover:text-blue-600"
        )}
        aria-label="닫기"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * 마일스톤 토스트 컨테이너
 *
 * 여러 마일스톤을 순차적으로 표시
 */
interface MilestoneToastContainerProps {
  milestones: AchievedMilestone[];
  onDismiss: (index: number) => void;
  soundEnabled?: boolean;
}

export function MilestoneToastContainer({
  milestones,
  onDismiss,
  soundEnabled = true,
}: MilestoneToastContainerProps) {
  // 가장 첫 번째 마일스톤만 표시 (큐 방식)
  const currentMilestone = milestones[0];

  if (!currentMilestone) {
    return null;
  }

  return (
    <MilestoneToast
      key={`${currentMilestone.type}-${currentMilestone.value}`}
      milestone={currentMilestone}
      onClose={() => onDismiss(0)}
      soundEnabled={soundEnabled}
    />
  );
}
