/**
 * Task 2: 쿼리 생성 테스트
 *
 * 검증된 입력값을 검색 쿼리로 변환하는 buildSearchQuery 함수를 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import { buildSearchQuery, buildAdvancedSearchQuery } from "../buildQuery";
import type { ValidatedColdStartInput } from "../types";

describe("buildSearchQuery", () => {
  // ──────────────────────────────────────────────────────────────────
  // 기본 쿼리 생성
  // ──────────────────────────────────────────────────────────────────

  describe("기본 쿼리 생성", () => {
    it("교재 검색 쿼리 생성", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "수학",
        subject: "미적분",
        difficulty: "개념",
        contentType: "book",
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 수학 미적분 개념 교재 추천 목차");
      expect(result.context).toBe("미적분 개념서");
    });

    it("강의 검색 쿼리 생성", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "영어",
        subject: null,
        difficulty: "심화",
        contentType: "lecture",
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 영어 심화 인강 추천 강의 목록");
      expect(result.context).toBe("영어 심화강의");
    });

    it("타입 미지정 시 일반 학습자료 검색", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "국어",
        subject: "문학",
        difficulty: "기본",
        contentType: null,
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 국어 문학 기본 학습자료 추천");
      expect(result.context).toBe("문학 기본 학습자료");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 선택 필드 조합
  // ──────────────────────────────────────────────────────────────────

  describe("선택 필드 조합", () => {
    it("교과만 있는 경우", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "과학",
        subject: null,
        difficulty: null,
        contentType: null,
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 과학 학습자료 추천");
      expect(result.context).toBe("과학 학습자료");
    });

    it("교과 + 과목만 있는 경우", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "과학",
        subject: "물리학I",
        difficulty: null,
        contentType: null,
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 과학 물리학I 학습자료 추천");
      expect(result.context).toBe("물리학I 학습자료");
    });

    it("교과 + 난이도만 있는 경우", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "한국사",
        subject: null,
        difficulty: "심화",
        contentType: null,
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 한국사 심화 학습자료 추천");
      expect(result.context).toBe("한국사 심화 학습자료");
    });

    it("교과 + 타입만 있는 경우", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "사회",
        subject: null,
        difficulty: null,
        contentType: "book",
      };

      const result = buildSearchQuery(input);

      expect(result.query).toBe("고등학교 사회 교재 추천 목차");
      expect(result.context).toBe("사회 서");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 맥락(context) 생성
  // ──────────────────────────────────────────────────────────────────

  describe("맥락(context) 생성", () => {
    it("과목이 있으면 과목 기준으로 맥락 생성", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "수학",
        subject: "확률과 통계",
        difficulty: "기본",
        contentType: "book",
      };

      const result = buildSearchQuery(input);

      // 과목명(확률과 통계)이 맥락에 포함
      expect(result.context).toBe("확률과 통계 기본서");
    });

    it("과목이 없으면 교과 기준으로 맥락 생성", () => {
      const input: ValidatedColdStartInput = {
        subjectCategory: "영어",
        subject: null,
        difficulty: "개념",
        contentType: "lecture",
      };

      const result = buildSearchQuery(input);

      // 교과명(영어)이 맥락에 포함
      expect(result.context).toBe("영어 개념강의");
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 고급 쿼리 생성
// ──────────────────────────────────────────────────────────────────

describe("buildAdvancedSearchQuery", () => {
  it("학년 옵션 적용", () => {
    const input: ValidatedColdStartInput = {
      subjectCategory: "수학",
      subject: "수학II",
      difficulty: "기본",
      contentType: "book",
    };

    const result = buildAdvancedSearchQuery(input, { grade: 2 });

    expect(result.query).toContain("고2");
    expect(result.query).not.toContain("고등학교");
  });

  it("추가 키워드 옵션 적용", () => {
    const input: ValidatedColdStartInput = {
      subjectCategory: "수학",
      subject: null,
      difficulty: "심화",
      contentType: "book",
    };

    const result = buildAdvancedSearchQuery(input, {
      additionalKeywords: "수능 대비",
    });

    expect(result.query).toContain("수능 대비");
  });

  it("선호 출판사 옵션 적용", () => {
    const input: ValidatedColdStartInput = {
      subjectCategory: "수학",
      subject: null,
      difficulty: null,
      contentType: "book",
    };

    const result = buildAdvancedSearchQuery(input, {
      preferredPublisher: "개념원리",
    });

    expect(result.query).toContain("개념원리");
  });

  it("모든 옵션 조합", () => {
    const input: ValidatedColdStartInput = {
      subjectCategory: "영어",
      subject: "영어I",
      difficulty: "기본",
      contentType: "lecture",
    };

    const result = buildAdvancedSearchQuery(input, {
      grade: 1,
      additionalKeywords: "내신 대비",
      preferredPublisher: "메가스터디",
    });

    expect(result.query).toContain("고1");
    expect(result.query).toContain("영어I");
    expect(result.query).toContain("내신 대비");
    expect(result.query).toContain("메가스터디");
  });
});
