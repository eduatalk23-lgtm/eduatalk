/**
 * 타임라인 관련 유틸리티 함수
 */

import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { getTimeSlotColorClasses, type TimeSlotType } from "@/lib/utils/darkMode";

/**
 * 타임슬롯 타입
 * @deprecated 이 타입은 @/lib/utils/darkMode에서 re-export됩니다. 직접 import하지 마세요.
 */
export type { TimeSlotType };

export type TimelineSlot = {
  type: TimeSlotType;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
  plans?: PlanWithContent[]; // 학습시간인 경우 플랜 목록
  academy?: AcademySchedule; // 학원일정인 경우
};

import { timeToMinutes, minutesToTime } from "@/lib/utils/time";

// Re-export time utility functions for convenience
export { timeToMinutes, minutesToTime };

/**
 * 날짜별 타임라인 슬롯 생성
 * daily_schedule의 time_slots와 플랜, 학원일정을 결합
 * 플랜의 시간 정보를 사용하여 타임라인대로 배치
 */
export function buildTimelineSlots(
  dateStr: string,
  dailySchedule: DailyScheduleInfo | null | undefined,
  plans: PlanWithContent[],
  academySchedules: AcademySchedule[],
  exclusions: PlanExclusion[]
): TimelineSlot[] {
  const slots: TimelineSlot[] = [];
  
  // 해당 날짜의 제외일 확인
  const dayExclusions = exclusions.filter((exclusion) => exclusion.exclusion_date === dateStr);
  const isExclusionDay = dayExclusions.length > 0;
  // 제외일 타입 확인 (휴일지정은 자율학습 허용, 기타는 모든 학습 관련 슬롯 필터링)
  const exclusionType = dayExclusions.length > 0 ? dayExclusions[0].exclusion_type : null;
  const isHolidayDesignated = exclusionType === "휴일지정"; // 자율학습 허용
  const isOtherExclusion = exclusionType === "기타"; // 모든 학습 관련 슬롯 필터링
  
  // 해당 날짜의 플랜만 필터링
  const dayPlans = plans.filter((plan) => plan.plan_date === dateStr);
  
  // 플랜에 시간 정보가 있으면 시간 순으로 정렬
  const plansWithTime = dayPlans
    .filter((plan) => plan.start_time && plan.end_time)
    .sort((a, b) => {
      if (a.start_time && b.start_time) {
        return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
      }
      return a.block_index - b.block_index;
    });
  
  // 플랜에 시간 정보가 없으면 block_index 순으로 정렬
  const plansWithoutTime = dayPlans
    .filter((plan) => !plan.start_time || !plan.end_time)
    .sort((a, b) => a.block_index - b.block_index);

  // time_slots가 있으면 사용
  if (dailySchedule?.time_slots && dailySchedule.time_slots.length > 0) {
    // time_slots를 시간 순으로 정렬
    const sortedTimeSlots = [...dailySchedule.time_slots].sort((a, b) => {
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });

    // 각 타임슬롯에 플랜 매칭
    sortedTimeSlots.forEach((slot) => {
      // 제외일인 경우 학습 관련 타임슬롯 필터링
      // 학원일정은 제외일에도 표시 가능 (학원 수업은 별도)
      if (isExclusionDay) {
        // "기타" 제외일: 모든 학습 관련 슬롯 필터링 (학원일정 제외)
        if (isOtherExclusion && slot.type !== "학원일정") {
          return;
        }
        // "휴일지정" 제외일: 자율학습은 허용, 나머지 학습 관련 슬롯은 필터링
        if (isHolidayDesignated && slot.type !== "학원일정" && slot.type !== "자율학습" && slot.type !== "학습시간") {
          // 점심시간, 이동시간 등은 필터링, 자율학습은 허용
          return;
        }
        // "휴가", "개인사정" 등 기타 제외일: 모든 학습 관련 슬롯 필터링 (학원일정 제외)
        if (!isHolidayDesignated && !isOtherExclusion && slot.type !== "학원일정" && slot.type !== "학습시간") {
          return;
        }
      }
      const timelineSlot: TimelineSlot = {
        type: slot.type as TimeSlotType,
        start: slot.start,
        end: slot.end,
        label: slot.label,
      };

      // 학습시간인 경우 플랜 매칭
      if (slot.type === "학습시간") {
        // 제외일인 경우 학습시간 슬롯은 표시하지 않음
        // 단, "휴일지정"은 자율학습만 허용하므로 학습시간은 필터링
        if (isExclusionDay) {
          return;
        }
        
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);

        const matchingPlans: PlanWithContent[] = [];
        
        // 1. 시간 정보가 있는 플랜: 시간 범위가 겹치거나 일치하는 플랜 찾기
        plansWithTime.forEach((plan) => {
          if (plan.start_time && plan.end_time) {
            const planStart = timeToMinutes(plan.start_time);
            const planEnd = timeToMinutes(plan.end_time);
            // 시간 범위가 겹치거나 일치하는 경우
            if (
              (planStart >= slotStart && planStart < slotEnd) ||
              (planEnd > slotStart && planEnd <= slotEnd) ||
              (planStart <= slotStart && planEnd >= slotEnd)
            ) {
              matchingPlans.push(plan);
            }
          }
        });
        
        // 2. 시간 정보가 없는 플랜: block_index 기반으로 매칭 (fallback)
        // 학습시간 슬롯의 순서를 계산 (block_index와 매칭)
        const studyTimeSlotIndex = sortedTimeSlots
          .slice(0, sortedTimeSlots.indexOf(slot) + 1)
          .filter((s) => s.type === "학습시간").length;
        
        plansWithoutTime.forEach((plan) => {
          if (plan.block_index === studyTimeSlotIndex) {
            matchingPlans.push(plan);
          }
        });
        
        // 시간 순으로 정렬 (시간 정보가 있으면 시간 순, 없으면 block_index 순)
        matchingPlans.sort((a, b) => {
          if (a.start_time && b.start_time) {
            return timeToMinutes(a.start_time) - timeToMinutes(b.start_time);
          }
          return a.block_index - b.block_index;
        });

        timelineSlot.plans = matchingPlans;
      }

      // 학원일정인 경우 학원일정 매칭
      if (slot.type === "학원일정") {
        // 제외일인 경우 학원일정은 표시하지 않음
        // "휴일지정"도 자율학습만 허용하므로 학원일정은 필터링
        if (isExclusionDay) {
          return;
        }
        
        const slotStart = timeToMinutes(slot.start);
        const slotEnd = timeToMinutes(slot.end);

        const matchingAcademy = academySchedules.find((academy) => {
          const academyStart = timeToMinutes(academy.start_time);
          const academyEnd = timeToMinutes(academy.end_time);
          return (
            academyStart >= slotStart &&
            academyEnd <= slotEnd &&
            Math.abs(academyStart - slotStart) < 30 // 30분 이내 차이
          );
        });

        if (matchingAcademy) {
          timelineSlot.academy = matchingAcademy;
        }
      }

      slots.push(timelineSlot);
    });
    
    // 시간 정보가 있는 플랜 중 타임슬롯에 매칭되지 않은 플랜을 별도 슬롯으로 추가
    // 제외일이 아닌 경우에만 추가
    if (!isExclusionDay) {
      const matchedPlanIds = new Set<string>();
      slots.forEach((slot) => {
        if (slot.plans) {
          slot.plans.forEach((plan) => matchedPlanIds.add(plan.id));
        }
      });
      
      plansWithTime.forEach((plan) => {
        if (!matchedPlanIds.has(plan.id) && plan.start_time && plan.end_time) {
          // 플랜의 시간 정보로 직접 타임슬롯 생성
          slots.push({
            type: "학습시간",
            start: plan.start_time,
            end: plan.end_time,
            label: `${plan.start_time} ~ ${plan.end_time}`,
            plans: [plan],
          });
        }
      });
    }
    
    // 시간 순으로 다시 정렬
    slots.sort((a, b) => {
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
  } else {
    // time_slots가 없으면 플랜의 시간 정보로 타임라인 생성
    // 제외일이 아닌 경우에만 플랜 표시
    if (!isExclusionDay) {
      if (plansWithTime.length > 0) {
        plansWithTime.forEach((plan) => {
          if (plan.start_time && plan.end_time) {
            slots.push({
              type: "학습시간",
              start: plan.start_time,
              end: plan.end_time,
              label: `${plan.start_time} ~ ${plan.end_time}`,
              plans: [plan],
            });
          }
        });
      }
      
      // 시간 정보가 없는 플랜은 block_index 순으로 표시
      if (plansWithoutTime.length > 0) {
        plansWithoutTime.forEach((plan) => {
          slots.push({
            type: "학습시간",
            start: "00:00",
            end: "23:59",
            label: `블록 ${plan.block_index}`,
            plans: [plan],
          });
        });
      }
    }
  }

  return slots;
}

/**
 * 타임슬롯 색상 클래스 반환
 * @deprecated 이 함수는 @/lib/utils/darkMode의 getTimeSlotColorClasses로 이동되었습니다.
 * 하위 호환성을 위해 re-export합니다.
 */
export function getTimeSlotColorClass(type: TimeSlotType): string {
  return getTimeSlotColorClasses(type);
}

/**
 * 타임슬롯 아이콘 반환
 */
export function getTimeSlotIcon(type: TimeSlotType): string {
  switch (type) {
    case "학습시간":
      return "⏰"; // 콘텐츠 아이콘(📚, 🎧, 📝)과 구분하기 위해 시계 아이콘 사용
    case "점심시간":
      return "🍽️";
    case "학원일정":
      return "🏫";
    case "이동시간":
      return "🚶";
    case "자율학습":
      return "📖";
    default:
      return "⏰";
  }
}

