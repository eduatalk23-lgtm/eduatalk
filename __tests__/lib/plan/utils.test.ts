/**
 * 플랜 생성 유틸리티 테스트
 *
 * @module __tests__/lib/plan/utils.test
 */

import { describe, it, expect } from "vitest";
import {
  // Duration utilities
  getMinutesPerPage,
  calculateBookDuration,
  calculateLectureDuration,
  calculateAverageEpisodeDuration,
  calculateCustomDuration,
  calculateDuration,
  DEFAULT_MINUTES_PER_PAGE,
  DEFAULT_EPISODE_DURATION,
  REVIEW_DAY_TIME_RATIO,
  // Chapter utilities
  formatPageRange,
  formatUnitName,
  formatEpisodeRange,
  formatEpisodeWithTitle,
  formatChapterInfo,
  createBookChapterInfo,
  createLectureChapterInfo,
  createDefaultChapterInfo,
} from "@/lib/plan/utils";

describe("Duration Utilities", () => {
  describe("getMinutesPerPage", () => {
    it("기본 난이도는 6분/페이지", () => {
      expect(getMinutesPerPage("기본")).toBe(6);
    });

    it("쉬움 난이도는 4분/페이지", () => {
      expect(getMinutesPerPage("쉬움")).toBe(4);
    });

    it("어려움 난이도는 8분/페이지", () => {
      expect(getMinutesPerPage("어려움")).toBe(8);
    });

    it("null/undefined는 기본값 반환", () => {
      expect(getMinutesPerPage(null)).toBe(DEFAULT_MINUTES_PER_PAGE);
      expect(getMinutesPerPage(undefined)).toBe(DEFAULT_MINUTES_PER_PAGE);
    });

    it("알 수 없는 난이도는 기본값 반환", () => {
      expect(getMinutesPerPage("매우어려움")).toBe(DEFAULT_MINUTES_PER_PAGE);
    });
  });

  describe("calculateBookDuration", () => {
    it("10페이지 * 6분/페이지 = 60분", () => {
      expect(calculateBookDuration(10)).toBe(60);
    });

    it("난이도 적용: 10페이지 * 8분 = 80분", () => {
      expect(calculateBookDuration(10, "어려움")).toBe(80);
    });

    it("복습일에는 50% 시간", () => {
      expect(calculateBookDuration(10, "기본", true)).toBe(30);
    });

    it("0페이지는 0분", () => {
      expect(calculateBookDuration(0)).toBe(0);
    });
  });

  describe("calculateLectureDuration", () => {
    const episodes = [
      { episode_number: 1, duration: 30 },
      { episode_number: 2, duration: 45 },
      { episode_number: 3, duration: 25 },
    ];

    it("전체 에피소드 시간 합산", () => {
      expect(calculateLectureDuration(episodes, 1, 3)).toBe(100);
    });

    it("범위 내 에피소드만 합산", () => {
      expect(calculateLectureDuration(episodes, 1, 2)).toBe(75);
    });

    it("복습일에는 50% 시간", () => {
      expect(calculateLectureDuration(episodes, 1, 3, true)).toBe(50);
    });

    it("에피소드 정보 없으면 기본값 사용", () => {
      expect(calculateLectureDuration([], 1, 3)).toBe(
        3 * DEFAULT_EPISODE_DURATION
      );
    });
  });

  describe("calculateAverageEpisodeDuration", () => {
    it("300분 / 10에피소드 = 30분/에피소드", () => {
      expect(calculateAverageEpisodeDuration(300, 10)).toBe(30);
    });

    it("0 에피소드는 기본값 반환", () => {
      expect(calculateAverageEpisodeDuration(300, 0)).toBe(
        DEFAULT_EPISODE_DURATION
      );
    });
  });

  describe("calculateCustomDuration", () => {
    it("지정된 값 그대로 반환", () => {
      expect(calculateCustomDuration(120)).toBe(120);
    });

    it("null/undefined는 0 반환", () => {
      expect(calculateCustomDuration(null)).toBe(0);
      expect(calculateCustomDuration(undefined)).toBe(0);
    });

    it("복습일에는 50% 시간", () => {
      expect(calculateCustomDuration(100, true)).toBe(50);
    });
  });

  describe("calculateDuration (통합 함수)", () => {
    it("book 타입", () => {
      expect(
        calculateDuration("book", {
          pages: 10,
          difficulty: "기본",
        })
      ).toBe(60);
    });

    it("lecture 타입", () => {
      expect(
        calculateDuration("lecture", {
          episodes: [{ episode_number: 1, duration: 30 }],
          startRange: 1,
          endRange: 1,
        })
      ).toBe(30);
    });

    it("custom 타입", () => {
      expect(
        calculateDuration("custom", {
          totalPageOrTime: 90,
        })
      ).toBe(90);
    });
  });
});

describe("Chapter Utilities", () => {
  describe("formatPageRange", () => {
    it("단일 페이지", () => {
      expect(formatPageRange(1, 1)).toBe("p.1");
    });

    it("페이지 범위", () => {
      expect(formatPageRange(1, 50)).toBe("p.1 ~ p.50");
    });
  });

  describe("formatUnitName", () => {
    it("대단원 + 소단원", () => {
      expect(formatUnitName("1장", "함수의 극한")).toBe("1장 함수의 극한");
    });

    it("대단원만", () => {
      expect(formatUnitName("1장", null)).toBe("1장");
    });

    it("소단원만", () => {
      expect(formatUnitName(null, "함수의 극한")).toBe("함수의 극한");
    });

    it("둘 다 없으면 빈 문자열", () => {
      expect(formatUnitName(null, null)).toBe("");
    });
  });

  describe("formatEpisodeRange", () => {
    it("단일 에피소드", () => {
      expect(formatEpisodeRange(1, 1)).toBe("1강");
    });

    it("에피소드 범위", () => {
      expect(formatEpisodeRange(1, 5)).toBe("1강 ~ 5강");
    });
  });

  describe("formatEpisodeWithTitle", () => {
    it("제목 있음", () => {
      expect(formatEpisodeWithTitle(1, "함수의 기초")).toBe("1강 함수의 기초");
    });

    it("제목 없음", () => {
      expect(formatEpisodeWithTitle(1, null)).toBe("1강");
    });
  });

  describe("formatChapterInfo", () => {
    it("에피소드 제목 우선 표시", () => {
      expect(
        formatChapterInfo({
          start_chapter: "1강",
          end_chapter: "5강",
          episode_title: "함수의 극한",
        })
      ).toBe("함수의 극한");
    });

    it("시작=끝이면 하나만 표시", () => {
      expect(
        formatChapterInfo({
          start_chapter: "1강",
          end_chapter: "1강",
        })
      ).toBe("1강");
    });

    it("범위 표시", () => {
      expect(
        formatChapterInfo({
          start_chapter: "1강",
          end_chapter: "5강",
        })
      ).toBe("1강 ~ 5강");
    });
  });

  describe("createBookChapterInfo", () => {
    it("단원 정보로 생성", () => {
      const result = createBookChapterInfo(
        { page_number: 1, major_unit: "1장", minor_unit: "극한" },
        { page_number: 50, major_unit: "2장", minor_unit: "미분" }
      );

      expect(result.start_chapter).toBe("1장 극한");
      expect(result.end_chapter).toBe("2장 미분");
    });

    it("페이지 번호로 생성", () => {
      const result = createBookChapterInfo(
        { page_number: 1 },
        { page_number: 50 }
      );

      expect(result.start_chapter).toBe("p.1");
      expect(result.end_chapter).toBe("p.50");
    });
  });

  describe("createLectureChapterInfo", () => {
    it("에피소드 정보로 생성", () => {
      const result = createLectureChapterInfo(
        { episode_number: 1, episode_title: "함수의 기초" },
        { episode_number: 5, episode_title: "극한의 성질" }
      );

      expect(result.start_chapter).toBe("1강");
      expect(result.end_chapter).toBe("5강");
      expect(result.episode_title).toBe("함수의 기초");
    });
  });

  describe("createDefaultChapterInfo", () => {
    it("book 타입", () => {
      const result = createDefaultChapterInfo("book", 1, 50);
      expect(result.start_chapter).toBe("p.1");
      expect(result.end_chapter).toBe("p.50");
    });

    it("lecture 타입", () => {
      const result = createDefaultChapterInfo("lecture", 1, 5);
      expect(result.start_chapter).toBe("1강");
      expect(result.end_chapter).toBe("5강");
    });

    it("custom 타입", () => {
      const result = createDefaultChapterInfo("custom", 1, 10);
      expect(result.start_chapter).toBe("1");
      expect(result.end_chapter).toBe("10");
    });
  });
});
