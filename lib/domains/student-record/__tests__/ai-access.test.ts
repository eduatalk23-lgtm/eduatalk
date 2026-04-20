// ============================================
// 학생 AI 접근 권한 — 순수 비교 함수 단위 테스트 (M0, 2026-04-20)
//
// DB·네트워크 없음. isAtLeast 만 검증.
// ============================================

import { describe, it, expect } from "vitest";
import {
  AI_ACCESS_LEVEL_ORDER,
  isAtLeast,
  type AiAccessLevel,
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
