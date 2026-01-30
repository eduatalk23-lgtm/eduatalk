/**
 * Task 4: 결과 파싱 테스트
 *
 * AI 응답을 파싱하는 parseSearchResults 함수를 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import {
  parseSearchResults,
  isValidForPlanCreation,
  filterValidItems,
} from "../parseResults";

describe("parseSearchResults", () => {
  // ──────────────────────────────────────────────────────────────────
  // 성공 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("성공 케이스", () => {
    it("순수 JSON 파싱 성공", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            author: "이홍섭",
            publisher: "개념원리",
            contentType: "book",
            totalRange: 320,
            chapters: [
              { title: "1. 수열의 극한", startRange: 1, endRange: 80 },
              { title: "2. 미분법", startRange: 81, endRange: 200 },
              { title: "3. 적분법", startRange: 201, endRange: 320 },
            ],
            description: "개념 설명이 자세한 기본서",
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items).toHaveLength(1);
        expect(result.items[0].title).toBe("개념원리 미적분");
        expect(result.items[0].totalRange).toBe(320);
        expect(result.items[0].chapters).toHaveLength(3);
      }
    });

    it("마크다운 코드 블록 제거 후 파싱", () => {
      const rawContent = `\`\`\`json
{
  "results": [
    {
      "title": "수학의 정석",
      "contentType": "book",
      "totalRange": 500
    }
  ]
}
\`\`\``;

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].title).toBe("수학의 정석");
      }
    });

    it("``` 만 있는 코드 블록도 처리", () => {
      const rawContent = `\`\`\`
{"results": [{"title": "테스트", "totalRange": 100}]}
\`\`\``;

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
    });

    it("여러 항목 파싱", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "교재 A", totalRange: 300, contentType: "book" },
          { title: "강의 B", totalRange: 50, contentType: "lecture" },
          { title: "교재 C", totalRange: 200, contentType: "book" },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items).toHaveLength(3);
      }
    });

    it("배열만 있는 경우도 처리", () => {
      const rawContent = JSON.stringify([
        { title: "교재", totalRange: 300 },
      ]);

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
    });

    it("챕터가 없으면 기본 챕터 생성", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "교재", totalRange: 300 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].chapters).toHaveLength(1);
        expect(result.items[0].chapters[0].title).toBe("전체");
        expect(result.items[0].chapters[0].startRange).toBe(1);
        expect(result.items[0].chapters[0].endRange).toBe(300);
      }
    });

    it("contentType 없으면 제목에서 추론 - 강의", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "수학 개념 강의", totalRange: 30 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].contentType).toBe("lecture");
      }
    });

    it("contentType 없으면 기본값 book", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "수학의 정석", totalRange: 500 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].contentType).toBe("book");
      }
    });

    it("추천 근거 필드 파싱 - recommendationReasons", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            totalRange: 320,
            contentType: "book",
            recommendationReasons: [
              "기초 개념을 단계별로 설명",
              "풍부한 예제와 연습문제",
              "수능 출제 경향 반영",
            ],
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].recommendationReasons).toHaveLength(3);
        expect(result.items[0].recommendationReasons![0]).toBe("기초 개념을 단계별로 설명");
      }
    });

    it("추천 근거 필드 파싱 - targetStudents", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            totalRange: 320,
            contentType: "book",
            targetStudents: ["기초가 부족한 학생", "수능 준비생"],
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].targetStudents).toHaveLength(2);
        expect(result.items[0].targetStudents![0]).toBe("기초가 부족한 학생");
      }
    });

    it("추천 근거 필드 파싱 - reviewSummary", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            totalRange: 320,
            contentType: "book",
            reviewSummary: {
              averageRating: 4.5,
              reviewCount: 1200,
              positives: ["설명이 쉽다", "구성이 체계적"],
              negatives: ["문제 수가 적다"],
              keywords: ["기초", "개념", "입문"],
            },
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].reviewSummary).toBeDefined();
        expect(result.items[0].reviewSummary!.averageRating).toBe(4.5);
        expect(result.items[0].reviewSummary!.reviewCount).toBe(1200);
        expect(result.items[0].reviewSummary!.positives).toHaveLength(2);
        expect(result.items[0].reviewSummary!.negatives).toHaveLength(1);
        expect(result.items[0].reviewSummary!.keywords).toHaveLength(3);
      }
    });

    it("추천 근거 필드 파싱 - strengths와 weaknesses", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            totalRange: 320,
            contentType: "book",
            strengths: ["단계별 학습 가능", "핵심 정리 제공"],
            weaknesses: ["심화 문제 부족"],
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].strengths).toHaveLength(2);
        expect(result.items[0].weaknesses).toHaveLength(1);
      }
    });

    it("추천 근거 필드 - 전체 통합 파싱", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "개념원리 미적분",
            author: "이홍섭",
            publisher: "개념원리",
            contentType: "book",
            totalRange: 320,
            chapters: [
              { title: "1. 수열의 극한", startRange: 1, endRange: 100 },
            ],
            description: "개념 설명이 자세한 기본서",
            recommendationReasons: [
              "기초 개념을 단계별로 설명",
              "풍부한 예제와 연습문제",
            ],
            targetStudents: ["기초가 부족한 학생", "수능 준비생"],
            reviewSummary: {
              averageRating: 4.5,
              reviewCount: 1200,
              positives: ["설명이 쉽다"],
              negatives: ["문제 수가 적다"],
              keywords: ["기초", "개념"],
            },
            strengths: ["단계별 학습 가능"],
            weaknesses: ["심화 문제 부족"],
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        const item = result.items[0];
        // 기본 필드
        expect(item.title).toBe("개념원리 미적분");
        expect(item.author).toBe("이홍섭");
        // 추천 근거 필드
        expect(item.recommendationReasons).toHaveLength(2);
        expect(item.targetStudents).toHaveLength(2);
        expect(item.reviewSummary).toBeDefined();
        expect(item.strengths).toHaveLength(1);
        expect(item.weaknesses).toHaveLength(1);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 부분 성공 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("부분 성공 케이스", () => {
    it("일부 항목만 유효한 경우 유효한 것만 반환", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "유효한 교재", totalRange: 300 },
          { title: "", totalRange: 100 }, // title 비어있음
          { title: "또 다른 유효한 교재", totalRange: 200 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items).toHaveLength(2);
      }
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 실패 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("실패 케이스", () => {
    it("빈 문자열이면 실패", () => {
      const result = parseSearchResults("");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("비어있습니다");
      }
    });

    it("유효하지 않은 JSON이면 실패", () => {
      const result = parseSearchResults("이것은 JSON이 아닙니다");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("JSON");
      }
    });

    it("results 배열이 없으면 실패", () => {
      const rawContent = JSON.stringify({ data: [] });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("results");
      }
    });

    it("빈 results 배열이면 실패", () => {
      const rawContent = JSON.stringify({ results: [] });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("검색 결과가 없습니다");
      }
    });

    it("모든 항목이 유효하지 않으면 실패", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "", totalRange: 100 },
          { title: "제목만 있음" }, // totalRange 없음
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(false);
    });

    it("totalRange가 0이면 실패", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "교재", totalRange: 0 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(false);
    });

    it("totalRange가 음수면 실패", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "교재", totalRange: -100 },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(false);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 엣지 케이스
  // ──────────────────────────────────────────────────────────────────

  describe("엣지 케이스", () => {
    it("totalRange가 문자열 숫자면 파싱", () => {
      const rawContent = JSON.stringify({
        results: [
          { title: "교재", totalRange: "300" },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].totalRange).toBe(300);
      }
    });

    it("앞뒤 공백 제거", () => {
      const rawContent = JSON.stringify({
        results: [
          {
            title: "  교재 제목  ",
            author: " 저자명 ",
            totalRange: 300,
          },
        ],
      });

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items[0].title).toBe("교재 제목");
        expect(result.items[0].author).toBe("저자명");
      }
    });

    it("JSON 앞뒤에 설명 텍스트가 있어도 추출", () => {
      const rawContent = `
여기에 결과가 있습니다:

{"results": [{"title": "교재", "totalRange": 300}]}

위 내용을 참고하세요.
`;

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
    });

    it("잘린 JSON 복구 - 닫는 괄호 누락", () => {
      // 응답이 토큰 한도로 끊긴 경우
      const rawContent = `\`\`\`json
{
  "results": [
    {"title": "완전한 교재", "totalRange": 300},
    {"title": "불완전한 교재", "totalRange": 200
`;

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        // 최소한 첫 번째 완전한 항목은 파싱되어야 함
        expect(result.items.length).toBeGreaterThanOrEqual(1);
        expect(result.items[0].title).toBe("완전한 교재");
      }
    });

    it("잘린 JSON 복구 - 여러 완전한 항목 후 불완전한 항목", () => {
      const rawContent = `{
  "results": [
    {"title": "교재 1", "totalRange": 100, "contentType": "book"},
    {"title": "교재 2", "totalRange": 200, "contentType": "book"},
    {"title": "교재 3", "totalRange": 300, "contentType": "book"},
    {"title": "잘린 교재", "totalRange"`;

      const result = parseSearchResults(rawContent);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.items.length).toBe(3);
        expect(result.items[0].title).toBe("교재 1");
        expect(result.items[2].title).toBe("교재 3");
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────
// 유틸리티 함수 테스트
// ──────────────────────────────────────────────────────────────────

describe("isValidForPlanCreation", () => {
  it("유효한 항목이면 true", () => {
    const item = {
      title: "교재",
      contentType: "book" as const,
      totalRange: 300,
      chapters: [
        { title: "1장", startRange: 1, endRange: 100 },
        { title: "2장", startRange: 101, endRange: 300 },
      ],
    };

    expect(isValidForPlanCreation(item)).toBe(true);
  });

  it("챕터가 비어있으면 false", () => {
    const item = {
      title: "교재",
      contentType: "book" as const,
      totalRange: 300,
      chapters: [],
    };

    expect(isValidForPlanCreation(item)).toBe(false);
  });

  it("챕터 범위가 이상하면 false", () => {
    const item = {
      title: "교재",
      contentType: "book" as const,
      totalRange: 300,
      chapters: [
        { title: "1장", startRange: 100, endRange: 50 }, // start > end
      ],
    };

    expect(isValidForPlanCreation(item)).toBe(false);
  });
});

describe("filterValidItems", () => {
  it("유효한 항목만 필터링", () => {
    const items = [
      {
        title: "유효",
        contentType: "book" as const,
        totalRange: 300,
        chapters: [{ title: "1장", startRange: 1, endRange: 300 }],
      },
      {
        title: "무효",
        contentType: "book" as const,
        totalRange: 300,
        chapters: [], // 챕터 없음
      },
    ];

    const filtered = filterValidItems(items);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].title).toBe("유효");
  });
});
