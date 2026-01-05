"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { AchievedMilestone } from "@/lib/domains/today/types/milestone";

interface UseMilestoneNotificationOptions {
  /** 사운드 활성화 여부 */
  soundEnabled?: boolean;
  /** 체크 간격 (ms) - 기본 60초 */
  checkIntervalMs?: number;
  /** 최소 학습 시간 (초) - 이 시간 이후부터 체크 시작 */
  minStudySecondsToCheck?: number;
}

interface UseMilestoneNotificationReturn {
  /** 현재 표시할 마일스톤 목록 */
  milestones: AchievedMilestone[];
  /** 마일스톤 추가 */
  addMilestone: (milestone: AchievedMilestone) => void;
  /** 마일스톤 여러 개 추가 */
  addMilestones: (milestones: AchievedMilestone[]) => void;
  /** 특정 마일스톤 제거 */
  dismissMilestone: (index: number) => void;
  /** 모든 마일스톤 제거 */
  clearMilestones: () => void;
  /** 마일스톤 체크가 필요한지 여부 */
  shouldCheck: (currentStudySeconds: number) => boolean;
  /** 마지막 체크 시간 업데이트 */
  updateLastCheckTime: () => void;
  /** 사운드 활성화 상태 */
  soundEnabled: boolean;
  /** 사운드 활성화 토글 */
  toggleSound: () => void;
}

/**
 * 마일스톤 알림 관리 훅
 *
 * 학습 중 마일스톤 달성 알림을 관리합니다.
 */
export function useMilestoneNotification(
  options: UseMilestoneNotificationOptions = {}
): UseMilestoneNotificationReturn {
  const {
    soundEnabled: initialSoundEnabled = true,
    checkIntervalMs = 60000, // 1분
    minStudySecondsToCheck = 1500, // 25분 (첫 번째 마일스톤 전)
  } = options;

  const [milestones, setMilestones] = useState<AchievedMilestone[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const lastCheckTimeRef = useRef<number>(0);
  const lastCheckedSecondsRef = useRef<number>(0);

  // 마일스톤 추가
  const addMilestone = useCallback((milestone: AchievedMilestone) => {
    setMilestones((prev) => {
      // 중복 체크
      const isDuplicate = prev.some(
        (m) => m.type === milestone.type && m.value === milestone.value
      );
      if (isDuplicate) return prev;
      return [...prev, milestone];
    });
  }, []);

  // 마일스톤 여러 개 추가
  const addMilestones = useCallback((newMilestones: AchievedMilestone[]) => {
    if (newMilestones.length === 0) return;

    setMilestones((prev) => {
      const existingKeys = new Set(prev.map((m) => `${m.type}-${m.value}`));
      const uniqueNew = newMilestones.filter(
        (m) => !existingKeys.has(`${m.type}-${m.value}`)
      );
      return [...prev, ...uniqueNew];
    });
  }, []);

  // 특정 마일스톤 제거
  const dismissMilestone = useCallback((index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // 모든 마일스톤 제거
  const clearMilestones = useCallback(() => {
    setMilestones([]);
  }, []);

  // 마일스톤 체크가 필요한지 여부
  const shouldCheck = useCallback(
    (currentStudySeconds: number): boolean => {
      // 최소 학습 시간 미달
      if (currentStudySeconds < minStudySecondsToCheck) {
        return false;
      }

      const now = Date.now();

      // 첫 체크거나 간격이 지남
      if (
        lastCheckTimeRef.current === 0 ||
        now - lastCheckTimeRef.current >= checkIntervalMs
      ) {
        // 마지막 체크 이후 최소 30초 이상 학습했는지
        const secondsSinceLastCheck =
          currentStudySeconds - lastCheckedSecondsRef.current;
        return secondsSinceLastCheck >= 30;
      }

      return false;
    },
    [checkIntervalMs, minStudySecondsToCheck]
  );

  // 마지막 체크 시간 업데이트
  const updateLastCheckTime = useCallback(() => {
    lastCheckTimeRef.current = Date.now();
  }, []);

  // 사운드 토글
  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => !prev);
  }, []);

  // lastCheckedSeconds 업데이트 (shouldCheck 후 호출용)
  useEffect(() => {
    // 마일스톤이 추가될 때 현재 체크 시간 저장
    if (milestones.length > 0) {
      lastCheckedSecondsRef.current = Date.now();
    }
  }, [milestones.length]);

  return {
    milestones,
    addMilestone,
    addMilestones,
    dismissMilestone,
    clearMilestones,
    shouldCheck,
    updateLastCheckTime,
    soundEnabled,
    toggleSound,
  };
}

/**
 * 마일스톤 체크를 위한 서버 액션 호출 래퍼
 *
 * usePlanTimer에서 사용할 수 있는 헬퍼 함수
 */
export async function checkMilestonesAction(
  studentId: string,
  currentStudySeconds: number,
  planId?: string
): Promise<AchievedMilestone[]> {
  try {
    // 동적 import로 서버 액션 로드
    const { checkMilestones } = await import(
      "@/lib/domains/today/services/learningFeedbackService"
    );
    const result = await checkMilestones(studentId, currentStudySeconds, planId);
    return result.achieved;
  } catch (error) {
    console.error("[useMilestoneNotification] 마일스톤 체크 오류:", error);
    return [];
  }
}
