// ============================================
// 학생 AI 접근 권한 — 순수 비교 함수 단위 테스트 (M0, 2026-04-20)
//
// DB·네트워크 없음. isAtLeast 만 검증.
// ============================================

import { describe, it, expect } from "vitest";
import {
  AI_ACCESS_LEVEL_ORDER,
  isAtLeast,
  isGrantCurrentlyValid,
  type AiAccessLevel,
  type AiConsentGrant,
} from "../types/ai-access";

describe("AI_ACCESS_LEVEL_ORDER", () => {
  it("3 레벨 서열 고정: disabled < observer < active", () => {
    expect(AI_ACCESS_LEVEL_ORDER.disabled).toBeLessThan(
      AI_ACCESS_LEVEL_ORDER.observer,
    );
    expect(AI_ACCESS_LEVEL_ORDER.observer).toBeLessThan(
      AI_ACCESS_LEVEL_ORDER.active,
    );
  });
});

describe("isAtLeast", () => {
  const cases: Array<{
    current: AiAccessLevel;
    required: AiAccessLevel;
    expected: boolean;
  }> = [
    // 자기 자신 이상
    { current: "disabled", required: "disabled", expected: true },
    { current: "observer", required: "observer", expected: true },
    { current: "active", required: "active", expected: true },
    // 상위가 하위 이상 요구에 통과
    { current: "observer", required: "disabled", expected: true },
    { current: "active", required: "disabled", expected: true },
    { current: "active", required: "observer", expected: true },
    // 하위가 상위 요구에 실패
    { current: "disabled", required: "observer", expected: false },
    { current: "disabled", required: "active", expected: false },
    { current: "observer", required: "active", expected: false },
  ];

  for (const { current, required, expected } of cases) {
    it(`current=${current} required=${required} → ${expected}`, () => {
      expect(isAtLeast(current, required)).toBe(expected);
    });
  }
});

// ─── M0.5 isGrantCurrentlyValid ────────────────────────────────

function makeGrant(patch: Partial<AiConsentGrant> = {}): AiConsentGrant {
  return {
    id: "g1",
    tenantId: "t1",
    studentId: "s1",
    grantedLevel: "active",
    studentSignedAt: "2026-04-20T08:00:00Z",
    studentUserId: "u-s",
    parentSignedAt: "2026-04-20T08:05:00Z",
    parentUserId: "u-p",
    consultantSignedAt: "2026-04-20T08:10:00Z",
    consultantUserId: "u-c",
    scope: {},
    consentVersion: "ko-2026-07-v1",
    consentNotes: null,
    effectiveAt: "2026-04-20T08:15:00Z",
    expiresAt: null,
    revokedAt: null,
    revokedBy: null,
    revokeReason: null,
    recordedBy: "u-c",
    createdAt: "2026-04-20T08:15:00Z",
    ...patch,
  };
}

describe("isGrantCurrentlyValid", () => {
  const now = "2026-05-01T00:00:00Z";
  const ctx = { nowIso: now };

  it("정상 active grant → true", () => {
    expect(isGrantCurrentlyValid(makeGrant(), ctx)).toBe(true);
  });

  it("revoked → false", () => {
    expect(
      isGrantCurrentlyValid(
        makeGrant({ revokedAt: "2026-04-25T00:00:00Z" }),
        ctx,
      ),
    ).toBe(false);
  });

  it("effectiveAt 미래 → false", () => {
    expect(
      isGrantCurrentlyValid(
        makeGrant({ effectiveAt: "2026-06-01T00:00:00Z" }),
        ctx,
      ),
    ).toBe(false);
  });

  it("만료된 grant → false", () => {
    expect(
      isGrantCurrentlyValid(
        makeGrant({ expiresAt: "2026-04-30T23:59:00Z" }),
        ctx,
      ),
    ).toBe(false);
  });

  it("만료 미래 → true (유효)", () => {
    expect(
      isGrantCurrentlyValid(
        makeGrant({ expiresAt: "2027-01-01T00:00:00Z" }),
        ctx,
      ),
    ).toBe(true);
  });

  it("active 인데 학생 signed_at 누락 → false", () => {
    expect(
      isGrantCurrentlyValid(makeGrant({ studentSignedAt: null }), ctx),
    ).toBe(false);
  });

  it("active 인데 학부모 signed_at 누락 → false", () => {
    expect(
      isGrantCurrentlyValid(makeGrant({ parentSignedAt: null }), ctx),
    ).toBe(false);
  });

  it("active 인데 컨설턴트 signed_at 누락 → false", () => {
    expect(
      isGrantCurrentlyValid(makeGrant({ consultantSignedAt: null }), ctx),
    ).toBe(false);
  });

  it("observer 는 서명 누락이어도 true (CHECK 무관)", () => {
    expect(
      isGrantCurrentlyValid(
        makeGrant({
          grantedLevel: "observer",
          studentSignedAt: null,
          parentSignedAt: null,
          consultantSignedAt: null,
        }),
        ctx,
      ),
    ).toBe(true);
  });

  it("nowIso 파싱 실패 → false", () => {
    expect(isGrantCurrentlyValid(makeGrant(), { nowIso: "garbage" })).toBe(
      false,
    );
  });
});
