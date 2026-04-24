/**
 * Phase E-1 Sprint 2.2: scheduleMeeting tool 스키마 검증 테스트.
 *
 * createPlan.test.ts 패턴 복제 — tool 은 execute-less durable pause 라
 * 실행 검증은 서버 액션 테스트(scheduleMeeting.test.ts)에서 수행. 여기서는
 * Layer 1 가드(roleFilter)와 입력 스키마 경계만 커버.
 */

import { describe, expect, it } from "vitest";
import { scheduleMeetingInputSchema } from "../scheduleMeeting";
import { ADMIN_ONLY_TOOL_NAMES } from "../_shared/roleFilter";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";

function validInput() {
  return {
    title: "김세린 수시 방향 면담",
    startAt: "2026-05-12T15:30:00+09:00",
    endAt: "2026-05-12T16:30:00+09:00",
    studentId: STUDENT_ID,
    studentName: "김세린",
  };
}

describe("scheduleMeeting tool", () => {
  describe("Layer 1 가드", () => {
    it("ADMIN_ONLY_TOOL_NAMES 에 포함된다", () => {
      expect(ADMIN_ONLY_TOOL_NAMES.has("scheduleMeeting")).toBe(true);
    });
  });

  describe("입력 스키마 — title", () => {
    it("빈 문자열 실패", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        title: "",
      });
      expect(r.success).toBe(false);
    });

    it("80자 경계는 통과, 81자는 실패", () => {
      const ok = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        title: "가".repeat(80),
      });
      const fail = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        title: "가".repeat(81),
      });
      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });
  });

  describe("입력 스키마 — startAt/endAt", () => {
    it("유효 ISO + start<end 는 통과", () => {
      const r = scheduleMeetingInputSchema.safeParse(validInput());
      expect(r.success).toBe(true);
    });

    it("endAt 이 startAt 이전이면 실패", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        startAt: "2026-05-12T16:30:00+09:00",
        endAt: "2026-05-12T15:30:00+09:00",
      });
      expect(r.success).toBe(false);
    });

    it("startAt==endAt 도 실패", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        startAt: "2026-05-12T15:30:00+09:00",
        endAt: "2026-05-12T15:30:00+09:00",
      });
      expect(r.success).toBe(false);
    });

    it("startAt 이 파싱 불가 문자열이면 실패", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        startAt: "not-a-date",
      });
      expect(r.success).toBe(false);
    });
  });

  describe("입력 스키마 — studentId", () => {
    it("UUID 아니면 실패", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        studentId: "not-uuid",
      });
      expect(r.success).toBe(false);
    });

    it("null 허용 (개인 일정)", () => {
      const r = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        studentId: null,
        studentName: null,
      });
      expect(r.success).toBe(true);
    });

    it("생략 허용 (개인 일정)", () => {
      const { studentId: _sid, studentName: _sn, ...rest } = validInput();
      const r = scheduleMeetingInputSchema.safeParse(rest);
      expect(r.success).toBe(true);
    });
  });

  describe("입력 스키마 — 선택 필드 경계", () => {
    it("location 200자 경계 · 201자 실패", () => {
      const ok = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        location: "가".repeat(200),
      });
      const fail = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        location: "가".repeat(201),
      });
      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });

    it("description 400자 경계 · 401자 실패", () => {
      const ok = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        description: "가".repeat(400),
      });
      const fail = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        description: "가".repeat(401),
      });
      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });

    it("syncGoogle boolean 허용 · 문자열은 실패", () => {
      const ok = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        syncGoogle: false,
      });
      const fail = scheduleMeetingInputSchema.safeParse({
        ...validInput(),
        syncGoogle: "false",
      });
      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });
  });
});
