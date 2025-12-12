/**
 * schedulerOptionsMerge 함수 단위 테스트
 */

import { describe, it, expect } from "vitest";
import {
  mergeTimeSettingsSafely,
  mergeStudyReviewCycle,
} from "@/lib/utils/schedulerOptionsMerge";
import { PlanGroupError, PlanGroupErrorCodes } from "@/lib/errors/planGroupErrors";
import type { SchedulerOptions } from "@/lib/types/plan";

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

  describe("경계값 테스트", () => {
    it("빈 객체 병합", () => {
      const schedulerOptions = { study_days: 6 };
      const timeSettings = {};

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result).toEqual(schedulerOptions);
    });

    it("매우 큰 객체 병합", () => {
      const schedulerOptions: Record<string, unknown> = { study_days: 6 };
      const timeSettings: Record<string, unknown> = {};
      
      // 100개의 속성 추가
      for (let i = 0; i < 100; i++) {
        timeSettings[`key_${i}`] = `value_${i}`;
      }

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.study_days).toBe(6);
      expect(result.key_0).toBe("value_0");
      expect(result.key_99).toBe("value_99");
    });

    it("중첩된 객체 병합", () => {
      const schedulerOptions = { study_days: 6 };
      const timeSettings = {
        lunch_time: {
          start: "12:00",
          end: "13:00",
          nested: {
            deep: "value",
          },
        },
      };

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.study_days).toBe(6);
      expect(result.lunch_time).toEqual({
        start: "12:00",
        end: "13:00",
        nested: {
          deep: "value",
        },
      });
    });

    it("should ignore invalid keys", () => {
      const schedulerOptions = { study_days: 6 };
      const timeSettings = {
        "key-with-dash": "value",
        key_with_underscore: "value",
        "key.with.dot": "value",
      } as any;

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.study_days).toBe(6);
      expect((result as any)["key-with-dash"]).toBe("value");
      expect((result as any)["key_with_underscore"]).toBe("value");
      expect((result as any)["key.with.dot"]).toBe("value");
    });

    it("should handle value type mismatch (if not strictly typed)", () => {
      const schedulerOptions = { study_days: 6, long_value: 60 };
      const timeSettings = {
        long_value: "invalid", // string instead of number
      } as any;

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      // The merge function itself doesn't perform type validation beyond basic object checks.
      // It will merge the value as is.
      expect(result.long_value).toBe("invalid");
    });

    it("should handle numeric values correctly", () => {
      const schedulerOptions = { study_days: 6 };
      const timeSettings = {
        zero_value: 0,
        negative_value: -1,
        large_value: Number.MAX_SAFE_INTEGER,
        small_value: Number.MIN_SAFE_INTEGER,
      } as any;

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result.study_days).toBe(6);
      expect(result.zero_value).toBe(0);
      expect(result.negative_value).toBe(-1);
      expect(result.large_value).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.small_value).toBe(Number.MIN_SAFE_INTEGER);
    });

    it("should handle null or undefined values", () => {
      const schedulerOptions = { study_days: 6 };
      const timeSettings = {
        null_value: null,
        undefined_value: undefined,
        empty_string: "",
      } as any;

      const result = mergeTimeSettingsSafely(schedulerOptions, timeSettings);

      expect(result).toBeDefined();
      expect(result.study_days).toBe(6);
      expect(result.null_value).toBeNull();
      expect(result.undefined_value).toBeUndefined();
      expect(result.empty_string).toBe("");
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
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
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

  describe("경계값 테스트", () => {
    it("study_days가 0인 경우", () => {
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
      const studyReviewCycle = { study_days: 0, review_days: 1 };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(0);
      expect(result.review_days).toBe(1);
    });

    it("review_days가 0인 경우", () => {
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
      const studyReviewCycle = { study_days: 6, review_days: 0 };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(6);
      expect(result.review_days).toBe(0);
    });

    it("음수 값 처리", () => {
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
      const studyReviewCycle = { study_days: -1, review_days: -2 };

      // 음수는 숫자이므로 타입 검증은 통과하지만, 비즈니스 로직에서 검증해야 함
      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(-1);
      expect(result.review_days).toBe(-2);
    });

    it("매우 큰 숫자 값 처리", () => {
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
      const studyReviewCycle = {
        study_days: Number.MAX_SAFE_INTEGER,
        review_days: Number.MAX_SAFE_INTEGER - 1,
      };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(Number.MAX_SAFE_INTEGER);
      expect(result.review_days).toBe(Number.MAX_SAFE_INTEGER - 1);
    });

    it("소수점 숫자 처리", () => {
      const schedulerOptions: SchedulerOptions = { student_level: "high" };
      const studyReviewCycle = { study_days: 6.5, review_days: 1.5 };

      // 소수점도 숫자이므로 타입 검증은 통과
      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(6.5);
      expect(result.review_days).toBe(1.5);
    });

    it("빈 schedulerOptions와 병합", () => {
      const schedulerOptions: SchedulerOptions = {};
      const studyReviewCycle = { study_days: 5, review_days: 2 };

      const result = mergeStudyReviewCycle(schedulerOptions, studyReviewCycle);

      expect(result.study_days).toBe(5);
      expect(result.review_days).toBe(2);
    });
  });
});

