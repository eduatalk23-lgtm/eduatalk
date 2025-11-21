/**
 * 캘린더 날짜별 일정 타입 계산 유틸리티
 * 플랜 그룹의 daily_schedule에 저장된 정보를 사용
 */

import type { DailyScheduleInfo } from "@/lib/types/plan";

export type DayType = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | "normal";

export type DayTypeInfo = {
  type: DayType;
  label: string;
  icon: string;
  description?: string;
  exclusion?: {
    exclusion_date: string;
    exclusion_type: string;
    reason?: string | null;
  } | null;
};

/**
 * 날짜별 일정 타입 정보
 */
export const DAY_TYPE_INFO: Record<DayType, DayTypeInfo> = {
  학습일: {
    type: "학습일",
    label: "학습일",
    icon: "✏️",
    description: "새로운 내용을 학습하는 날",
  },
  복습일: {
    type: "복습일",
    label: "복습일",
    icon: "🔄",
    description: "이전에 학습한 내용을 복습하는 날",
  },
  지정휴일: {
    type: "지정휴일",
    label: "지정휴일",
    icon: "🏖️",
    description: "지정된 휴일",
  },
  휴가: {
    type: "휴가",
    label: "휴가",
    icon: "🏖️",
    description: "휴가",
  },
  개인일정: {
    type: "개인일정",
    label: "개인일정",
    icon: "🏖️",
    description: "개인 일정",
  },
  normal: {
    type: "normal",
    label: "일반",
    icon: "",
    description: "일반 날짜",
  },
};

/**
 * 플랜 그룹의 daily_schedule에서 날짜별 일정 타입 맵 생성
 * 
 * @param dailySchedules 플랜 그룹들의 daily_schedule 배열
 * @returns 날짜별 일정 타입 맵 (날짜 -> DayTypeInfo)
 */
export function buildDayTypesFromDailySchedule(
  dailySchedules: Array<DailyScheduleInfo[] | null | undefined>
): Map<string, DayTypeInfo> {
  const dayTypeMap = new Map<string, DayTypeInfo>();

  // 모든 플랜 그룹의 daily_schedule을 순회하며 날짜별 타입 정보 수집
  dailySchedules.forEach((schedule) => {
    if (!schedule || !Array.isArray(schedule)) {
      return;
    }

    schedule.forEach((daily) => {
      if (!daily.date || !daily.day_type) {
        return;
      }

      const dateStr = daily.date.slice(0, 10); // YYYY-MM-DD 형식 보장
      
      // 이미 존재하는 경우, 우선순위에 따라 덮어쓰기
      // 우선순위: 지정휴일/휴가/개인일정 > 학습일 > 복습일 > 일반
      const existing = dayTypeMap.get(dateStr);
      const currentPriority = getDayTypePriority(daily.day_type);
      const existingPriority = existing ? getDayTypePriority(existing.type) : -1;

      // 더 높은 우선순위가 있으면 덮어쓰기
      if (!existing || currentPriority > existingPriority) {
        const dayTypeInfo = DAY_TYPE_INFO[daily.day_type] || DAY_TYPE_INFO.normal;
        
        dayTypeMap.set(dateStr, {
          ...dayTypeInfo,
          type: daily.day_type as DayType,
          exclusion: daily.exclusion || null,
        });
      }
    });
  });

  return dayTypeMap;
}

/**
 * 날짜 타입의 우선순위 반환 (높을수록 우선)
 */
function getDayTypePriority(dayType: DayType): number {
  switch (dayType) {
    case "지정휴일":
    case "휴가":
    case "개인일정":
      return 3; // 최고 우선순위
    case "학습일":
      return 2;
    case "복습일":
      return 1;
    default:
      return 0;
  }
}

