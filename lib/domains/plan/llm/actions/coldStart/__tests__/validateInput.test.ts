/**
 * Task 1: 입력 검증 테스트
 *
 * 사용자 입력을 검증하는 validateColdStartInput 함수를 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import {
  validateColdStartInput,
  getSupportedSubjectCategories,
  getSubjectsForCategory,
} from "../validateInput";

describe("validateColdStartInput", () => {
  // ──────────────────────────────────────────────────────────────────
  // 성공 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("성공 케이스", () => {
    it("필수값(교과)만 있으면 성공", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validatedInput.subjectCategory).toBe("수학");
        expect(result.validatedInput.subject).toBeNull();
        expect(result.validatedInput.difficulty).toBeNull();
        expect(result.validatedInput.contentType).toBeNull();
      }
    });

    it("모든 필드가 있으면 성공", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        subject: "미적분",
        difficulty: "개념",
        contentType: "book",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validatedInput.subjectCategory).toBe("수학");
        expect(result.validatedInput.subject).toBe("미적분");
        expect(result.validatedInput.difficulty).toBe("개념");
        expect(result.validatedInput.contentType).toBe("book");
      }
    });

    it("강의 타입도 성공", () => {
      const result = validateColdStartInput({
        subjectCategory: "영어",
        difficulty: "심화",
        contentType: "lecture",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validatedInput.contentType).toBe("lecture");
      }
    });

    it("모든 교과가 유효함", () => {
      const categories = ["국어", "수학", "영어", "한국사", "사회", "과학"];

      for (const category of categories) {
        const result = validateColdStartInput({ subjectCategory: category });
        expect(result.success).toBe(true);
      }
    });

    it("모든 난이도가 유효함", () => {
      const difficulties = ["개념", "기본", "심화"];

      for (const difficulty of difficulties) {
        const result = validateColdStartInput({
          subjectCategory: "수학",
          difficulty,
        });
        expect(result.success).toBe(true);
      }
    });

    it("앞뒤 공백이 있어도 trim 처리됨", () => {
      const result = validateColdStartInput({
        subjectCategory: "  수학  ",
        subject: " 미적분 ",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validatedInput.subjectCategory).toBe("수학");
        expect(result.validatedInput.subject).toBe("미적분");
      }
    });

    it("표준 과목 목록에 없는 과목도 허용 (경고만)", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        subject: "정수론", // 표준 목록에 없음
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.validatedInput.subject).toBe("정수론");
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 실패 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("실패 케이스", () => {
    it("교과가 없으면 실패", () => {
      const result = validateColdStartInput({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("교과를 선택해주세요");
      }
    });

    it("교과가 빈 문자열이면 실패", () => {
      const result = validateColdStartInput({
        subjectCategory: "",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("교과를 선택해주세요");
      }
    });

    it("교과가 공백만 있으면 실패", () => {
      const result = validateColdStartInput({
        subjectCategory: "   ",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("교과를 선택해주세요");
      }
    });

    it("지원하지 않는 교과면 실패", () => {
      const result = validateColdStartInput({
        subjectCategory: "체육",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("지원하지 않는 교과입니다");
        expect(result.error).toContain("체육");
      }
    });

    it("지원하지 않는 난이도면 실패", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        difficulty: "최상",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("지원하지 않는 난이도입니다");
        expect(result.error).toContain("최상");
      }
    });

    it("지원하지 않는 콘텐츠 타입이면 실패", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        contentType: "video",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("지원하지 않는 콘텐츠 타입입니다");
        expect(result.error).toContain("video");
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 유틸리티 함수 테스트
// ──────────────────────────────────────────────────────────────────

describe("유틸리티 함수", () => {
  describe("getSupportedSubjectCategories", () => {
    it("지원 교과 목록을 반환", () => {
      const categories = getSupportedSubjectCategories();

      expect(categories).toContain("국어");
      expect(categories).toContain("수학");
      expect(categories).toContain("영어");
      expect(categories.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("getSubjectsForCategory", () => {
    it("수학 교과의 과목 목록을 반환", () => {
      const subjects = getSubjectsForCategory("수학");

      expect(subjects).toContain("미적분");
      expect(subjects).toContain("확률과 통계");
      expect(subjects.length).toBeGreaterThan(0);
    });

    it("국어 교과의 과목 목록을 반환", () => {
      const subjects = getSubjectsForCategory("국어");

      expect(subjects).toContain("문학");
      expect(subjects).toContain("독서");
    });

    it("유효하지 않은 교과면 빈 배열 반환", () => {
      const subjects = getSubjectsForCategory("체육");

      expect(subjects).toEqual([]);
    });
  });
});
