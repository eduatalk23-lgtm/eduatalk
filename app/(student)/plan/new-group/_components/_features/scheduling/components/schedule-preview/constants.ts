/**
 * SchedulePreviewPanel 상수
 *
 * @module schedule-preview/constants
 */

import { getDayTypeBadgeClasses } from "@/lib/utils/darkMode";

export const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

/**
 * @deprecated getDayTypeBadgeClasses() 직접 사용 권장
 * 날짜 타입별 색상 클래스 반환 (하위 호환성 유지)
 */
export const dayTypeColors: Record<string, string> = {
  학습일: getDayTypeBadgeClasses("학습일"),
  복습일: getDayTypeBadgeClasses("복습일"),
  지정휴일: getDayTypeBadgeClasses("지정휴일"),
  휴가: getDayTypeBadgeClasses("휴가"),
  개인일정: getDayTypeBadgeClasses("개인일정"),
};
