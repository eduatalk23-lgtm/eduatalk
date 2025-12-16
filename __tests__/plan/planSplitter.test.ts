/**
 * 플랜 분할 유틸리티 테스트
 */

import { describe, it, expect } from "vitest";
import {
  splitPlanByEpisodes,
  splitPlanTimeInputByEpisodes,
} from "@/lib/plan/planSplitter";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { PlanTimeInput } from "@/lib/plan/assignPlanTimes";
import type { ContentDurationInfo } from "@/lib/types/plan-generation";

describe("splitPlanByEpisodes", () => {
  const basePlan: ScheduledPlan = {
    plan_date: "2025-01-01",
    block_index: 1,
    content_type: "lecture",
    content_id: "lecture-123",
    planned_start_page_or_time: 2,
    planned_end_page_or_time: 5,
    chapter: null,
    is_reschedulable: true,
  };

  const durationInfo: ContentDurationInfo = {
    content_type: "lecture",
    content_id: "lecture-123",
    episodes: [
      { episode_number: 1, duration: 30 },
      { episode_number: 2, duration: 26 },
      { episode_number: 3, duration: 24 },
      { episode_number: 4, duration: 28 },
      { episode_number: 5, duration: 32 },
    ],
  };

  const contentDurationMap = new Map<string, ContentDurationInfo>();
  contentDurationMap.set("lecture-123", durationInfo);

  it("큰 범위를 episode별로 분할해야 함", () => {
    const result = splitPlanByEpisodes(basePlan, contentDurationMap);

    expect(result).toHaveLength(4); // 2, 3, 4, 5
    expect(result[0].planned_start_page_or_time).toBe(2);
    expect(result[0].planned_end_page_or_time).toBe(2);
    expect(result[1].planned_start_page_or_time).toBe(3);
    expect(result[1].planned_end_page_or_time).toBe(3);
    expect(result[2].planned_start_page_or_time).toBe(4);
    expect(result[2].planned_end_page_or_time).toBe(4);
    expect(result[3].planned_start_page_or_time).toBe(5);
    expect(result[3].planned_end_page_or_time).toBe(5);
  });

  it("범위가 1개 episode면 분할하지 않아야 함", () => {
    const singleEpisodePlan: ScheduledPlan = {
      ...basePlan,
      planned_start_page_or_time: 2,
      planned_end_page_or_time: 2,
    };

    const result = splitPlanByEpisodes(singleEpisodePlan, contentDurationMap);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(singleEpisodePlan);
  });

  it("강의가 아니면 분할하지 않아야 함", () => {
    const bookPlan: ScheduledPlan = {
      ...basePlan,
      content_type: "book",
    };

    const result = splitPlanByEpisodes(bookPlan, contentDurationMap);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(bookPlan);
  });

  it("episode 정보가 없으면 분할하지 않아야 함", () => {
    const emptyMap = new Map<string, ContentDurationInfo>();
    emptyMap.set("lecture-123", {
      content_type: "lecture",
      content_id: "lecture-123",
      episodes: null,
    });

    const result = splitPlanByEpisodes(basePlan, emptyMap);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(basePlan);
  });
});

describe("splitPlanTimeInputByEpisodes", () => {
  const basePlan: PlanTimeInput = {
    content_id: "lecture-123",
    content_type: "lecture",
    planned_start_page_or_time: 2,
    planned_end_page_or_time: 5,
    chapter: null,
    block_index: 1,
    _precalculated_start: "10:00",
    _precalculated_end: "12:00",
  };

  const durationInfo: ContentDurationInfo = {
    content_type: "lecture",
    content_id: "lecture-123",
    episodes: [
      { episode_number: 1, duration: 30 },
      { episode_number: 2, duration: 26 },
      { episode_number: 3, duration: 24 },
      { episode_number: 4, duration: 28 },
      { episode_number: 5, duration: 32 },
    ],
  };

  const contentDurationMap = new Map<string, ContentDurationInfo>();
  contentDurationMap.set("lecture-123", durationInfo);

  it("큰 범위를 episode별로 분할하고 pre-calculated time을 제거해야 함", () => {
    const result = splitPlanTimeInputByEpisodes(basePlan, contentDurationMap);

    expect(result).toHaveLength(4); // 2, 3, 4, 5
    expect(result[0].planned_start_page_or_time).toBe(2);
    expect(result[0].planned_end_page_or_time).toBe(2);
    expect(result[0]._precalculated_start).toBeNull();
    expect(result[0]._precalculated_end).toBeNull();
  });

  it("범위가 1개 episode면 분할하지 않아야 함", () => {
    const singleEpisodePlan: PlanTimeInput = {
      ...basePlan,
      planned_start_page_or_time: 2,
      planned_end_page_or_time: 2,
    };

    const result = splitPlanTimeInputByEpisodes(
      singleEpisodePlan,
      contentDurationMap
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(singleEpisodePlan);
  });
});

