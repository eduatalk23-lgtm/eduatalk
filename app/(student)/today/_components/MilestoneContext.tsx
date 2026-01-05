"use client";

/**
 * MilestoneContext - 마일스톤 알림 컨텍스트
 *
 * Today 페이지에서 학습 중 마일스톤 달성 알림을 관리합니다.
 * PlanTimer에서 마일스톤 달성 시 이 컨텍스트를 통해 알림을 표시합니다.
 */

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useMilestoneNotification } from "@/lib/hooks/useMilestoneNotification";
import { MilestoneToastContainer } from "./MilestoneToast";
import type { AchievedMilestone } from "@/lib/domains/today/types/milestone";

type MilestoneContextValue = {
  /** 마일스톤 달성 시 호출 */
  onMilestoneAchieved: (milestones: AchievedMilestone[]) => void;
  /** 사운드 활성화 상태 */
  soundEnabled: boolean;
  /** 사운드 토글 */
  toggleSound: () => void;
};

const MilestoneContext = createContext<MilestoneContextValue | null>(null);

type MilestoneProviderProps = {
  children: ReactNode;
  /** 사운드 활성화 여부 (기본: true) */
  soundEnabled?: boolean;
};

export function MilestoneProvider({
  children,
  soundEnabled: initialSoundEnabled = true,
}: MilestoneProviderProps) {
  const {
    milestones,
    addMilestones,
    dismissMilestone,
    soundEnabled,
    toggleSound,
  } = useMilestoneNotification({
    soundEnabled: initialSoundEnabled,
    checkIntervalMs: 60000, // 1분
    minStudySecondsToCheck: 1500, // 25분 (첫 번째 마일스톤 전)
  });

  // 마일스톤 달성 시 호출되는 콜백
  const onMilestoneAchieved = useCallback(
    (newMilestones: AchievedMilestone[]) => {
      if (newMilestones.length > 0) {
        addMilestones(newMilestones);
      }
    },
    [addMilestones]
  );

  return (
    <MilestoneContext.Provider
      value={{
        onMilestoneAchieved,
        soundEnabled,
        toggleSound,
      }}
    >
      {children}
      {/* 마일스톤 토스트 컨테이너 */}
      <MilestoneToastContainer
        milestones={milestones}
        onDismiss={dismissMilestone}
        soundEnabled={soundEnabled}
      />
    </MilestoneContext.Provider>
  );
}

/**
 * 마일스톤 컨텍스트 훅
 *
 * @returns MilestoneContextValue or null if not within provider
 */
export function useMilestoneContext(): MilestoneContextValue | null {
  return useContext(MilestoneContext);
}

/**
 * 마일스톤 컨텍스트 훅 (필수)
 *
 * @throws Error if not within MilestoneProvider
 */
export function useMilestoneContextRequired(): MilestoneContextValue {
  const context = useContext(MilestoneContext);
  if (!context) {
    throw new Error("useMilestoneContextRequired must be used within MilestoneProvider");
  }
  return context;
}
