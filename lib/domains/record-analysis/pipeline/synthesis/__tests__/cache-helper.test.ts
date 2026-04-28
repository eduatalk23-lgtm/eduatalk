import { describe, it, expect } from "vitest";
import {
  computeSynthesisInputHash,
  tryReusePreviousResult,
  djb2Hex,
} from "../cache-helper";
import type { PreviousRunOutputs } from "../../pipeline-types";

describe("cache-helper", () => {
  describe("djb2Hex", () => {
    it("결정적 hash — 같은 입력 같은 출력", () => {
      expect(djb2Hex("hello")).toBe(djb2Hex("hello"));
    });

    it("입력 다르면 hash 다름", () => {
      expect(djb2Hex("hello")).not.toBe(djb2Hex("world"));
    });

    it("출력 8자리 hex", () => {
      expect(djb2Hex("test")).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe("computeSynthesisInputHash", () => {
    it("key 순서 무관 — object key 정렬 후 hash", () => {
      const a = computeSynthesisInputHash({ x: 1, y: 2, z: 3 });
      const b = computeSynthesisInputHash({ z: 3, y: 2, x: 1 });
      expect(a).toBe(b);
    });

    it("nested object key 도 정렬", () => {
      const a = computeSynthesisInputHash({ outer: { a: 1, b: 2 } });
      const b = computeSynthesisInputHash({ outer: { b: 2, a: 1 } });
      expect(a).toBe(b);
    });

    it("배열 순서는 의미 있음", () => {
      const a = computeSynthesisInputHash({ list: [1, 2, 3] });
      const b = computeSynthesisInputHash({ list: [3, 2, 1] });
      expect(a).not.toBe(b);
    });

    it("값 다르면 hash 다름", () => {
      const a = computeSynthesisInputHash({ x: 1 });
      const b = computeSynthesisInputHash({ x: 2 });
      expect(a).not.toBe(b);
    });

    it("null / undefined 구분", () => {
      const a = computeSynthesisInputHash({ x: null });
      const b = computeSynthesisInputHash({ x: undefined });
      // JSON.stringify(undefined) === undefined → 키 자체가 빠짐
      // null → "null" 문자열
      expect(a).not.toBe(b);
    });
  });

  describe("tryReusePreviousResult", () => {
    const baseResult = {
      inputHash: "abc12345",
      overallGrade: "B+",
      weaknessCount: 3,
    };

    const prev: PreviousRunOutputs = {
      runId: "run-1",
      completedAt: "2026-04-28T00:00:00Z",
      taskResults: { ai_diagnosis: baseResult },
    };

    it("hash 일치 → prev result 반환", () => {
      const r = tryReusePreviousResult<typeof baseResult>(
        prev,
        "ai_diagnosis",
        "abc12345",
      );
      expect(r).not.toBeNull();
      expect(r?.overallGrade).toBe("B+");
    });

    it("hash 불일치 → null", () => {
      const r = tryReusePreviousResult(prev, "ai_diagnosis", "different");
      expect(r).toBeNull();
    });

    it("prev 없음 → null", () => {
      expect(tryReusePreviousResult(undefined, "ai_diagnosis", "x")).toBeNull();
    });

    it("prev runId null (최초 실행) → null", () => {
      const empty: PreviousRunOutputs = { runId: null, completedAt: null, taskResults: {} };
      expect(tryReusePreviousResult(empty, "ai_diagnosis", "x")).toBeNull();
    });

    it("task key 미존재 → null", () => {
      expect(tryReusePreviousResult(prev, "ai_strategy", "abc12345")).toBeNull();
    });

    it("prev result 에 inputHash 필드 부재 → null", () => {
      const noHash: PreviousRunOutputs = {
        runId: "run-1",
        completedAt: "2026-04-28T00:00:00Z",
        taskResults: { ai_diagnosis: { overallGrade: "B+" } as Record<string, unknown> },
      };
      expect(tryReusePreviousResult(noHash, "ai_diagnosis", "abc")).toBeNull();
    });
  });
});
