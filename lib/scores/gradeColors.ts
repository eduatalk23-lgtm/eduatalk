/**
 * 성적 등급별 색상 시스템
 * @deprecated lib/constants/colors.ts의 getGradeColor 사용 권장
 * 기존 코드 호환성을 위해 유지됨
 */

import { getGradeColor as getGradeColorFromColors, getTrendColor as getTrendColorFromColors } from "@/lib/constants/colors";

/**
 * 등급별 색상 반환 (1등급이 가장 좋음)
 * @deprecated lib/constants/colors.ts의 getGradeColor 사용 권장
 */
export function getGradeColor(grade: number | null | undefined): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  const color = getGradeColorFromColors(grade);
  // hex 속성 제거하여 기존 인터페이스 유지
  return {
    text: color.text,
    bg: color.bg,
    border: color.border,
    badge: color.badge,
  };
}

/**
 * 추세별 색상 반환
 * @deprecated lib/constants/colors.ts의 getTrendColor 사용 권장
 */
export function getTrendColor(trend: "improved" | "declined" | "stable" | null): {
  text: string;
  bg: string;
  icon: string;
} {
  return getTrendColorFromColors(trend);
}

