/**
 * 통합 컬러 시스템
 * CSS 변수 기반 컬러 팔레트 및 유틸리티 함수
 */

// ============================================
// Chart Colors (차트 색상 팔레트)
// ============================================

/**
 * 차트용 색상 팔레트 (8색)
 * CSS 변수 기반 hex 값
 */
export const CHART_COLORS = [
  "#6366f1", // indigo-500 - chart-0
  "#8b5cf6", // purple-500 - chart-1
  "#ec4899", // pink-500 - chart-2
  "#f59e0b", // amber-500 - chart-3
  "#10b981", // emerald-500 - chart-4
  "#3b82f6", // blue-500 - chart-5
  "#ef4444", // red-500 - chart-6
  "#14b8a6", // teal-500 - chart-7
] as const;

/**
 * 차트용 Tailwind 클래스 매핑
 */
export const CHART_COLOR_CLASSES = [
  "bg-chart-0",
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
  "bg-chart-6",
  "bg-chart-7",
] as const;

/**
 * 인덱스에 따른 차트 색상 반환 (차트 라이브러리용 hex)
 */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * 인덱스에 따른 차트 Tailwind 클래스 반환 (UI 컴포넌트용)
 */
export function getChartColorClass(index: number): string {
  return CHART_COLOR_CLASSES[index % CHART_COLOR_CLASSES.length];
}

// ============================================
// Grade Colors (등급별 색상)
// ============================================

/**
 * 등급별 색상 반환 (1등급이 가장 좋음)
 * CSS 변수 기반 Tailwind 클래스 반환
 */
export function getGradeColor(grade: number | null | undefined): {
  text: string;
  bg: string;
  border: string;
  badge: string;
  hex: string; // 차트 라이브러리용 hex 값
} {
  if (grade === null || grade === undefined) {
    return {
      text: "text-secondary-600",
      bg: "bg-secondary-50",
      border: "border-secondary-200",
      badge: "bg-secondary-100 text-secondary-700",
      hex: "#9ca3af", // gray-400
    };
  }

  // 등급별 색상 매핑
  if (grade <= 1) {
    return {
      text: "text-info-700",
      bg: "bg-info-50",
      border: "border-info-200",
      badge: "bg-info-600 text-white",
      hex: "#2563eb", // blue-600
    };
  }
  if (grade <= 2) {
    return {
      text: "text-info-600",
      bg: "bg-info-50",
      border: "border-info-200",
      badge: "bg-info-500 text-white",
      hex: "#3b82f6", // blue-500
    };
  }
  if (grade <= 3) {
    return {
      text: "text-primary-600",
      bg: "bg-primary-50",
      border: "border-primary-200",
      badge: "bg-primary-500 text-white",
      hex: "#6366f1", // indigo-500
    };
  }
  if (grade <= 4) {
    return {
      text: "text-secondary-600",
      bg: "bg-secondary-50",
      border: "border-secondary-200",
      badge: "bg-secondary-500 text-white",
      hex: "#9ca3af", // gray-400
    };
  }
  if (grade <= 5) {
    return {
      text: "text-warning-700",
      bg: "bg-warning-50",
      border: "border-warning-200",
      badge: "bg-warning-500 text-white",
      hex: "#eab308", // yellow-500
    };
  }
  if (grade <= 6) {
    return {
      text: "text-warning-600",
      bg: "bg-warning-50",
      border: "border-warning-200",
      badge: "bg-warning-500 text-white",
      hex: "#f97316", // orange-500
    };
  }
  if (grade <= 7) {
    return {
      text: "text-error-600",
      bg: "bg-error-50",
      border: "border-error-200",
      badge: "bg-error-500 text-white",
      hex: "#ef4444", // red-500
    };
  }
  // 8-9등급
  return {
    text: "text-error-700",
    bg: "bg-error-100",
    border: "border-error-300",
    badge: "bg-error-600 text-white",
    hex: "#dc2626", // red-600
  };
}

/**
 * 등급별 hex 색상 반환 (차트 라이브러리용)
 */
export function getGradeColorHex(grade: number | null | undefined): string {
  return getGradeColor(grade).hex;
}

// ============================================
// Day Type Colors (날짜 타입별 색상)
// ============================================

import { getDayTypeColorObject } from "@/lib/utils/darkMode";

export type DayType = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | "normal";

/**
 * 날짜 타입별 색상 반환
 * 
 * @deprecated 이 함수는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 `getDayTypeColorObject()`를 직접 사용하세요.
 * 
 * @param dayType 날짜 타입
 * @param isToday 오늘 날짜 여부
 * @returns 색상 객체 (bg, border, text, boldText, badge)
 */
export function getDayTypeColor(
  dayType: DayType | string,
  isToday: boolean = false
): {
  bg: string;
  border: string;
  text: string;
  boldText: string;
  badge: string;
} {
  // darkMode.ts의 getDayTypeColorObject를 활용하여 일관성 유지
  return getDayTypeColorObject(dayType, isToday);
}

// ============================================
// Risk Colors (위험도 색상)
// ============================================

import { getRiskColorClasses } from "@/lib/utils/darkMode";

/**
 * 위험도 점수에 따른 색상 반환
 * 
 * @deprecated 이 함수는 하위 호환성을 위해 유지됩니다.
 * 새로운 코드에서는 `getRiskColorClasses()`를 직접 사용하거나,
 * hex 값이 필요한 경우에만 이 함수를 사용하세요.
 * 
 * @param riskScore 위험도 점수 (0-100)
 * @returns 색상 객체 (text, bg, border, badge, hex)
 */
export function getRiskColor(riskScore: number): {
  text: string;
  bg: string;
  border: string;
  badge: string;
  hex: string; // 차트 라이브러리용
} {
  // darkMode.ts의 getRiskColorClasses를 활용하여 일관성 유지
  const classes = getRiskColorClasses(riskScore);
  const classArray = classes.split(" ");
  
  // 클래스에서 색상 정보 추출 (다크 모드 포함)
  const extractClass = (prefix: string): string => {
    const lightClass = classArray.find(c => c.startsWith(prefix) && !c.includes("dark:"));
    const darkClass = classArray.find(c => c.startsWith(`dark:${prefix}`));
    return lightClass ? (darkClass ? `${lightClass} ${darkClass}` : lightClass) : "";
  };
  
  const bg = extractClass("bg-");
  const text = extractClass("text-");
  const border = extractClass("border-");
  
  // hex 값은 차트 라이브러리용으로 유지
  let hex: string;
  if (riskScore >= 70) {
    hex = "#ef4444"; // red-500
  } else if (riskScore >= 50) {
    hex = "#f59e0b"; // amber-500
  } else if (riskScore >= 30) {
    hex = "#eab308"; // yellow-500
  } else {
    hex = "#10b981"; // emerald-500
  }
  
  // badge 색상 결정
  let badge: string;
  if (riskScore >= 70) {
    badge = "bg-error-600 dark:bg-error-500 text-white";
  } else if (riskScore >= 50) {
    badge = "bg-warning-500 dark:bg-warning-600 text-white";
  } else if (riskScore >= 30) {
    badge = "bg-warning-400 dark:bg-warning-500 text-white";
  } else {
    badge = "bg-success-500 dark:bg-success-600 text-white";
  }
  
  return {
    text: text || "text-gray-700 dark:text-gray-200",
    bg: bg || "bg-gray-50 dark:bg-gray-900",
    border: border || "border-gray-200 dark:border-gray-700",
    badge,
    hex,
  };
}

/**
 * 위험도 점수에 따른 hex 색상 반환 (차트 라이브러리용)
 */
export function getRiskColorHex(riskScore: number): string {
  return getRiskColor(riskScore).hex;
}

// ============================================
// Trend Colors (추세 색상)
// ============================================

/**
 * 추세별 색상 반환
 */
export function getTrendColor(trend: "improved" | "declined" | "stable" | null): {
  text: string;
  bg: string;
  icon: string;
} {
  if (trend === "improved") {
    return {
      text: "text-success-700 dark:text-success-400",
      bg: "bg-success-50 dark:bg-success-900/30",
      icon: "↑",
    };
  }
  if (trend === "declined") {
    return {
      text: "text-error-700 dark:text-error-400",
      bg: "bg-error-50 dark:bg-error-900/30",
      icon: "↓",
    };
  }
  return {
    text: "text-secondary-600 dark:text-secondary-400",
    bg: "bg-secondary-50 dark:bg-secondary-900/30",
    icon: "→",
  };
}

// ============================================
// Legacy Support (기존 코드 호환성)
// ============================================

/**
 * @deprecated getSubjectColor 사용 권장
 * 과목별 색상 반환 (차트 라이브러리용 hex)
 */
export function getSubjectColor(index: number): string {
  return getChartColor(index);
}

/**
 * @deprecated getSubjectColorClass 사용 권장
 * 과목별 Tailwind 클래스 반환
 */
export function getSubjectColorClass(index: number): string {
  return getChartColorClass(index);
}

/**
 * Legacy export for backward compatibility
 */
export const SUBJECT_COLORS = CHART_COLORS;
export const SUBJECT_COLOR_CLASSES = CHART_COLOR_CLASSES;

