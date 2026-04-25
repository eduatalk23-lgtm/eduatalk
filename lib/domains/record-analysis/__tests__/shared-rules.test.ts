// ============================================
// shared-rules — GENERIC_SLOGAN_PATTERNS + 헬퍼 단위 테스트
// ============================================

import { describe, it, expect } from "vitest";
import {
  GENERIC_SLOGAN_PATTERNS,
  checkNotEmpty,
  checkMinLength,
  checkDuplicate,
} from "../llm/validators/shared-rules";
import type { Violation } from "../llm/validators/types";

// ─────────────────────────────────────────────
// 1. GENERIC_SLOGAN_PATTERNS — 6종 합집합
// ─────────────────────────────────────────────

describe("GENERIC_SLOGAN_PATTERNS — 6종 합집합", () => {
  function matchesAny(text: string): boolean {
    return GENERIC_SLOGAN_PATTERNS.some((pat) => pat.test(text));
  }

  // 각 패턴 양성 케이스
  it("^더\\s*열심히 → match", () => {
    expect(matchesAny("더열심히 하겠습니다")).toBe(true);
    expect(matchesAny("더 열심히 노력")).toBe(true);
  });

  it("^꾸준히\\s*노력 → match", () => {
    expect(matchesAny("꾸준히노력하겠습니다")).toBe(true);
    expect(matchesAny("꾸준히 노력해야")).toBe(true);
  });

  it("^성실히\\s*임 → match", () => {
    expect(matchesAny("성실히임하겠습니다")).toBe(true);
    expect(matchesAny("성실히 임하며")).toBe(true);
  });

  it("^최선을\\s*다 → match", () => {
    expect(matchesAny("최선을다하겠습니다")).toBe(true);
    expect(matchesAny("최선을 다 할 것입니다")).toBe(true);
  });

  it("^열심히\\s*공부 → match (diagnosis에는 없던 패턴)", () => {
    expect(matchesAny("열심히공부하겠습니다")).toBe(true);
    expect(matchesAny("열심히 공부하여")).toBe(true);
  });

  it("^적극적으로\\s*참여 → match (diagnosis에는 없던 패턴)", () => {
    expect(matchesAny("적극적으로참여하겠습니다")).toBe(true);
    expect(matchesAny("적극적으로 참여하여")).toBe(true);
  });

  // 음성 케이스 — 실행 가능한 구체적 행동
  it("구체적 행동 문구는 match 안 함", () => {
    expect(matchesAny("Beer-Lambert 법칙을 중심으로 탐구 보고서 작성")).toBe(false);
    expect(matchesAny("의료영상 원리(CT/MRI) 심화 탐구 후 결론·제언 명시")).toBe(false);
    expect(matchesAny("매주 수업 후 교사 면담으로 피드백 수집")).toBe(false);
  });

  // 문자열 중간에 등장하면 match 안 함 (^앵커 확인)
  it("패턴이 문자열 중간에 있으면 match 안 함", () => {
    expect(matchesAny("이번 학기는 더 열심히 준비")).toBe(false);
    expect(matchesAny("목표를 위해 꾸준히 노력")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 2. checkNotEmpty
// ─────────────────────────────────────────────

describe("checkNotEmpty", () => {
  it("빈 문자열 → violation 추가 + true 반환", () => {
    const vs: Violation[] = [];
    const result = checkNotEmpty("", "RULE_EMPTY", "field[0]", vs);
    expect(result).toBe(true);
    expect(vs).toHaveLength(1);
    expect(vs[0].rule).toBe("RULE_EMPTY");
    expect(vs[0].severity).toBe("error");
    expect(vs[0].fieldPath).toBe("field[0]");
  });

  it("비지 않은 문자열 → violation 없음 + false 반환", () => {
    const vs: Violation[] = [];
    const result = checkNotEmpty("내용 있음", "RULE_EMPTY", "field[0]", vs);
    expect(result).toBe(false);
    expect(vs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 3. checkMinLength
// ─────────────────────────────────────────────

describe("checkMinLength", () => {
  it("길이 < min → warning violation 추가", () => {
    const vs: Violation[] = [];
    const shortText = "짧다"; // 2자
    checkMinLength(shortText, 15, "RULE_SHORT", "field[0]", vs);
    expect(vs).toHaveLength(1);
    expect(vs[0].rule).toBe("RULE_SHORT");
    expect(vs[0].severity).toBe("warning");
    expect(vs[0].actual).toBe(shortText.length); // 2
    expect(vs[0].expected).toBe(15);
  });

  it("길이 === min → violation 없음", () => {
    const vs: Violation[] = [];
    const text = "가".repeat(15);
    checkMinLength(text, 15, "RULE_SHORT", "field[0]", vs);
    expect(vs).toHaveLength(0);
  });

  it("길이 > min → violation 없음", () => {
    const vs: Violation[] = [];
    checkMinLength("충분히 긴 문장으로 작성된 강점 항목입니다", 15, "RULE_SHORT", "field[0]", vs);
    expect(vs).toHaveLength(0);
  });

  it("임계값 차이 보장 — 15 vs 30 독립 동작", () => {
    const vs15: Violation[] = [];
    const vs30: Violation[] = [];
    const text = "열다섯 자를 넘는 문장";
    // 11자 — 15에서 실패, 30에서도 실패
    checkMinLength(text, 15, "RULE_15", "f", vs15);
    checkMinLength(text, 30, "RULE_30", "f", vs30);
    expect(vs15).toHaveLength(1);
    expect(vs30).toHaveLength(1);
    expect(vs15[0].expected).toBe(15);
    expect(vs30[0].expected).toBe(30);
  });
});

// ─────────────────────────────────────────────
// 4. checkDuplicate
// ─────────────────────────────────────────────

describe("checkDuplicate", () => {
  it("세트에 없는 텍스트 → violation 없음", () => {
    const seen = new Set<string>();
    const vs: Violation[] = [];
    checkDuplicate(seen, "새 항목", "RULE_DUP", "field[0]", vs);
    expect(vs).toHaveLength(0);
  });

  it("세트에 이미 있는 텍스트 → error violation 추가", () => {
    const seen = new Set<string>(["중복된 항목"]);
    const vs: Violation[] = [];
    checkDuplicate(seen, "중복된 항목", "RULE_DUP", "field[1]", vs);
    expect(vs).toHaveLength(1);
    expect(vs[0].rule).toBe("RULE_DUP");
    expect(vs[0].severity).toBe("error");
    expect(vs[0].fieldPath).toBe("field[1]");
  });

  it("checkDuplicate는 세트에 add하지 않음 — 호출 측 책임", () => {
    const seen = new Set<string>();
    const vs: Violation[] = [];
    checkDuplicate(seen, "항목A", "RULE_DUP", "field[0]", vs);
    expect(seen.has("항목A")).toBe(false); // add는 호출 측에서
    expect(vs).toHaveLength(0);
  });

  it("actual은 40자 slice 보장", () => {
    const longText = "가".repeat(80);
    const seen = new Set<string>([longText]);
    const vs: Violation[] = [];
    checkDuplicate(seen, longText, "RULE_DUP", "field[1]", vs);
    expect(vs[0].actual).toHaveLength(40);
  });
});
