/**
 * Phase E-1 Sprint 2.1: createPlan tool 스키마 검증 테스트.
 *
 * tool 은 execute 없는 durable pause 패턴이라 실행 검증은 서버 액션
 * (createPlan.test.ts) 에서 수행. 여기서는 Layer 1 가드(roleFilter)와 입력
 * 스키마 경계만 커버.
 */

import { describe, expect, it } from "vitest";
import { createPlanInputSchema } from "../createPlan";
import { ADMIN_ONLY_TOOL_NAMES } from "../_shared/roleFilter";

const STUDENT_ID = "11111111-1111-1111-1111-111111111111";
const SUBJECT_ID_A = "22222222-2222-2222-2222-222222222222";

function validCourse() {
  return {
    subjectId: SUBJECT_ID_A,
    subjectName: "경제수학",
    grade: 2 as const,
    semester: 2 as const,
  };
}

function validInput() {
  return {
    studentId: STUDENT_ID,
    studentName: "김세린",
    courses: [validCourse()],
  };
}

describe("createPlan tool", () => {
  describe("Layer 1 가드", () => {
    it("ADMIN_ONLY_TOOL_NAMES 에 포함된다", () => {
      expect(ADMIN_ONLY_TOOL_NAMES.has("createPlan")).toBe(true);
    });
  });

  describe("입력 스키마 — studentId", () => {
    it("UUID 가 아니면 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        studentId: "not-uuid",
      });
      expect(r.success).toBe(false);
    });

    it("유효 UUID 는 통과", () => {
      const r = createPlanInputSchema.safeParse(validInput());
      expect(r.success).toBe(true);
    });
  });

  describe("입력 스키마 — studentName", () => {
    it("빈 문자열 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        studentName: "",
      });
      expect(r.success).toBe(false);
    });

    it("40자 초과 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        studentName: "가".repeat(41),
      });
      expect(r.success).toBe(false);
    });
  });

  describe("입력 스키마 — courses 배열", () => {
    it("빈 배열 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [],
      });
      expect(r.success).toBe(false);
    });

    it("20건 초과 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: Array.from({ length: 21 }, () => validCourse()),
      });
      expect(r.success).toBe(false);
    });

    it("20건 경계는 통과", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: Array.from({ length: 20 }, () => validCourse()),
      });
      expect(r.success).toBe(true);
    });
  });

  describe("입력 스키마 — course 내부", () => {
    it("subjectId UUID 아니면 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), subjectId: "not-uuid" }],
      });
      expect(r.success).toBe(false);
    });

    it("grade 범위 밖(4) 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), grade: 4 }],
      });
      expect(r.success).toBe(false);
    });

    it("semester 범위 밖(3) 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), semester: 3 }],
      });
      expect(r.success).toBe(false);
    });

    it("priority null 허용", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), priority: null }],
      });
      expect(r.success).toBe(true);
    });

    it("priority 99 경계 통과 · 100 실패", () => {
      const ok = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), priority: 99 }],
      });
      const fail = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), priority: 100 }],
      });
      expect(ok.success).toBe(true);
      expect(fail.success).toBe(false);
    });

    it("notes 400자 초과 실패", () => {
      const r = createPlanInputSchema.safeParse({
        ...validInput(),
        courses: [{ ...validCourse(), notes: "가".repeat(401) }],
      });
      expect(r.success).toBe(false);
    });
  });
});
