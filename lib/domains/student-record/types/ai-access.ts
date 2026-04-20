// ============================================
// 학생 AI 에이전트 접근 권한 타입 (M0, 2026-04-20)
//
// 3-state enum — feedback_student-agent-opt-in-gate.md §권한 모델.
// ============================================

/**
 * 학생 대면 AI 에이전트 접근 레벨.
 *
 * `disabled` — AI 기능 완전 차단 (기본값). 학생은 AI 를 전혀 경험하지 않음.
 * `observer` — AI 가 학생 데이터를 분석해 컨설턴트 경로에 조언. 학생 직접 대화 X.
 * `active`   — AI 와 학생이 직접 대화 가능. **M0.5 의 ai_consent_grants 3자 서명(학생+학부모+컨설턴트) 필수.**
 *              M0 만 배포된 상태에서 `active` 는 internal alpha (Tier 1) 수동 승인용.
 */
export type AiAccessLevel = "disabled" | "observer" | "active";

export interface StudentAiAccess {
  readonly studentId: string;
  readonly tenantId: string;
  readonly accessLevel: AiAccessLevel;
  readonly grantedAt: string | null;
  readonly grantedBy: string | null;
  readonly lastRevokedAt: string | null;
  readonly revokeReason: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** 레벨 서열 — guard 비교용. active > observer > disabled. */
export const AI_ACCESS_LEVEL_ORDER: Record<AiAccessLevel, number> = {
  disabled: 0,
  observer: 1,
  active: 2,
} as const;

export function isAtLeast(
  current: AiAccessLevel,
  required: AiAccessLevel,
): boolean {
  return AI_ACCESS_LEVEL_ORDER[current] >= AI_ACCESS_LEVEL_ORDER[required];
}
