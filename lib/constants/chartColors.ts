/**
 * 차트 및 UI에서 사용하는 공통 컬러 팔레트
 */

// 과목별 차트 색상 (8색)
export const SUBJECT_COLORS = [
  "#6366f1", // indigo-500
  "#8b5cf6", // purple-500
  "#ec4899", // pink-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#ef4444", // red-500
  "#14b8a6", // teal-500
] as const;

// Tailwind 클래스 매핑 (인라인 스타일 제거용)
export const SUBJECT_COLOR_CLASSES = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-red-500",
  "bg-teal-500",
] as const;

/**
 * 인덱스에 따른 색상 반환 (차트 라이브러리용 hex)
 */
export function getSubjectColor(index: number): string {
  return SUBJECT_COLORS[index % SUBJECT_COLORS.length];
}

/**
 * 인덱스에 따른 Tailwind 클래스 반환 (UI 컴포넌트용)
 */
export function getSubjectColorClass(index: number): string {
  return SUBJECT_COLOR_CLASSES[index % SUBJECT_COLOR_CLASSES.length];
}

