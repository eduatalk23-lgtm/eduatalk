/**
 * 콘텐츠 소요시간 계산 및 캐싱 테스트
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculateContentDuration,
  invalidateDurationCache,
  DEFAULT_EPISODE_DURATION_MINUTES,
  DEFAULT_REVIEW_TIME_RATIO,
} from "@/lib/plan/contentDuration";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

describe("calculateContentDuration", () => {
  beforeEach(() => {
    // 각 테스트 전에 캐시 초기화
    invalidateDurationCache();
  });

  describe("캐싱 메커니즘", () => {
    it("동일한 입력에 대해 캐시된 결과를 반환해야 함", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 3,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [
          { episode_number: 1, duration: 30 },
          { episode_number: 2, duration: 25 },
          { episode_number: 3, duration: 35 },
        ],
      };

      // 첫 번째 호출
      const result1 = calculateContentDuration(content, durationInfo, "학습일");

      // 두 번째 호출 (캐시에서 반환되어야 함)
      const result2 = calculateContentDuration(content, durationInfo, "학습일");

      expect(result1).toBe(result2);
      expect(result1).toBe(90); // 30 + 25 + 35
    });

    it("다른 dayType에 대해 별도의 캐시를 사용해야 함", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 1,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [{ episode_number: 1, duration: 60 }],
      };

      const studyDayResult = calculateContentDuration(
        content,
        durationInfo,
        "학습일"
      );
      const reviewDayResult = calculateContentDuration(
        content,
        durationInfo,
        "복습일"
      );

      expect(studyDayResult).toBe(60);
      expect(reviewDayResult).toBe(30); // 60 * 0.5
      expect(studyDayResult).not.toBe(reviewDayResult);
    });

    it("캐시 무효화 후 재계산해야 함", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 1,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [{ episode_number: 1, duration: 30 }],
      };

      const result1 = calculateContentDuration(content, durationInfo, "학습일");
      invalidateDurationCache("lecture-123");
      const result2 = calculateContentDuration(content, durationInfo, "학습일");

      // 캐시가 무효화되었지만 결과는 동일해야 함
      expect(result1).toBe(result2);
      expect(result1).toBe(30);
    });
  });

  describe("강의 콘텐츠 duration 계산", () => {
    it("episode별 duration 합산", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 3,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [
          { episode_number: 1, duration: 26 },
          { episode_number: 2, duration: 24 },
          { episode_number: 3, duration: 28 },
        ],
      };

      const result = calculateContentDuration(content, durationInfo, "학습일");
      expect(result).toBe(78); // 26 + 24 + 28
    });

    it("episode duration이 없는 경우 기본값 사용", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 2,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [
          { episode_number: 1, duration: null },
          { episode_number: 2, duration: null },
        ],
      };

      const result = calculateContentDuration(content, durationInfo, "학습일");
      expect(result).toBe(
        DEFAULT_EPISODE_DURATION_MINUTES * 2 // 30 * 2 = 60
      );
    });

    it("복습일인 경우 50% 단축", () => {
      const content = {
        content_type: "lecture" as const,
        content_id: "lecture-123",
        start_range: 1,
        end_range: 1,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "lecture",
        content_id: "lecture-123",
        episodes: [{ episode_number: 1, duration: 60 }],
      };

      const result = calculateContentDuration(content, durationInfo, "복습일");
      expect(result).toBe(30); // 60 * 0.5
    });
  });

  describe("책 콘텐츠 duration 계산", () => {
    it("난이도별 페이지당 시간 적용", () => {
      const content = {
        content_type: "book" as const,
        content_id: "book-123",
        start_range: 1,
        end_range: 10,
      };

      const durationInfo: ContentDurationInfo = {
        content_type: "book",
        content_id: "book-123",
        difficulty_level: "기초",
      };

      const result = calculateContentDuration(content, durationInfo, "학습일");
      expect(result).toBe(40); // 10페이지 * 4분/페이지
    });
  });
});

