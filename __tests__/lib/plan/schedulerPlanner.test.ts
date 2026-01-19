/**
 * Planner 기반 스케줄러 테스트
 *
 * Phase 2: 플랜 시스템 통합 - schedulerPlanner.ts 검증
 *
 * @module __tests__/lib/plan/schedulerPlanner.test
 */

import { describe, it, expect } from "vitest";
import {
  isSingleContentPlanGroup,
  toSingleContentPlanGroup,
  toContentInfoWithPlanGroup,
  buildPlanGroupIdMap,
} from "@/lib/types/plan/scheduler";
import type {
  SingleContentPlanGroup,
  PlannerWithSchedulerOptions,
} from "@/lib/types/plan/scheduler";
import type { PlanGroup } from "@/lib/types/plan/domain";

describe("schedulerPlanner", () => {
  describe("isSingleContentPlanGroup", () => {
    it("단일 콘텐츠 모드 PlanGroup을 올바르게 식별", () => {
      // Given
      const singleContentGroup: PlanGroup = createMockPlanGroup({
        is_single_content: true,
        content_type: "book",
        content_id: "content-123",
        start_range: 1,
        end_range: 100,
      });

      // When & Then
      expect(isSingleContentPlanGroup(singleContentGroup)).toBe(true);
    });

    it("다중 콘텐츠 모드 PlanGroup을 올바르게 식별", () => {
      // Given
      const multiContentGroup: PlanGroup = createMockPlanGroup({
        is_single_content: false,
        content_type: null,
        content_id: null,
        start_range: null,
        end_range: null,
      });

      // When & Then
      expect(isSingleContentPlanGroup(multiContentGroup)).toBe(false);
    });

    it("is_single_content=true이지만 content_id가 없으면 false", () => {
      // Given: 드래프트 상태 (콘텐츠 미선택)
      const draftGroup: PlanGroup = createMockPlanGroup({
        is_single_content: true,
        content_type: null,
        content_id: null,
        start_range: null,
        end_range: null,
      });

      // When & Then
      expect(isSingleContentPlanGroup(draftGroup)).toBe(false);
    });
  });

  describe("toSingleContentPlanGroup", () => {
    it("유효한 PlanGroup을 SingleContentPlanGroup으로 변환", () => {
      // Given
      const planGroup: PlanGroup = createMockPlanGroup({
        id: "pg-123",
        tenant_id: "tenant-1",
        student_id: "student-1",
        planner_id: "planner-1",
        name: "수학 교재",
        period_start: "2025-01-01",
        period_end: "2025-01-31",
        status: "active",
        is_single_content: true,
        content_type: "book",
        content_id: "content-123",
        master_content_id: "master-123",
        start_range: 1,
        end_range: 100,
        start_detail_id: null,
        end_detail_id: null,
        study_type: "weakness",
        strategy_days_per_week: null,
      });

      // When
      const result = toSingleContentPlanGroup(planGroup);

      // Then
      expect(result).not.toBeNull();
      expect(result?.id).toBe("pg-123");
      expect(result?.contentId).toBe("content-123");
      expect(result?.startRange).toBe(1);
      expect(result?.endRange).toBe(100);
      expect(result?.studyType).toBe("weakness");
      expect(result?.isSingleContent).toBe(true);
    });

    it("다중 콘텐츠 모드 PlanGroup은 null 반환", () => {
      // Given
      const multiContentGroup: PlanGroup = createMockPlanGroup({
        is_single_content: false,
      });

      // When
      const result = toSingleContentPlanGroup(multiContentGroup);

      // Then
      expect(result).toBeNull();
    });
  });

  describe("toContentInfoWithPlanGroup", () => {
    it("SingleContentPlanGroup을 ContentInfoWithPlanGroup으로 변환", () => {
      // Given
      const singleContentGroup: SingleContentPlanGroup = {
        id: "pg-123",
        tenantId: "tenant-1",
        studentId: "student-1",
        plannerId: "planner-1",
        name: "수학 교재",
        periodStart: "2025-01-01",
        periodEnd: "2025-01-31",
        status: "active",
        contentType: "book",
        contentId: "content-123",
        masterContentId: "master-123",
        startRange: 1,
        endRange: 100,
        studyType: "strategy",
        strategyDaysPerWeek: 3,
        isSingleContent: true,
      };

      // When
      const result = toContentInfoWithPlanGroup(singleContentGroup);

      // Then
      expect(result.contentId).toBe("content-123");
      expect(result.contentType).toBe("book");
      expect(result.planGroupId).toBe("pg-123");
      expect(result.startRange).toBe(1);
      expect(result.endRange).toBe(100);
      expect(result.studyType).toBe("strategy");
      expect(result.strategyDaysPerWeek).toBe(3);
    });
  });

  describe("buildPlanGroupIdMap", () => {
    it("content_id → plan_group_id 매핑 빌드", () => {
      // Given
      const planGroups: SingleContentPlanGroup[] = [
        createMockSingleContentPlanGroup({
          id: "pg-1",
          contentId: "content-a",
        }),
        createMockSingleContentPlanGroup({
          id: "pg-2",
          contentId: "content-b",
        }),
        createMockSingleContentPlanGroup({
          id: "pg-3",
          contentId: "content-c",
        }),
      ];

      // When
      const map = buildPlanGroupIdMap(planGroups);

      // Then
      expect(map.size).toBe(3);
      expect(map.get("content-a")).toBe("pg-1");
      expect(map.get("content-b")).toBe("pg-2");
      expect(map.get("content-c")).toBe("pg-3");
    });

    it("빈 배열이면 빈 Map 반환", () => {
      // Given
      const planGroups: SingleContentPlanGroup[] = [];

      // When
      const map = buildPlanGroupIdMap(planGroups);

      // Then
      expect(map.size).toBe(0);
    });
  });

  describe("PlannerWithSchedulerOptions 타입", () => {
    it("schedulerOptions에 content_allocations 포함 가능", () => {
      // Given
      const planner: PlannerWithSchedulerOptions = {
        id: "planner-1",
        tenantId: "tenant-1",
        studentId: "student-1",
        name: "기본 플래너",
        periodStart: "2025-01-01",
        periodEnd: "2025-01-31",
        defaultSchedulerType: "simple_recurring",
        schedulerOptions: {
          study_days: 5,
          review_days: 2,
          content_allocations: [
            {
              content_type: "book",
              content_id: "content-1",
              subject_type: "weakness",
            },
            {
              content_type: "lecture",
              content_id: "content-2",
              subject_type: "strategy",
              weekly_days: 3,
            },
            {
              content_type: "custom",
              content_id: "content-3",
              subject_type: "strategy",
              weekly_days: 2,
            },
          ],
        },
        studyHours: null,
        selfStudyHours: null,
        lunchTime: null,
        blockSetId: null,
      };

      // Then
      expect(planner.schedulerOptions.content_allocations).toHaveLength(3);
      expect(planner.schedulerOptions.content_allocations?.[2].content_type).toBe("custom");
    });
  });
});

// ============================================
// 헬퍼 함수
// ============================================

function createMockPlanGroup(overrides: Partial<PlanGroup> = {}): PlanGroup {
  return {
    id: "pg-default",
    tenant_id: "tenant-1",
    student_id: "student-1",
    name: "테스트 그룹",
    plan_purpose: null,
    scheduler_type: "simple_recurring",
    scheduler_options: null,
    period_start: "2025-01-01",
    period_end: "2025-01-31",
    target_date: null,
    block_set_id: null,
    planner_id: "planner-1",
    status: "active",
    deleted_at: null,
    study_hours: null,
    self_study_hours: null,
    lunch_time: null,
    non_study_time_blocks: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // 단일 콘텐츠 필드
    is_single_content: false,
    content_type: null,
    content_id: null,
    master_content_id: null,
    start_range: null,
    end_range: null,
    start_detail_id: null,
    end_detail_id: null,
    study_type: null,
    strategy_days_per_week: null,
    ...overrides,
  };
}

function createMockSingleContentPlanGroup(
  overrides: Partial<SingleContentPlanGroup> = {}
): SingleContentPlanGroup {
  return {
    id: "pg-default",
    tenantId: "tenant-1",
    studentId: "student-1",
    plannerId: "planner-1",
    name: "테스트 그룹",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-31",
    status: "active",
    contentType: "book",
    contentId: "content-default",
    startRange: 1,
    endRange: 100,
    isSingleContent: true,
    ...overrides,
  };
}
