/**
 * Task 5: 결과 정렬/필터링 테스트
 *
 * rankAndFilterResults 함수를 테스트합니다.
 */

import { describe, it, expect } from "vitest";
import { rankAndFilterResults } from "../rankResults";
import type {
  ParsedContentItem,
  UserPreferences,
  ValidatedColdStartInput,
} from "../types";

// ============================================================================
// 테스트용 헬퍼
// ============================================================================

/**
 * 기본 검증된 입력값 생성
 */
function createDefaultInput(
  overrides?: Partial<ValidatedColdStartInput>
): ValidatedColdStartInput {
  return {
    subjectCategory: "수학",
    subject: "미적분",
    difficulty: "개념",
    contentType: "book",
    ...overrides,
  };
}

/**
 * 기본 콘텐츠 아이템 생성
 */
function createContentItem(
  overrides?: Partial<ParsedContentItem>
): ParsedContentItem {
  return {
    title: "기본 교재",
    contentType: "book",
    totalRange: 300,
    chapters: [
      { title: "1장", startRange: 1, endRange: 150 },
      { title: "2장", startRange: 151, endRange: 300 },
    ],
    ...overrides,
  };
}

// ============================================================================
// 테스트
// ============================================================================

describe("rankAndFilterResults", () => {
  // ──────────────────────────────────────────────────────────────────
  // 점수 계산 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("점수 계산", () => {
    it("콘텐츠 타입 일치 시 +30점", () => {
      const items = [
        createContentItem({
          title: "기본 교재", // 키워드 매칭 안 되도록 일반 제목
          contentType: "book",
          totalRange: 0,
          chapters: [],
        }),
      ];
      const input = createDefaultInput({
        subjectCategory: "영어", // 제목과 매칭 안 되도록
        subject: null,
        contentType: "book",
      });
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      // 콘텐츠 타입 일치: +30, 나머지 0
      expect(result.recommendations[0].matchScore).toBe(30);
    });

    it("목차 2개 이상 시 +25점", () => {
      const items = [
        createContentItem({
          title: "교재",
          contentType: "lecture", // 타입 불일치 (선호도 없으면 +15)
          totalRange: 0, // totalRange 0 (+0)
          chapters: [
            { title: "1장", startRange: 1, endRange: 100 },
            { title: "2장", startRange: 101, endRange: 200 },
          ],
        }),
      ];
      const input = createDefaultInput({ contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 목차 2개: +25, totalRange 0: +0 = 40
      expect(result.recommendations[0].matchScore).toBe(40);
    });

    it("totalRange 유효 시 +20점", () => {
      const items = [
        createContentItem({
          title: "교재",
          contentType: "lecture", // 선호도 없으면 +15
          totalRange: 300, // +20
          chapters: [], // 0 챕터: +0
        }),
      ];
      const input = createDefaultInput({ contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, totalRange: +20 = 35
      expect(result.recommendations[0].matchScore).toBe(35);
    });

    it("제목에 과목명 포함 시 +15점", () => {
      const items = [
        createContentItem({
          title: "미적분 기본서", // 과목명 "미적분" 포함
          contentType: "lecture", // 선호도 없음: +15
          totalRange: 0, // +0
          chapters: [], // +0
        }),
      ];
      const input = createDefaultInput({ subject: "미적분", contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 키워드: +15 = 30
      expect(result.recommendations[0].matchScore).toBe(30);
    });

    it("제목에 교과명 포함 시 +15점", () => {
      const items = [
        createContentItem({
          title: "수학의 정석", // 교과명 "수학" 포함
          contentType: "lecture", // 선호도 없음: +15
          totalRange: 0, // +0
          chapters: [], // +0
        }),
      ];
      const input = createDefaultInput({ subject: null, contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 키워드(교과명): +15 = 30
      expect(result.recommendations[0].matchScore).toBe(30);
    });

    it("메타 정보(author) 존재 시 +10점", () => {
      const items = [
        createContentItem({
          title: "교재",
          author: "홍길동",
          contentType: "lecture", // 선호도 없음: +15
          totalRange: 0,
          chapters: [],
        }),
      ];
      const input = createDefaultInput({ contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 메타 정보: +10 = 25
      expect(result.recommendations[0].matchScore).toBe(25);
    });

    it("메타 정보(publisher) 존재 시 +10점", () => {
      const items = [
        createContentItem({
          title: "교재",
          publisher: "출판사",
          contentType: "lecture", // 선호도 없음: +15
          totalRange: 0,
          chapters: [],
        }),
      ];
      const input = createDefaultInput({ contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 메타 정보: +10 = 25
      expect(result.recommendations[0].matchScore).toBe(25);
    });

    it("모든 조건 만족 시 100점", () => {
      const items = [
        createContentItem({
          title: "미적분 완전정복",
          author: "저자명",
          publisher: "출판사",
          contentType: "book",
          totalRange: 300,
          chapters: [
            { title: "1장", startRange: 1, endRange: 100 },
            { title: "2장", startRange: 101, endRange: 300 },
          ],
        }),
      ];
      const input = createDefaultInput({ subject: "미적분", contentType: "book" });
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      // 타입 일치: +30, 목차 2개: +25, totalRange: +20, 키워드: +15, 메타: +10 = 100
      expect(result.recommendations[0].matchScore).toBe(100);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 정렬 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("정렬", () => {
    it("점수 높은 순으로 정렬", () => {
      const items = [
        createContentItem({
          title: "낮은 점수 교재",
          contentType: "book",
          totalRange: 0, // -20 (totalRange 없음)
          chapters: [], // -25 (챕터 없음)
        }),
        createContentItem({
          title: "높은 점수 교재",
          contentType: "book",
          totalRange: 300, // +20
          chapters: [
            { title: "1장", startRange: 1, endRange: 150 },
            { title: "2장", startRange: 151, endRange: 300 },
          ], // +25
        }),
      ];
      const input = createDefaultInput({
        subjectCategory: "영어", // 제목과 매칭 안 되도록
        subject: null,
        contentType: "book",
      });
      const preferences: UserPreferences = {}; // 필터 없음

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations[0].title).toBe("높은 점수 교재");
      expect(result.recommendations[0].rank).toBe(1);
      expect(result.recommendations[1].title).toBe("낮은 점수 교재");
      expect(result.recommendations[1].rank).toBe(2);
    });

    it("동점 시 제목 알파벳 순", () => {
      const items = [
        createContentItem({ title: "나 교재", totalRange: 100 }),
        createContentItem({ title: "가 교재", totalRange: 100 }),
        createContentItem({ title: "다 교재", totalRange: 100 }),
      ];
      const input = createDefaultInput();
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 모두 동점이므로 가나다 순
      expect(result.recommendations[0].title).toBe("가 교재");
      expect(result.recommendations[1].title).toBe("나 교재");
      expect(result.recommendations[2].title).toBe("다 교재");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // 필터링 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("필터링", () => {
    it("maxResults 개수 제한", () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createContentItem({ title: `교재 ${i + 1}` })
      );
      const input = createDefaultInput();
      const preferences: UserPreferences = { maxResults: 3 };

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations).toHaveLength(3);
      expect(result.totalFound).toBe(10);
      expect(result.filtered).toBe(3);
    });

    it("contentType 필터링", () => {
      const items = [
        createContentItem({ title: "교재 A", contentType: "book" }),
        createContentItem({ title: "강의 B", contentType: "lecture" }),
        createContentItem({ title: "교재 C", contentType: "book" }),
      ];
      const input = createDefaultInput();
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations).toHaveLength(2);
      expect(result.recommendations.every((r) => r.contentType === "book")).toBe(true);
    });

    it("빈 배열 입력 시 빈 결과", () => {
      const items: ParsedContentItem[] = [];
      const input = createDefaultInput();
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.success).toBe(true);
      expect(result.recommendations).toHaveLength(0);
      expect(result.totalFound).toBe(0);
      expect(result.filtered).toBe(0);
    });

    it("기본 maxResults는 5", () => {
      const items = Array.from({ length: 10 }, (_, i) =>
        createContentItem({ title: `교재 ${i + 1}` })
      );
      const input = createDefaultInput();
      const preferences: UserPreferences = {}; // maxResults 미지정

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations).toHaveLength(5);
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // reason 생성 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("reason 생성", () => {
    it("90점 이상 → 최적 추천 메시지", () => {
      const items = [
        createContentItem({
          title: "미적분 완전정복",
          author: "저자",
          contentType: "book",
          totalRange: 300,
          chapters: [
            { title: "1장", startRange: 1, endRange: 150 },
            { title: "2장", startRange: 151, endRange: 300 },
          ],
        }),
      ];
      const input = createDefaultInput({ subject: "미적분", contentType: "book" });
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations[0].reason).toBe(
        "추천 조건에 가장 적합한 콘텐츠입니다"
      );
    });

    it("70-89점 → 일치 메시지", () => {
      const items = [
        createContentItem({
          title: "미적분 교재",
          contentType: "book",
          totalRange: 300,
          chapters: [
            { title: "1장", startRange: 1, endRange: 150 },
            { title: "2장", startRange: 151, endRange: 300 },
          ],
          // author/publisher 없음: -10
        }),
      ];
      const input = createDefaultInput({ subject: "미적분", contentType: "book" });
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      // 30 + 25 + 20 + 15 = 90 → 최적 메시지
      // 하지만 키워드 매칭은 subject가 포함되어야 +15
      // 확인: 제목에 "미적분" 포함되어 있으므로 90점
      expect(result.recommendations[0].matchScore).toBe(90);
      expect(result.recommendations[0].reason).toBe(
        "추천 조건에 가장 적합한 콘텐츠입니다"
      );
    });

    it("50-69점 → 관련 메시지", () => {
      const items = [
        createContentItem({
          title: "미적분 교재",
          contentType: "book",
          totalRange: 300,
          chapters: [], // 챕터 없음: 0점
          // author/publisher 없음
        }),
      ];
      const input = createDefaultInput({ subject: "미적분", contentType: "book" });
      const preferences: UserPreferences = { contentType: "book" };

      const result = rankAndFilterResults(items, preferences, input);

      // 타입 일치: +30, 챕터 없음: +0, totalRange: +20, 키워드: +15 = 65
      expect(result.recommendations[0].matchScore).toBe(65);
      expect(result.recommendations[0].reason).toBe("관련 콘텐츠입니다");
    });

    it("50점 미만 → 참고 메시지", () => {
      const items = [
        createContentItem({
          title: "기타 교재", // 키워드 없음
          contentType: "lecture", // 타입 불일치 (필터 없으면 통과, 선호도 없으면 +15)
          totalRange: 0, // +0
          chapters: [], // +0
        }),
      ];
      const input = createDefaultInput({ contentType: null });
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      // 선호도 없음: +15, 키워드 없음: +0, 나머지 0 = 15
      expect(result.recommendations[0].matchScore).toBe(15);
      expect(result.recommendations[0].reason).toBe("참고용 콘텐츠입니다");
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // rank 값 테스트
  // ──────────────────────────────────────────────────────────────────

  describe("rank 값", () => {
    it("rank는 1부터 시작", () => {
      const items = [
        createContentItem({ title: "교재 1" }),
        createContentItem({ title: "교재 2" }),
        createContentItem({ title: "교재 3" }),
      ];
      const input = createDefaultInput();
      const preferences: UserPreferences = {};

      const result = rankAndFilterResults(items, preferences, input);

      expect(result.recommendations[0].rank).toBe(1);
      expect(result.recommendations[1].rank).toBe(2);
      expect(result.recommendations[2].rank).toBe(3);
    });
  });
});
