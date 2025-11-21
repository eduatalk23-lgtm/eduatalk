/**
 * 성적 등급별 색상 시스템
 */

export function getGradeColor(grade: number | null | undefined): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  if (grade === null || grade === undefined) {
    return {
      text: "text-gray-600",
      bg: "bg-gray-50",
      border: "border-gray-200",
      badge: "bg-gray-100 text-gray-700",
    };
  }

  // 등급별 색상 매핑 (1등급이 가장 좋음)
  if (grade <= 1) {
    return {
      text: "text-blue-700",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-600 text-white",
    };
  }
  if (grade <= 2) {
    return {
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      badge: "bg-blue-500 text-white",
    };
  }
  if (grade <= 3) {
    return {
      text: "text-indigo-600",
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      badge: "bg-indigo-500 text-white",
    };
  }
  if (grade <= 4) {
    return {
      text: "text-gray-600",
      bg: "bg-gray-50",
      border: "border-gray-200",
      badge: "bg-gray-500 text-white",
    };
  }
  if (grade <= 5) {
    return {
      text: "text-yellow-700",
      bg: "bg-yellow-50",
      border: "border-yellow-200",
      badge: "bg-yellow-500 text-white",
    };
  }
  if (grade <= 6) {
    return {
      text: "text-orange-600",
      bg: "bg-orange-50",
      border: "border-orange-200",
      badge: "bg-orange-500 text-white",
    };
  }
  if (grade <= 7) {
    return {
      text: "text-red-600",
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-500 text-white",
    };
  }
  // 8-9등급
  return {
    text: "text-red-700",
    bg: "bg-red-100",
    border: "border-red-300",
    badge: "bg-red-600 text-white",
  };
}

export function getTrendColor(trend: "improved" | "declined" | "stable" | null): {
  text: string;
  bg: string;
  icon: string;
} {
  if (trend === "improved") {
    return {
      text: "text-green-700",
      bg: "bg-green-50",
      icon: "↑",
    };
  }
  if (trend === "declined") {
    return {
      text: "text-red-700",
      bg: "bg-red-50",
      icon: "↓",
    };
  }
  return {
    text: "text-gray-600",
    bg: "bg-gray-50",
    icon: "→",
  };
}

