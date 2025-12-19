/**
 * planUtils 유틸리티 함수 단위 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isDummyContent,
  isNonLearningContent,
  isSelfStudyContent,
  getDummyContentMetadata,
  isCompletedPlan,
  filterLearningPlans,
  countCompletedLearningPlans,
  calculateCompletionRate,
  type PlanCompletionFields,
} from "@/lib/utils/planUtils";
import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_SELF_STUDY_CONTENT_ID,
  DUMMY_CONTENT_IDS,
  DUMMY_CONTENT_METADATA,
  PLAN_COMPLETION_CRITERIA,
  DUMMY_CONTENT_AGGREGATION_POLICY,
} from "@/lib/constants/plan";

describe("isDummyContent", () => {
  describe("정상 케이스", () => {
    it("비학습 항목 더미 콘텐츠 ID는 true", () => {
      const result = isDummyContent(DUMMY_NON_LEARNING_CONTENT_ID);

      expect(result).toBe(true);
    });

    it("자율학습 항목 더미 콘텐츠 ID는 true", () => {
      const result = isDummyContent(DUMMY_SELF_STUDY_CONTENT_ID);

      expect(result).toBe(true);
    });

    it("일반 콘텐츠 ID는 false", () => {
      const result = isDummyContent("content-123");

      expect(result).toBe(false);
    });
  });

  describe("경계값 테스트", () => {
    it("null은 false", () => {
      const result = isDummyContent(null);

      expect(result).toBe(false);
    });

    it("undefined는 false", () => {
      const result = isDummyContent(undefined);

      expect(result).toBe(false);
    });

    it("빈 문자열은 false", () => {
      const result = isDummyContent("");

      expect(result).toBe(false);
    });
  });
});

describe("isNonLearningContent", () => {
  describe("정상 케이스", () => {
    it("비학습 항목 더미 콘텐츠 ID는 true", () => {
      const result = isNonLearningContent(DUMMY_NON_LEARNING_CONTENT_ID);

      expect(result).toBe(true);
    });

    it("자율학습 항목 더미 콘텐츠 ID는 false", () => {
      const result = isNonLearningContent(DUMMY_SELF_STUDY_CONTENT_ID);

      expect(result).toBe(false);
    });

    it("일반 콘텐츠 ID는 false", () => {
      const result = isNonLearningContent("content-123");

      expect(result).toBe(false);
    });
  });

  describe("경계값 테스트", () => {
    it("null은 false", () => {
      const result = isNonLearningContent(null);

      expect(result).toBe(false);
    });

    it("undefined는 false", () => {
      const result = isNonLearningContent(undefined);

      expect(result).toBe(false);
    });
  });
});

describe("isSelfStudyContent", () => {
  describe("정상 케이스", () => {
    it("자율학습 항목 더미 콘텐츠 ID는 true", () => {
      const result = isSelfStudyContent(DUMMY_SELF_STUDY_CONTENT_ID);

      expect(result).toBe(true);
    });

    it("비학습 항목 더미 콘텐츠 ID는 false", () => {
      const result = isSelfStudyContent(DUMMY_NON_LEARNING_CONTENT_ID);

      expect(result).toBe(false);
    });

    it("일반 콘텐츠 ID는 false", () => {
      const result = isSelfStudyContent("content-123");

      expect(result).toBe(false);
    });
  });

  describe("경계값 테스트", () => {
    it("null은 false", () => {
      const result = isSelfStudyContent(null);

      expect(result).toBe(false);
    });

    it("undefined는 false", () => {
      const result = isSelfStudyContent(undefined);

      expect(result).toBe(false);
    });
  });
});

describe("getDummyContentMetadata", () => {
  describe("정상 케이스", () => {
    it("비학습 항목 더미 콘텐츠 메타데이터 반환", () => {
      const result = getDummyContentMetadata(DUMMY_NON_LEARNING_CONTENT_ID);

      expect(result).toEqual(DUMMY_CONTENT_METADATA[DUMMY_NON_LEARNING_CONTENT_ID]);
      expect(result?.isNonLearning).toBe(true);
      expect(result?.isSelfStudy).toBe(false);
    });

    it("자율학습 항목 더미 콘텐츠 메타데이터 반환", () => {
      const result = getDummyContentMetadata(DUMMY_SELF_STUDY_CONTENT_ID);

      expect(result).toEqual(DUMMY_CONTENT_METADATA[DUMMY_SELF_STUDY_CONTENT_ID]);
      expect(result?.isNonLearning).toBe(false);
      expect(result?.isSelfStudy).toBe(true);
    });
  });

  describe("경계값 테스트", () => {
    it("일반 콘텐츠 ID는 null 반환", () => {
      const result = getDummyContentMetadata("content-123");

      expect(result).toBeNull();
    });

    it("null은 null 반환", () => {
      const result = getDummyContentMetadata(null);

      expect(result).toBeNull();
    });

    it("undefined는 null 반환", () => {
      const result = getDummyContentMetadata(undefined);

      expect(result).toBeNull();
    });
  });
});

describe("isCompletedPlan", () => {
  describe("정상 케이스", () => {
    it("actual_end_time이 설정되면 완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: "2025-01-01T10:00:00Z",
        progress: null,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(true);
    });

    it("progress가 100 이상이면 완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: 100,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(true);
    });

    it("progress가 100 초과여도 완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: 150,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(true);
    });

    it("actual_end_time과 progress 모두 있으면 완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: "2025-01-01T10:00:00Z",
        progress: 100,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(true);
    });
  });

  describe("경계값 테스트", () => {
    it("progress가 99면 미완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: 99,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(false);
    });

    it("progress가 정확히 100이면 완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: PLAN_COMPLETION_CRITERIA.MIN_PROGRESS_FOR_COMPLETION,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(true);
    });

    it("actual_end_time이 null이면 미완료 (progress도 없을 때)", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: null,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(false);
    });

    it("actual_end_time이 undefined면 미완료 (progress도 없을 때)", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: undefined,
        progress: undefined,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(false);
    });

    it("progress가 0이면 미완료", () => {
      const plan: PlanCompletionFields = {
        actual_end_time: null,
        progress: 0,
      };

      const result = isCompletedPlan(plan);

      expect(result).toBe(false);
    });
  });
});

describe("filterLearningPlans", () => {
  describe("정상 케이스", () => {
    it("더미 콘텐츠를 제외하고 학습 플랜만 반환", () => {
      const plans = [
        { content_id: "content-1", name: "플랜1" },
        { content_id: DUMMY_NON_LEARNING_CONTENT_ID, name: "비학습" },
        { content_id: "content-2", name: "플랜2" },
        { content_id: DUMMY_SELF_STUDY_CONTENT_ID, name: "자율학습" },
        { content_id: "content-3", name: "플랜3" },
      ];

      const result = filterLearningPlans(plans);

      expect(result).toHaveLength(3);
      expect(result.map((p) => p.content_id)).toEqual([
        "content-1",
        "content-2",
        "content-3",
      ]);
    });

    it("모든 플랜이 학습 플랜이면 모두 반환", () => {
      const plans = [
        { content_id: "content-1", name: "플랜1" },
        { content_id: "content-2", name: "플랜2" },
      ];

      const result = filterLearningPlans(plans);

      expect(result).toHaveLength(2);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 배열은 빈 배열 반환", () => {
      const plans: Array<{ content_id?: string | null }> = [];

      const result = filterLearningPlans(plans);

      expect(result).toEqual([]);
    });

    it("모든 플랜이 더미 콘텐츠면 빈 배열 반환", () => {
      const plans = [
        { content_id: DUMMY_NON_LEARNING_CONTENT_ID, name: "비학습" },
        { content_id: DUMMY_SELF_STUDY_CONTENT_ID, name: "자율학습" },
      ];

      const result = filterLearningPlans(plans);

      expect(result).toEqual([]);
    });

    it("content_id가 null이면 학습 플랜으로 간주", () => {
      const plans = [
        { content_id: null, name: "플랜1" },
        { content_id: "content-1", name: "플랜2" },
      ];

      const result = filterLearningPlans(plans);

      expect(result).toHaveLength(2);
    });

    it("content_id가 undefined면 학습 플랜으로 간주", () => {
      const plans = [
        { content_id: undefined, name: "플랜1" },
        { content_id: "content-1", name: "플랜2" },
      ];

      const result = filterLearningPlans(plans);

      expect(result).toHaveLength(2);
    });
  });
});

describe("countCompletedLearningPlans", () => {
  describe("정상 케이스 - 더미 콘텐츠 제외 정책", () => {
    beforeEach(() => {
      // 정책이 false인 경우를 테스트하기 위해 모킹
      // 실제로는 상수이므로 직접 테스트
    });

    it("더미 콘텐츠를 제외하고 완료된 학습 플랜만 카운트", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: DUMMY_NON_LEARNING_CONTENT_ID,
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: 100,
        },
        {
          content_id: "content-3",
          actual_end_time: null,
          progress: 50,
        },
      ];

      const result = countCompletedLearningPlans(plans);

      // 더미 콘텐츠 제외 정책이므로 2개 (content-1, content-2)
      if (!DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
        expect(result).toBe(2);
      } else {
        expect(result).toBe(3);
      }
    });
  });

  describe("경계값 테스트", () => {
    it("빈 배열은 0 반환", () => {
      const plans: Array<
        PlanCompletionFields & { content_id?: string | null }
      > = [];

      const result = countCompletedLearningPlans(plans);

      expect(result).toBe(0);
    });

    it("완료된 플랜이 없으면 0 반환", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: null,
          progress: 50,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: null,
        },
      ];

      const result = countCompletedLearningPlans(plans);

      expect(result).toBe(0);
    });
  });
});

describe("calculateCompletionRate", () => {
  describe("정상 케이스 - 더미 콘텐츠 제외 정책", () => {
    it("더미 콘텐츠를 제외하고 완료율 계산", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: DUMMY_NON_LEARNING_CONTENT_ID,
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: 100,
        },
        {
          content_id: "content-3",
          actual_end_time: null,
          progress: 50,
        },
      ];

      const result = calculateCompletionRate(plans);

      // 더미 콘텐츠 제외 정책이므로 2/3 = 67%
      if (!DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
        expect(result).toBe(67);
      } else {
        expect(result).toBe(75); // 3/4 = 75%
      }
    });

    it("모든 플랜이 완료되면 100%", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: 100,
        },
      ];

      const result = calculateCompletionRate(plans);

      expect(result).toBe(100);
    });

    it("모든 플랜이 미완료면 0%", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: null,
          progress: 50,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: null,
        },
      ];

      const result = calculateCompletionRate(plans);

      expect(result).toBe(0);
    });
  });

  describe("경계값 테스트", () => {
    it("빈 배열은 0% 반환", () => {
      const plans: Array<
        PlanCompletionFields & { content_id?: string | null }
      > = [];

      const result = calculateCompletionRate(plans);

      expect(result).toBe(0);
    });

    it("반올림 처리 확인", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: null,
        },
        {
          content_id: "content-3",
          actual_end_time: null,
          progress: null,
        },
      ];

      const result = calculateCompletionRate(plans);

      // 1/3 = 33.33... -> 33%
      expect(result).toBe(33);
    });
  });

  describe("정책 테스트", () => {
    it("더미 콘텐츠 포함 정책일 때 완료율 계산", () => {
      const plans = [
        {
          content_id: "content-1",
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: DUMMY_NON_LEARNING_CONTENT_ID,
          actual_end_time: "2025-01-01T10:00:00Z",
          progress: null,
        },
        {
          content_id: "content-2",
          actual_end_time: null,
          progress: null,
        },
      ];

      const result = calculateCompletionRate(plans);

      // 정책에 따라 결과가 달라짐
      if (DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
        // 더미 포함: 2/3 = 67%
        expect(result).toBe(67);
      } else {
        // 더미 제외: 1/2 = 50%
        expect(result).toBe(50);
      }
    });
  });
});

