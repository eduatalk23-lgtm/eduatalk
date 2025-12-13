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

export type DayType = "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정" | "normal";

/**
 * 날짜 타입별 색상 반환
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
  // 오늘 날짜는 최우선
  if (isToday) {
    return {
      bg: "bg-primary-50",
      border: "border-primary-300",
      text: "text-primary-600",
      boldText: "text-primary-900",
      badge: "bg-primary-100 text-primary-800",
    };
  }

  // 휴일 처리
  if (
    dayType === "지정휴일" ||
    dayType === "휴가" ||
    dayType === "개인일정"
  ) {
    return {
      bg: "bg-error-50",
      border: "border-error-300",
      text: "text-error-600",
      boldText: "text-error-900",
      badge: "bg-error-100 text-error-800",
    };
  }

  // 학습일
  if (dayType === "학습일") {
    return {
      bg: "bg-info-50",
      border: "border-info-300",
      text: "text-info-600",
      boldText: "text-info-900",
      badge: "bg-info-100 text-info-800",
    };
  }

  // 복습일
  if (dayType === "복습일") {
    return {
      bg: "bg-warning-50",
      border: "border-warning-300",
      text: "text-warning-600",
      boldText: "text-warning-900",
      badge: "bg-warning-100 text-warning-800",
    };
  }

  // 일반 날짜
  return {
    bg: "bg-white",
    border: "border-secondary-200",
    text: "text-secondary-600",
    boldText: "text-secondary-900",
    badge: "bg-secondary-100 text-secondary-800",
  };
}

// ============================================
// Risk Colors (위험도 색상)
// ============================================

/**
 * 위험도 점수에 따른 색상 반환
 */
export function getRiskColor(riskScore: number): {
  text: string;
  bg: string;
  border: string;
  badge: string;
  hex: string; // 차트 라이브러리용
} {
  if (riskScore >= 70) {
    // 매우 위험
    return {
      text: "text-error-700",
      bg: "bg-error-50",
      border: "border-error-300",
      badge: "bg-error-600 text-white",
      hex: "#ef4444", // red-500
    };
  }
  if (riskScore >= 50) {
    // 위험
    return {
      text: "text-warning-700",
      bg: "bg-warning-50",
      border: "border-warning-300",
      badge: "bg-warning-500 text-white",
      hex: "#f59e0b", // amber-500
    };
  }
  if (riskScore >= 30) {
    // 주의
    return {
      text: "text-warning-600",
      bg: "bg-warning-50",
      border: "border-warning-200",
      badge: "bg-warning-400 text-white",
      hex: "#eab308", // yellow-500
    };
  }
  // 양호
  return {
    text: "text-success-700",
    bg: "bg-success-50",
    border: "border-success-200",
    badge: "bg-success-500 text-white",
    hex: "#10b981", // emerald-500
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
      text: "text-success-700",
      bg: "bg-success-50",
      icon: "↑",
    };
  }
  if (trend === "declined") {
    return {
      text: "text-error-700",
      bg: "bg-error-50",
      icon: "↓",
    };
  }
  return {
    text: "text-secondary-600",
    bg: "bg-secondary-50",
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

