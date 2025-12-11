/**
 * schedulerOptionsMerge 함수 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  mergeTimeSettingsSafely,
  mergeStudyReviewCycle,
} from "@/lib/utils/schedulerOptionsMerge";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";

describe("mergeTimeSettingsSafely", () => {
  describe("정상 케이스", () => {
    it("timeSettings가 null이면 schedulerOptions를 그대로 반환", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const result = mergeTimeSettingsSafely(schedulerOptions, null);
      expect(result).toEqual(schedulerOptions);
    });

    it("timeSettings가 undefined이면 schedulerOptions를 그대로 반환", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const result = mergeTimeSettingsSafely(schedulerOptions, undefined);
      expect(result).toEqual(schedulerOptions);
    });

    it("timeSettings를 병합하고 보호 필드는 유지", () => {
      const schedulerOptions = {
        study_days: 6,
        review_days: 1,
        template_block_set_id: "protected-id",
        camp_template_id: "camp-id",
      };
      const timeSettings = {
        lunch_time: { start: "12:00", end: "13:00" },
        template_block_set_id: "should-not-overwrite",
      };

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.lunch_time).toEqual({ start: "12:00", end: "13:00" });
      expect(result.template_block_set_id).toBe("protected-id"); // 보호 필드 유지
      expect(result.camp_template_id).toBe("camp-id"); // 보호 필드 유지
      expect(result.study_days).toBe(6);
      expect(result.review_days).toBe(1);
    });

    it("보호 필드가 없으면 정상적으로 병합", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const timeSettings = {
        lunch_time: { start: "12:00", end: "13:00" },
      };

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.lunch_time).toEqual({ start: "12:00", end: "13:00" });
      expect(result.study_days).toBe(6);
      expect(result.review_days).toBe(1);
    });
  });

  describe("에러 케이스", () => {
    it("schedulerOptions가 null이면 에러 throw", () => {
      expect(() => {
        mergeTimeSettingsSafely(null as any, {});
      }).toThrow(PlanGroupError);
    });

    it("schedulerOptions가 undefined이면 에러 throw", () => {
      expect(() => {
        mergeTimeSettingsSafely(undefined as any, {});
      }).toThrow(PlanGroupError);
    });

    it("schedulerOptions가 배열이면 에러 throw", () => {
      expect(() => {
        mergeTimeSettingsSafely([] as any, {});
      }).toThrow(PlanGroupError);
    });

    it("timeSettings가 배열이면 에러 throw", () => {
      expect(() => {
        mergeTimeSettingsSafely({}, [] as any);
      }).toThrow(PlanGroupError);
    });
  });
});

describe("mergeStudyReviewCycle", () => {
  describe("정상 케이스", () => {
    it("studyReviewCycle이 null이면 schedulerOptions를 그대로 반환", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const result = mergeStudyReviewCycle(schedulerOptions, null);
      expect(result).toEqual(schedulerOptions);
    });

    it("studyReviewCycle이 undefined이면 schedulerOptions를 그대로 반환", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const result = mergeStudyReviewCycle(schedulerOptions, undefined);
      expect(result).toEqual(schedulerOptions);
    });

    it("studyReviewCycle을 병합", () => {
      const schedulerOptions = { student_level: "high" };
      const studyReviewCycle = { study_days: 5, review_days: 2 };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(5);
      expect(result.review_days).toBe(2);
      expect(result.student_level).toBe("high");
    });

    it("기존 study_days와 review_days를 덮어쓰기", () => {
      const schedulerOptions = { study_days: 6, review_days: 1 };
      const studyReviewCycle = { study_days: 5, review_days: 2 };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(5);
      expect(result.review_days).toBe(2);
    });
  });

  describe("에러 케이스", () => {
    it("schedulerOptions가 null이면 에러 throw", () => {
      expect(() => {
        mergeStudyReviewCycle(null as any, { study_days: 5, review_days: 2 });
      }).toThrow(PlanGroupError);
    });

    it("schedulerOptions가 배열이면 에러 throw", () => {
      expect(() => {
        mergeStudyReviewCycle([] as any, { study_days: 5, review_days: 2 });
      }).toThrow(PlanGroupError);
    });

    it("studyReviewCycle이 배열이면 에러 throw", () => {
      expect(() => {
        mergeStudyReviewCycle({}, [] as any);
      }).toThrow(PlanGroupError);
    });

    it("study_days가 숫자가 아니면 에러 throw", () => {
      expect(() => {
        mergeStudyReviewCycle({}, { study_days: "5" as any, review_days: 2 });
      }).toThrow(PlanGroupError);
    });

    it("review_days가 숫자가 아니면 에러 throw", () => {
      expect(() => {
        mergeStudyReviewCycle({}, { study_days: 5, review_days: "2" as any });
      }).toThrow(PlanGroupError);
    });
  });
});

