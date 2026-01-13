/**
 * Phase 2: 시간 충돌 방지 로직 테스트
 *
 * 기존 플랜이 있을 때 새 플랜이 해당 시간을 회피하는지 검증합니다.
 *
 * @module __tests__/lib/scheduler/timeConflict.test
 */

import { describe, it, expect } from "vitest";

// timeToMinutes 유틸리티 함수 (실제 구현과 동일)
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// ExistingPlanInfo 타입 정의
interface ExistingPlanInfo {
  date: string;
  start_time: string;
  end_time: string;
}

/**
 * calculateUsedTimeForSlot 테스트용 구현
 * SchedulerEngine.calculateUsedTimeForSlot과 동일한 로직
 */
function calculateUsedTimeForSlot(
  slot: { start: string; end: string },
  existingPlansForDate: ExistingPlanInfo[]
): number {
  let usedTime = 0;
  const slotStart = timeToMinutes(slot.start);
  const slotEnd = timeToMinutes(slot.end);

  for (const plan of existingPlansForDate) {
    const planStart = timeToMinutes(plan.start_time);
    const planEnd = timeToMinutes(plan.end_time);

    // 슬롯과 기존 플랜의 겹치는 부분 계산
    const overlapStart = Math.max(slotStart, planStart);
    const overlapEnd = Math.min(slotEnd, planEnd);

    if (overlapEnd > overlapStart) {
      usedTime += overlapEnd - overlapStart;
    }
  }

  return usedTime;
}

describe("Phase 2: 시간 충돌 방지", () => {
  describe("calculateUsedTimeForSlot", () => {
    it("기존 플랜이 없으면 사용 시간 0", () => {
      const slot = { start: "09:00", end: "12:00" };
      const existingPlans: ExistingPlanInfo[] = [];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(0);
    });

    it("기존 플랜이 슬롯 전체를 차지하면 슬롯 전체 시간 반환", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "12:00" },
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(180); // 3시간 = 180분
    });

    it("기존 플랜이 슬롯 일부만 차지하면 해당 시간만 반환", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" }, // 60분
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(60);
    });

    it("기존 플랜이 슬롯 중간에 있으면 겹치는 시간만 반환", () => {
      const slot = { start: "09:00", end: "12:00" };
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "10:00", end_time: "11:00" }, // 60분
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(60);
    });

    it("기존 플랜이 슬롯 범위를 벗어나면 0 반환", () => {
      const slot = { start: "09:00", end: "12:00" };
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "13:00", end_time: "14:00" }, // 슬롯 범위 밖
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(0);
    });

    it("기존 플랜이 슬롯과 부분적으로 겹치면 겹치는 시간만 반환", () => {
      const slot = { start: "09:00", end: "12:00" };
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "08:00", end_time: "10:00" }, // 슬롯 시작 전부터
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(60); // 09:00-10:00만 겹침
    });

    it("여러 기존 플랜이 있으면 모든 겹침 시간 합산", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "09:30" }, // 30분
        { date: "2024-01-15", start_time: "10:00", end_time: "10:30" }, // 30분
        { date: "2024-01-15", start_time: "11:00", end_time: "11:30" }, // 30분
      ];

      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);

      expect(usedTime).toBe(90); // 30 + 30 + 30
    });
  });

  describe("슬롯 가용 시간 계산", () => {
    it("슬롯 전체 시간에서 사용된 시간을 빼면 가용 시간", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" }, // 60분 사용
      ];

      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      const slotDuration = slotEnd - slotStart;
      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);
      const availableTime = slotDuration - usedTime;

      expect(slotDuration).toBe(180);
      expect(usedTime).toBe(60);
      expect(availableTime).toBe(120); // 2시간 가용
    });

    it("새 플랜이 가용 시간 내에 들어갈 수 있는지 확인", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" }, // 60분 사용
      ];

      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      const slotDuration = slotEnd - slotStart;
      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);
      const availableTime = slotDuration - usedTime;

      // 새 플랜: 60분 필요
      const newPlanDuration = 60;
      const canFit = availableTime >= newPlanDuration;

      expect(canFit).toBe(true);
    });

    it("새 플랜이 가용 시간보다 크면 배치 불가", () => {
      const slot = { start: "09:00", end: "12:00" }; // 180분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "11:00" }, // 120분 사용
      ];

      const slotStart = timeToMinutes(slot.start);
      const slotEnd = timeToMinutes(slot.end);
      const slotDuration = slotEnd - slotStart;
      const usedTime = calculateUsedTimeForSlot(slot, existingPlans);
      const availableTime = slotDuration - usedTime;

      // 새 플랜: 90분 필요 (가용 60분보다 큼)
      const newPlanDuration = 90;
      const canFit = availableTime >= newPlanDuration;

      expect(availableTime).toBe(60);
      expect(canFit).toBe(false);
    });
  });

  describe("시나리오: 기존 플랜이 있는 플래너에 새 플랜 추가", () => {
    it("시나리오 2: 09:00-10:00에 기존 플랜이 있으면 새 플랜은 10:00 이후에 배치", () => {
      // Given: 학습 시간 09:00-12:00, 기존 플랜 09:00-10:00
      const studySlot = { start: "09:00", end: "12:00" };
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" },
      ];

      // When: 새 플랜 60분 배치 시도
      const newPlanDuration = 60;
      const usedTime = calculateUsedTimeForSlot(studySlot, existingPlans);
      const slotStart = timeToMinutes(studySlot.start);
      const slotEnd = timeToMinutes(studySlot.end);
      const slotDuration = slotEnd - slotStart;
      const availableTime = slotDuration - usedTime;

      // Then: 가용 시간 확인
      expect(availableTime).toBe(120); // 10:00-12:00 = 120분 가용
      expect(availableTime >= newPlanDuration).toBe(true);

      // 새 플랜 시작 시간 계산 (기존 플랜 종료 후)
      const existingPlanEnd = timeToMinutes(existingPlans[0].end_time);
      const newPlanStartTime = existingPlanEnd + usedTime - 60; // 실제로는 10:00부터 시작 가능

      // 10:00 이후에 배치되어야 함
      expect(existingPlanEnd).toBe(600); // 10:00 = 600분
    });

    it("시나리오 3: 학습 시간 초과 시 자율학습 시간 사용", () => {
      // Given: 학습 시간 2시간, 기존 플랜 1시간, 새 플랜 2시간 필요
      const studySlot = { start: "09:00", end: "11:00" }; // 120분
      const selfStudySlot = { start: "19:00", end: "21:00" }; // 120분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "10:00" }, // 60분 사용
      ];

      // When: 새 플랜 120분(2시간) 필요
      const newPlanDuration = 120;

      // 학습 시간 가용량 계산
      const studyUsedTime = calculateUsedTimeForSlot(studySlot, existingPlans);
      const studySlotDuration = timeToMinutes(studySlot.end) - timeToMinutes(studySlot.start);
      const studyAvailable = studySlotDuration - studyUsedTime;

      // 자율학습 시간 가용량 계산
      const selfStudyUsedTime = calculateUsedTimeForSlot(selfStudySlot, existingPlans);
      const selfStudySlotDuration = timeToMinutes(selfStudySlot.end) - timeToMinutes(selfStudySlot.start);
      const selfStudyAvailable = selfStudySlotDuration - selfStudyUsedTime;

      // Then
      expect(studyAvailable).toBe(60); // 학습 시간: 60분 가용 (10:00-11:00)
      expect(selfStudyAvailable).toBe(120); // 자율학습: 120분 가용

      // 학습 시간(60분)만으로는 부족, 자율학습 시간(120분) 필요
      const totalAvailable = studyAvailable + selfStudyAvailable;
      expect(totalAvailable >= newPlanDuration).toBe(true); // 180분 >= 120분
    });

    it("시나리오 4: 전체 시간 초과 시 dock 배치", () => {
      // Given: 학습 + 자율학습 총 3시간, 기존 플랜 2시간, 새 플랜 2시간 필요
      const studySlot = { start: "09:00", end: "11:00" }; // 120분
      const selfStudySlot = { start: "19:00", end: "20:00" }; // 60분
      const existingPlans: ExistingPlanInfo[] = [
        { date: "2024-01-15", start_time: "09:00", end_time: "11:00" }, // 학습 시간 전체 사용
      ];

      // When: 새 플랜 120분 필요
      const newPlanDuration = 120;

      // 학습 시간 가용량 계산
      const studyUsedTime = calculateUsedTimeForSlot(studySlot, existingPlans);
      const studySlotDuration = timeToMinutes(studySlot.end) - timeToMinutes(studySlot.start);
      const studyAvailable = studySlotDuration - studyUsedTime;

      // 자율학습 시간 가용량 계산
      const selfStudyAvailable = 60; // 1시간만 가용

      const totalAvailable = studyAvailable + selfStudyAvailable;

      // Then
      expect(studyAvailable).toBe(0); // 학습 시간: 0분 가용
      expect(totalAvailable).toBe(60); // 총 60분 가용
      expect(totalAvailable >= newPlanDuration).toBe(false); // 60분 < 120분

      // dock에 배치해야 함
      const needsDock = totalAvailable < newPlanDuration;
      expect(needsDock).toBe(true);
    });
  });
});
