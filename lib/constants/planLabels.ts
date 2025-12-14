/**
 * 플랜 그룹 관련 라벨 상수 정의
 */

export const weekdayLabels = [
  "일요일",
  "월요일",
  "화요일",
  "수요일",
  "목요일",
  "금요일",
  "토요일",
] as const;

export const planPurposeLabels: Record<string, string> = {
  내신대비: "내신대비",
  모의고사: "모의고사(수능)",
  수능: "모의고사(수능)",
  "모의고사(수능)": "모의고사(수능)",
  기타: "기타", // 하위 호환성을 위해 유지 (UI에서는 사용하지 않음)
};

export const schedulerTypeLabels: Record<string, string> = {
  성적기반: "성적 기반 배정",
  "1730_timetable": "1730 Timetable (6일 학습, 1일 복습)",
  전략취약과목: "전략/취약과목 학습일 조정",
  커스텀: "커스텀",
};

export const statusLabels: Record<string, string> = {
  active: "활성",
  paused: "일시정지",
  completed: "완료",
  cancelled: "중단", // 기존 데이터 호환성을 위해 유지 (새로는 paused 사용)
};

import { planStatusColors } from "@/lib/utils/darkMode";

/**
 * @deprecated planStatusColors 사용 권장
 * 기존 코드 호환성을 위해 유지
 */
export const statusColors: Record<string, string> = planStatusColors;

export const contentTypeLabels: Record<string, string> = {
  book: "📚 책",
  lecture: "🎧 강의",
  custom: "📝 커스텀",
};

