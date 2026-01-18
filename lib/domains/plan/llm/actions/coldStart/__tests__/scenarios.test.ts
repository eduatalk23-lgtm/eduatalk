/**
 * Cold Start 파이프라인 - 다양한 교과/난이도 시나리오 테스트
 *
 * 모든 지원 교과와 난이도 조합에 대한 체계적인 테스트를 수행합니다.
 */

import { describe, it, expect } from "vitest";
import { runColdStartPipeline } from "../pipeline";
import { validateColdStartInput } from "../validateInput";
import { buildSearchQuery } from "../buildQuery";
import type { ColdStartRawInput } from "../types";

// ──────────────────────────────────────────────────────────────────
// 지원 교과/과목/난이도 목록
// ──────────────────────────────────────────────────────────────────

const SUPPORTED_SUBJECTS = {
  국어: ["문학", "독서", "화법과 작문", "언어와 매체"],
  수학: ["수학I", "수학II", "미적분", "확률과 통계", "기하"],
  영어: ["영어I", "영어II", "영어독해와작문"],
  한국사: [null], // 세부 과목 없음
  사회: ["생활과 윤리", "윤리와 사상", "한국지리", "세계지리", "동아시아사", "세계사", "정치와 법", "경제"],
  과학: ["물리학I", "물리학II", "화학I", "화학II", "생명과학I", "생명과학II", "지구과학I", "지구과학II"],
};

const DIFFICULTIES = ["개념", "기본", "심화"] as const;
const CONTENT_TYPES = ["book", "lecture"] as const;

// ──────────────────────────────────────────────────────────────────
// 교과별 파이프라인 테스트
// ──────────────────────────────────────────────────────────────────

describe("교과별 Cold Start 파이프라인", () => {
  describe.each(Object.keys(SUPPORTED_SUBJECTS))("%s 교과", (subjectCategory) => {
    it("기본 파이프라인 실행 성공", async () => {
      const result = await runColdStartPipeline(
        { subjectCategory },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.recommendations.length).toBeGreaterThan(0);
        expect(result.stats.searchQuery).toContain(subjectCategory);
      }
    });

    it("교재 타입으로 파이프라인 실행", async () => {
      const result = await runColdStartPipeline(
        { subjectCategory, contentType: "book" },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("교재");
      }
    });

    it("강의 타입으로 파이프라인 실행", async () => {
      const result = await runColdStartPipeline(
        { subjectCategory, contentType: "lecture" },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain("인강");
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 난이도별 테스트
// ──────────────────────────────────────────────────────────────────

describe("난이도별 Cold Start 파이프라인", () => {
  describe.each(DIFFICULTIES)("%s 난이도", (difficulty) => {
    it("수학 교과에서 난이도 적용", async () => {
      const result = await runColdStartPipeline(
        { subjectCategory: "수학", difficulty },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain(difficulty);
      }
    });

    it("영어 교과에서 난이도 적용", async () => {
      const result = await runColdStartPipeline(
        { subjectCategory: "영어", difficulty },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.stats.searchQuery).toContain(difficulty);
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 세부 과목별 테스트
// ──────────────────────────────────────────────────────────────────

describe("세부 과목별 Cold Start 파이프라인", () => {
  // 수학 과목들
  describe("수학 세부 과목", () => {
    const mathSubjects = SUPPORTED_SUBJECTS["수학"];

    it.each(mathSubjects)("%s 과목 파이프라인 실행", async (subject) => {
      const result = await runColdStartPipeline(
        { subjectCategory: "수학", subject },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success && subject) {
        expect(result.stats.searchQuery).toContain(subject);
      }
    });
  });

  // 과학 과목들
  describe("과학 세부 과목", () => {
    const scienceSubjects = SUPPORTED_SUBJECTS["과학"];

    it.each(scienceSubjects)("%s 과목 파이프라인 실행", async (subject) => {
      const result = await runColdStartPipeline(
        { subjectCategory: "과학", subject },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success && subject) {
        expect(result.stats.searchQuery).toContain(subject);
      }
    });
  });

  // 사회 과목들
  describe("사회 세부 과목", () => {
    const socialSubjects = SUPPORTED_SUBJECTS["사회"];

    it.each(socialSubjects)("%s 과목 파이프라인 실행", async (subject) => {
      const result = await runColdStartPipeline(
        { subjectCategory: "사회", subject },
        { useMock: true }
      );

      expect(result.success).toBe(true);
      if (result.success && subject) {
        expect(result.stats.searchQuery).toContain(subject);
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 입력 검증 시나리오
// ──────────────────────────────────────────────────────────────────

describe("입력 검증 시나리오", () => {
  describe("유효한 입력", () => {
    it.each(Object.keys(SUPPORTED_SUBJECTS))("%s 교과 검증 통과", (subjectCategory) => {
      const result = validateColdStartInput({ subjectCategory });
      expect(result.success).toBe(true);
    });

    it.each(DIFFICULTIES)("%s 난이도 검증 통과", (difficulty) => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        difficulty,
      });
      expect(result.success).toBe(true);
    });

    it.each(CONTENT_TYPES)("%s 콘텐츠 타입 검증 통과", (contentType) => {
      const result = validateColdStartInput({
        subjectCategory: "영어",
        contentType,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("무효한 입력", () => {
    it("지원하지 않는 교과 거부", () => {
      const result = validateColdStartInput({ subjectCategory: "체육" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("지원하지 않는 교과");
      }
    });

    it("지원하지 않는 난이도 거부", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        difficulty: "초급" as "개념",
      });
      expect(result.success).toBe(false);
    });

    it("지원하지 않는 콘텐츠 타입 거부", () => {
      const result = validateColdStartInput({
        subjectCategory: "수학",
        contentType: "video" as "book",
      });
      expect(result.success).toBe(false);
    });

    it("빈 교과명 거부", () => {
      const result = validateColdStartInput({ subjectCategory: "" });
      expect(result.success).toBe(false);
    });

    it("공백만 있는 교과명 거부", () => {
      const result = validateColdStartInput({ subjectCategory: "   " });
      expect(result.success).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 쿼리 생성 시나리오
// ──────────────────────────────────────────────────────────────────

describe("쿼리 생성 시나리오", () => {
  describe("전체 조합 테스트", () => {
    // 대표 조합 테스트
    const testCases: Array<{
      input: ColdStartRawInput;
      expectedContains: string[];
    }> = [
      {
        input: { subjectCategory: "수학", subject: "미적분", difficulty: "개념", contentType: "book" },
        expectedContains: ["수학", "미적분", "개념", "교재"],
      },
      {
        input: { subjectCategory: "영어", difficulty: "심화", contentType: "lecture" },
        expectedContains: ["영어", "심화", "인강"],
      },
      {
        input: { subjectCategory: "과학", subject: "물리학I", contentType: "book" },
        expectedContains: ["과학", "물리학I", "교재"],
      },
      {
        input: { subjectCategory: "사회", subject: "한국지리", difficulty: "기본" },
        expectedContains: ["사회", "한국지리", "기본"],
      },
      {
        input: { subjectCategory: "국어", subject: "문학" },
        expectedContains: ["국어", "문학"],
      },
    ];

    it.each(testCases)("조합: $input.subjectCategory + $input.subject", ({ input, expectedContains }) => {
      const validationResult = validateColdStartInput(input);
      expect(validationResult.success).toBe(true);

      if (validationResult.success) {
        const queryResult = buildSearchQuery(validationResult.validatedInput);

        expectedContains.forEach((keyword) => {
          expect(queryResult.query).toContain(keyword);
        });
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 옵션 조합 테스트
// ──────────────────────────────────────────────────────────────────

describe("파이프라인 옵션 조합", () => {
  it("useMock + preferences.maxResults", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학" },
      { useMock: true, preferences: { maxResults: 1 } }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.recommendations.length).toBeLessThanOrEqual(1);
    }
  });

  it("useMock + preferences.contentType 필터", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학" },
      { useMock: true, preferences: { contentType: "book" } }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      result.recommendations.forEach((rec) => {
        expect(rec.contentType).toBe("book");
      });
    }
  });

  it("saveToDb: false일 때 persistence 없음", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학" },
      { useMock: true, saveToDb: false }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.persistence).toBeUndefined();
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 추천 결과 검증
// ──────────────────────────────────────────────────────────────────

describe("추천 결과 품질 검증", () => {
  it("추천 항목에 필수 필드 존재", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학", subject: "미적분", contentType: "book" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      result.recommendations.forEach((rec) => {
        expect(rec.title).toBeDefined();
        expect(rec.title.length).toBeGreaterThan(0);
        expect(rec.contentType).toMatch(/^(book|lecture)$/);
        expect(rec.totalRange).toBeGreaterThan(0);
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(100);
        expect(rec.rank).toBeGreaterThan(0);
        expect(rec.reason).toBeDefined();
        expect(Array.isArray(rec.chapters)).toBe(true);
      });
    }
  });

  it("챕터 정보 유효성", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학", contentType: "book" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      result.recommendations.forEach((rec) => {
        rec.chapters.forEach((chapter) => {
          expect(chapter.title).toBeDefined();
          expect(chapter.startRange).toBeGreaterThanOrEqual(1);
          expect(chapter.endRange).toBeGreaterThanOrEqual(chapter.startRange);
        });
      });
    }
  });

  it("순위(rank)가 순차적으로 증가", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "영어" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success && result.recommendations.length > 1) {
      for (let i = 0; i < result.recommendations.length - 1; i++) {
        expect(result.recommendations[i].rank).toBeLessThan(
          result.recommendations[i + 1].rank
        );
      }
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// 통계 정보 검증
// ──────────────────────────────────────────────────────────────────

describe("통계 정보 검증", () => {
  it("stats.totalFound가 0 이상", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stats.totalFound).toBeGreaterThanOrEqual(0);
    }
  });

  it("stats.filtered가 totalFound 이하", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "수학" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stats.filtered).toBeLessThanOrEqual(result.stats.totalFound);
    }
  });

  it("stats.searchQuery가 비어있지 않음", async () => {
    const result = await runColdStartPipeline(
      { subjectCategory: "과학" },
      { useMock: true }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.stats.searchQuery.length).toBeGreaterThan(0);
    }
  });
});
