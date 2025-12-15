/**
 * 성적 등급별 색상 시스템
 * 
 * @deprecated 이 파일은 더 이상 사용되지 않으며, 향후 버전에서 삭제될 예정입니다.
 * 모든 기능은 @/lib/constants/colors.ts로 마이그레이션되었습니다.
 * 
 * ⚠️ 새로운 코드에서는 절대 이 파일을 import하지 마세요.
 * 대신 @/lib/constants/colors.ts에서 직접 import하세요.
 * 
 * 마이그레이션 가이드:
 * - 이전: import { getGradeColor } from "@/lib/scores/gradeColors"
 * - 이후: import { getGradeColor } from "@/lib/constants/colors"
 * 
 * 이 파일은 하위 호환성을 위해 lib/constants/colors.ts의 함수를 래핑합니다.
 */

import { getGradeColor as getGradeColorFromColors, getTrendColor as getTrendColorFromColors } from "@/lib/constants/colors";

/**
 * 등급별 색상 반환 (1등급이 가장 좋음)
 * @deprecated @/lib/constants/colors.ts의 getGradeColor를 직접 사용하세요.
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
 * @deprecated @/lib/constants/colors.ts의 getTrendColor를 직접 사용하세요.
 */
export function getTrendColor(trend: "improved" | "declined" | "stable" | null): {
  text: string;
  bg: string;
  icon: string;
} {
  return getTrendColorFromColors(trend);
}

