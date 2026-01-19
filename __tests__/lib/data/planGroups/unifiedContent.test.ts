/**
 * 플랜 그룹 통합 콘텐츠 접근 모듈 테스트
 *
 * Phase 5: unifiedContent.ts 검증
 *
 * @module __tests__/lib/data/planGroups/unifiedContent.test
 */

import { describe, it, expect, vi } from "vitest";
import {
  getSingleContentFromGroup,
  hasContent,
  getContentMode,
} from "@/lib/data/planGroups/unifiedContent";
import type { PlanGroup } from "@/lib/types/plan/domain";

describe("unifiedContent", () => {
  describe("getSingleContentFromGroup", () => {
    it("단일 콘텐츠 모드 그룹에서 콘텐츠 정보 추출", () => {
      // Given
      const group = createMockPlanGroup({
        is_single_content: true,
        content_type: "book",
        content_id: "content-123",
        master_content_id: "master-123",
        start_range: 1,
        end_range: 100,
      });

      // When
      const result = getSingleContentFromGroup(group);

      // Then
      expect(result).not.toBeNull();
      expect(result?.content_type).toBe("book");
      expect(result?.content_id).toBe("content-123");
      expect(result?.master_content_id).toBe("master-123");
      expect(result?.start_range).toBe(1);
      expect(result?.end_range).toBe(100);
      expect(result?.from_single_content_mode).toBe(true);
      expect(result?.display_order).toBe(0);
    });

    it("다중 콘텐츠 모드 그룹은 null 반환", () => {
      // Given
      const group = createMockPlanGroup({
        is_single_content: false,
        content_id: null,
      });

      // When
      const result = getSingleContentFromGroup(group);

      // Then
      expect(result).toBeNull();
    });

    it("단일 콘텐츠 모드이지만 content_id가 없으면 null 반환", () => {
      // Given: 드래프트 상태
      const group = createMockPlanGroup({
        is_single_content: true,
        content_id: null,
      });

      // When
      const result = getSingleContentFromGroup(group);

      // Then
      expect(result).toBeNull();
    });

    it("content_type이 null이면 기본값 'book' 사용", () => {
      // Given
      const group = createMockPlanGroup({
        is_single_content: true,
        content_type: null,
        content_id: "content-123",
      });

      // When
      const result = getSingleContentFromGroup(group);

      // Then
      expect(result?.content_type).toBe("book");
    });
  });

  describe("hasContent", () => {
    it("단일 콘텐츠 모드 - content_id가 있으면 true", () => {
      const group = createMockPlanGroup({
        is_single_content: true,
        content_id: "content-123",
      });

      expect(hasContent(group)).toBe(true);
    });

    it("단일 콘텐츠 모드 - content_id가 없으면 false", () => {
      const group = createMockPlanGroup({
        is_single_content: true,
        content_id: null,
      });

      expect(hasContent(group)).toBe(false);
    });

    it("슬롯 모드 - content_slots가 있으면 true", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: true,
        content_slots: [{ slot_index: 0, content_id: "content-1" }],
      });

      expect(hasContent(group)).toBe(true);
    });

    it("슬롯 모드 - content_slots가 비어있으면 false", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: true,
        content_slots: [],
      });

      expect(hasContent(group)).toBe(false);
    });

    it("다중 콘텐츠 모드 - false 반환 (DB 조회 필요)", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: false,
      });

      expect(hasContent(group)).toBe(false);
    });
  });

  describe("getContentMode", () => {
    it("단일 콘텐츠 모드 식별", () => {
      const group = createMockPlanGroup({
        is_single_content: true,
        content_id: "content-123",
      });

      expect(getContentMode(group)).toBe("single");
    });

    it("슬롯 모드 식별", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: true,
        content_slots: [{ slot_index: 0, content_id: "content-1" }],
      });

      expect(getContentMode(group)).toBe("slot");
    });

    it("레거시 다중 콘텐츠 모드 식별", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: false,
      });

      expect(getContentMode(group)).toBe("legacy_multi");
    });

    it("빈 그룹 식별 (단일 콘텐츠 모드이지만 content_id 없음)", () => {
      const group = createMockPlanGroup({
        is_single_content: true,
        content_id: null,
      });

      expect(getContentMode(group)).toBe("empty");
    });

    it("빈 슬롯 모드 그룹 식별", () => {
      const group = createMockPlanGroup({
        is_single_content: false,
        use_slot_mode: true,
        content_slots: [],
      });

      // 슬롯 모드이지만 content_slots가 비어있으면 legacy_multi로 분류됨
      expect(getContentMode(group)).toBe("legacy_multi");
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
    // 슬롯 모드 필드
    use_slot_mode: false,
    content_slots: null,
    ...overrides,
  };
}
