/**
 * 타임라인 관련 유틸리티 함수
 */

import type { DailyScheduleInfo } from "@/lib/types/plan";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";

/**
 * 타임슬롯 타입
 */
export type TimeSlotType = "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";

export type TimelineSlot = {
  type: TimeSlotType;
  start: string; // HH:mm
  end: string; // HH:mm
  label?: string;
  plans?: PlanWithContent[]; // 학습시간인 경우 플랜 목록
  academy?: AcademySchedule; // 학원일정인 경우
};

/**
 * 시간 문자열을 분으로 변환
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분을 시간 문자열로 변환
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

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
      const timelineSlot: TimelineSlot = {
        type: slot.type as TimeSlotType,
        start: slot.start,
        end: slot.end,
        label: slot.label,
      };

      // 학습시간인 경우 플랜 매칭
      if (slot.type === "학습시간") {
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
    
    // 시간 순으로 다시 정렬
    slots.sort((a, b) => {
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    });
  } else {
    // time_slots가 없으면 플랜의 시간 정보로 타임라인 생성
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

  return slots;
}

/**
 * 타임슬롯 색상 클래스 반환
 */
export function getTimeSlotColorClass(type: TimeSlotType): string {
  switch (type) {
    case "학습시간":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "점심시간":
      return "bg-orange-50 border-orange-200 text-orange-800";
    case "학원일정":
      return "bg-purple-50 border-purple-200 text-purple-800";
    case "이동시간":
      return "bg-gray-50 border-gray-200 text-gray-800";
    case "자율학습":
      return "bg-green-50 border-green-200 text-green-800";
    default:
      return "bg-gray-50 border-gray-200 text-gray-800";
  }
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

