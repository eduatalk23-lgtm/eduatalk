/**
 * 기본 시간 슬롯 설정
 *
 * 학교/학원 시간표의 기본 슬롯을 정의합니다.
 * 추후 테넌트별 커스터마이제이션이 가능하도록 DB로 이전 예정입니다.
 */

import type { MatrixTimeSlot } from "@/lib/types/plan/views";

/**
 * 기본 시간 슬롯 목록
 * - study: 학습 시간
 * - meal: 식사 시간
 * - break: 휴식 시간
 * - free: 자유 시간
 * - academy: 학원 시간
 */
export const DEFAULT_TIME_SLOTS: MatrixTimeSlot[] = [
  {
    id: "slot-1",
    name: "1교시",
    startTime: "08:00",
    endTime: "08:50",
    order: 1,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-2",
    name: "2교시",
    startTime: "09:00",
    endTime: "09:50",
    order: 2,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-3",
    name: "3교시",
    startTime: "10:00",
    endTime: "10:50",
    order: 3,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-4",
    name: "4교시",
    startTime: "11:00",
    endTime: "11:50",
    order: 4,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-5",
    name: "점심",
    startTime: "12:00",
    endTime: "13:00",
    order: 5,
    type: "meal",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-6",
    name: "5교시",
    startTime: "13:00",
    endTime: "13:50",
    order: 6,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-7",
    name: "6교시",
    startTime: "14:00",
    endTime: "14:50",
    order: 7,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-8",
    name: "7교시",
    startTime: "15:00",
    endTime: "15:50",
    order: 8,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-9",
    name: "자습1",
    startTime: "16:00",
    endTime: "17:50",
    order: 9,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-10",
    name: "저녁",
    startTime: "18:00",
    endTime: "19:00",
    order: 10,
    type: "meal",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-11",
    name: "자습2",
    startTime: "19:00",
    endTime: "20:50",
    order: 11,
    type: "study",
    isDefault: true,
    isActive: true,
  },
  {
    id: "slot-12",
    name: "자습3",
    startTime: "21:00",
    endTime: "22:00",
    order: 12,
    type: "study",
    isDefault: true,
    isActive: true,
  },
];

/**
 * 기본 시간 슬롯을 반환합니다.
 * 추후 테넌트별 설정을 지원하도록 확장 예정입니다.
 */
export function getDefaultTimeSlots(): MatrixTimeSlot[] {
  return DEFAULT_TIME_SLOTS;
}

/**
 * 학습 시간 슬롯만 필터링합니다.
 */
export function getStudyTimeSlots(): MatrixTimeSlot[] {
  return DEFAULT_TIME_SLOTS.filter((slot) => slot.type === "study");
}

/**
 * 시간 슬롯의 총 학습 가능 시간(분)을 계산합니다.
 */
export function getTotalStudyMinutes(): number {
  return getStudyTimeSlots().reduce((total, slot) => {
    const [startHour, startMin] = slot.startTime.split(":").map(Number);
    const [endHour, endMin] = slot.endTime.split(":").map(Number);
    const duration = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    return total + duration;
  }, 0);
}
