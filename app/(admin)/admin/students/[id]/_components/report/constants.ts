// ============================================
// 리포트 섹션 공통 상수
// ============================================

/** 전략 우선순위 라벨 */
export const PRIORITY_LABELS: Record<string, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

/** 전략/요약서 상태 라벨 */
export const STATUS_LABELS: Record<string, string> = {
  planned: "예정",
  in_progress: "진행 중",
  done: "완료",
  draft: "초안",
  confirmed: "확정",
  published: "발행",
};

/** 스토리라인 강도 배지 */
export const STRENGTH_BADGE: Record<string, { label: string; color: string }> = {
  strong: { label: "강", color: "text-emerald-700 bg-emerald-50" },
  moderate: { label: "중", color: "text-amber-700 bg-amber-50" },
  weak: { label: "약", color: "text-red-600 bg-red-50" },
};

/** 전략 우선순위 색상 */
export const PRIORITY_COLORS: Record<string, string> = {
  critical: "border-red-300 bg-red-50 text-red-800",
  high: "border-orange-300 bg-orange-50 text-orange-800",
  medium: "border-amber-300 bg-amber-50 text-amber-800",
  low: "border-gray-300 bg-gray-50 text-gray-700",
};

/** 면접 질문 유형 라벨 */
export const QUESTION_TYPE_LABELS: Record<string, string> = {
  factual: "사실 확인",
  reasoning: "추론·동기",
  application: "적용·계획",
  value: "가치·성찰",
  controversial: "비판적 사고",
};

/** 난이도 배지 */
export const DIFFICULTY_BADGE: Record<string, { label: string; cls: string }> = {
  easy: { label: "기본", cls: "bg-emerald-50 text-emerald-700" },
  medium: { label: "보통", cls: "bg-amber-50 text-amber-700" },
  hard: { label: "심화", cls: "bg-red-50 text-red-700" },
};
