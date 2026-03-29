// ============================================
// Agent Actions — 에이전트 → UI 네비게이션 액션 타입
// 도구 결과에 포함되어 클라이언트에서 해석
// ============================================

export type AgentAction =
  | { type: "navigate_section"; sectionId: string }
  | { type: "navigate_tab"; tab: string }
  | { type: "focus_subject"; subjectName: string; schoolYear: number }
  | { type: "change_view_mode"; viewMode: "all" | number }
  | { type: "open_side_panel"; app: string };

/** 도구 결과에 포함된 action 필드 파싱 (안전한 타입 가드) */
export function isAgentAction(value: unknown): value is AgentAction {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.type !== "string") return false;
  return [
    "navigate_section",
    "navigate_tab",
    "focus_subject",
    "change_view_mode",
    "open_side_panel",
  ].includes(v.type);
}
