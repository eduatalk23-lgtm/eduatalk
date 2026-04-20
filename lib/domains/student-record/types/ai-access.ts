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

// ─── M0.5 Consent Grants ────────────────────────────────────

export type ConsentGrantLevel = "observer" | "active";

export interface AiConsentGrant {
  readonly id: string;
  readonly tenantId: string;
  readonly studentId: string;
  readonly grantedLevel: ConsentGrantLevel;
  readonly studentSignedAt: string | null;
  readonly studentUserId: string | null;
  readonly parentSignedAt: string | null;
  readonly parentUserId: string | null;
  readonly consultantSignedAt: string | null;
  readonly consultantUserId: string | null;
  readonly scope: Record<string, unknown>;
  readonly consentVersion: string;
  readonly consentNotes: string | null;
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedBy: string | null;
  readonly revokeReason: string | null;
  readonly recordedBy: string | null;
  readonly createdAt: string;
}

export interface GrantValidityCheck {
  readonly nowIso: string;
}

/**
 * 특정 시점(nowIso) 기준 grant 가 **현재 유효한가**를 판정.
 * 판정 규칙:
 *   - revokedAt 설정됨 → invalid
 *   - effectiveAt > now → invalid (미래 시점)
 *   - expiresAt !== null && expiresAt <= now → invalid (만료)
 *   - grantedLevel='active' 인데 3자 signed_at 중 하나라도 누락 → invalid
 *     (CHECK 제약으로 DB 레벨 방어되지만 UI·action 경로에서 이중 방어)
 */
export function isGrantCurrentlyValid(
  grant: AiConsentGrant,
  ctx: GrantValidityCheck,
): boolean {
  if (grant.revokedAt !== null) return false;

  const nowMs = Date.parse(ctx.nowIso);
  if (Number.isNaN(nowMs)) return false;

  const effectiveMs = Date.parse(grant.effectiveAt);
  if (Number.isNaN(effectiveMs) || effectiveMs > nowMs) return false;

  if (grant.expiresAt !== null) {
    const expMs = Date.parse(grant.expiresAt);
    if (Number.isNaN(expMs) || expMs <= nowMs) return false;
  }

  if (grant.grantedLevel === "active") {
    if (
      !grant.studentSignedAt ||
      !grant.parentSignedAt ||
      !grant.consultantSignedAt
    ) {
      return false;
    }
  }

  return true;
}
