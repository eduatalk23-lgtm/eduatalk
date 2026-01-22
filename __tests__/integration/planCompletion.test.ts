/**
 * 플랜 완료율 계산 통합 테스트
 * planUtils + date 조합 시나리오
 * 
 * 참고: planUtils + date 조합의 주요 시나리오는 dateIntegration.test.ts에 포함되어 있습니다.
 * 이 파일은 플랜 완료율 계산 중심의 추가 통합 시나리오를 다룹니다.
 */

import { describe, it, expect } from "vitest";
import {
  isCompletedPlan,
  calculateCompletionRate,
  filterLearningPlans,
  countCompletedLearningPlans,
  type PlanCompletionFields,
} from "@/lib/utils/planUtils";
import {
  getDaysDifference,
  generateDateRange,
  calculateDday,
  formatDateString,
  getTodayParts,
  addDaysToDate,
} from "@/lib/utils/date";
import {
  DUMMY_NON_LEARNING_CONTENT_ID,
  DUMMY_CONTENT_AGGREGATION_POLICY,
} from "@/lib/constants/plan";

describe("플랜 그룹 완료율 계산: planUtils + date", () => {
  describe("기간별 완료율 계산", () => {
    it("특정 기간 내 완료율 계산", () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      // 날짜 범위 생성
      const dateRange = generateDateRange(startDate, endDate);
      const totalDays = getDaysDifference(startDate, endDate) + 1;

      // 플랜 데이터
      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: "2025-01-05T10:00:00Z", status: "completed" },
          { actual_end_time: "2025-01-10T10:00:00Z", status: "completed" },
          { actual_end_time: null, status: "in_progress" },
          { actual_end_time: null, status: null },
        ];

      // 완료율 계산
      const completionRate = calculateCompletionRate(plans);

      expect(dateRange.length).toBe(31);
      expect(totalDays).toBe(31);
      expect(typeof completionRate).toBe("number");
      expect(completionRate).toBeGreaterThanOrEqual(0);
      expect(completionRate).toBeLessThanOrEqual(100);
      expect(completionRate).toBe(50); // 2/4 = 50%
    });

    it("기간 내 완료된 플랜만 필터링하여 완료율 계산", () => {
      const startDate = "2025-01-01";
      const endDate = "2025-01-31";

      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          {
            actual_end_time: "2025-01-05T10:00:00Z",
            status: "completed",
            content_id: "content-1",
          },
          {
            actual_end_time: "2025-01-10T10:00:00Z",
            status: "completed",
            content_id: "content-2",
          },
          {
            actual_end_time: "2025-02-05T10:00:00Z",
            status: "completed",
            content_id: "content-3",
          }, // 기간 밖
          { actual_end_time: null, status: "in_progress", content_id: "content-4" },
        ];

      // 기간 내 완료된 플랜 필터링
      const completedInRange = plans.filter((plan) => {
        if (!plan.actual_end_time) return false;
        const endDateObj = new Date(plan.actual_end_time);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return endDateObj >= start && endDateObj <= end;
      });

      // 완료율 계산
      const completionRate = calculateCompletionRate(completedInRange);

      expect(completedInRange.length).toBe(2);
      expect(completionRate).toBe(100); // 2/2 = 100%
    });
  });

  describe("D-day 계산 + 완료율", () => {
    it("목표일까지 남은 일수와 완료율 조합", () => {
      const targetDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        30
      );

      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: null, status: "completed" },
          { actual_end_time: null, status: "in_progress" },
          { actual_end_time: null, status: null },
        ];

      // D-day 계산
      const dday = calculateDday(targetDate);

      // 완료율 계산
      const completionRate = calculateCompletionRate(plans);

      expect(typeof dday).toBe("number");
      expect(dday).toBeGreaterThan(0);
      expect(typeof completionRate).toBe("number");
      expect(completionRate).toBeGreaterThanOrEqual(0);
      expect(completionRate).toBeLessThanOrEqual(100);
    });

    it("과거 목표일과 완료율 조합", () => {
      const pastDate = addDaysToDate(
        formatDateString(
          getTodayParts().year,
          getTodayParts().month,
          getTodayParts().day
        ),
        -10
      );

      const plans: (PlanCompletionFields & { content_id?: string | null })[] =
        [
          { actual_end_time: null, status: "completed" },
          { actual_end_time: null, status: "in_progress" },
        ];

      const dday = calculateDday(pastDate);
      const completionRate = calculateCompletionRate(plans);

      expect(dday).toBeLessThan(0);
      expect(completionRate).toBe(50); // 1/2 = 50%
    });
  });
});

describe("더미 콘텐츠 정책에 따른 완료율 차이", () => {
  it("더미 콘텐츠 제외 정책일 때 완료율 계산", () => {
    const plans: (PlanCompletionFields & { content_id?: string | null })[] = [
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

    const completionRate = calculateCompletionRate(plans);

    // 더미 콘텐츠 제외 정책이므로 1/2 = 50%
    if (!DUMMY_CONTENT_AGGREGATION_POLICY.includeInCompletionRate) {
      expect(completionRate).toBe(50);
    } else {
      expect(completionRate).toBe(67); // 2/3 = 67%
    }
  });

  it("학습 플랜만 필터링 후 완료율 계산", () => {
    const plans: (PlanCompletionFields & { content_id?: string | null })[] = [
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

    // 학습 플랜만 필터링
    const learningPlans = filterLearningPlans(plans);

    // 완료율 계산
    const completionRate = calculateCompletionRate(learningPlans);

    expect(learningPlans.length).toBe(2);
    expect(completionRate).toBe(50); // 1/2 = 50%
  });
});

describe("날짜 범위 내 완료율 계산", () => {
  it("특정 기간 내 완료된 플랜 수와 완료율", () => {
    const startDate = "2025-01-01";
    const endDate = "2025-01-31";

    const plans: (PlanCompletionFields & { content_id?: string | null })[] = [
      {
        content_id: "content-1",
        actual_end_time: "2025-01-05T10:00:00Z",
        status: "completed",
      },
      {
        content_id: "content-2",
        actual_end_time: "2025-01-10T10:00:00Z",
        status: "completed",
      },
      {
        content_id: "content-3",
        actual_end_time: "2025-02-05T10:00:00Z",
        status: "completed",
      }, // 기간 밖
      {
        content_id: "content-4",
        actual_end_time: null,
        status: "in_progress",
      },
    ];

    // 기간 내 완료된 플랜 필터링
    const completedInRange = plans.filter((plan) => {
      if (!plan.actual_end_time) return false;
      const endDateObj = new Date(plan.actual_end_time);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return endDateObj >= start && endDateObj <= end;
    });

    // 완료된 학습 플랜 수 계산
    const completedCount = countCompletedLearningPlans(completedInRange);

    // 완료율 계산
    const completionRate = calculateCompletionRate(completedInRange);

    expect(completedInRange.length).toBe(2);
    expect(completedCount).toBe(2);
    expect(completionRate).toBe(100); // 2/2 = 100%
  });

  it("날짜 범위와 완료율을 함께 계산", () => {
    const startDate = "2025-01-01";
    const endDate = "2025-01-31";

    const plans: (PlanCompletionFields & { content_id?: string | null })[] = [
      {
        content_id: "content-1",
        actual_end_time: "2025-01-05T10:00:00Z",
        status: "completed",
      },
      {
        content_id: "content-2",
        actual_end_time: null,
        status: "completed",
      },
      {
        content_id: "content-3",
        actual_end_time: null,
        status: "in_progress",
      },
    ];

    // 날짜 범위 생성
    const dateRange = generateDateRange(startDate, endDate);

    // 완료율 계산
    const completionRate = calculateCompletionRate(plans);

    expect(dateRange.length).toBe(31);
    expect(completionRate).toBe(67); // 2/3 = 67%
  });
});

