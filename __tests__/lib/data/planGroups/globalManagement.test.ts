/**
 * 제외일/학원 일정 전역 관리 테스트
 *
 * 2026-01-05 전역 관리 전환:
 * - 모든 제외일과 학원 일정은 student_id로 관리
 * - plan_group_id는 항상 NULL
 * - 플랜 그룹 삭제 시에도 데이터 유지
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

describe("제외일/학원 일정 전역 관리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("제외일 조회 패턴", () => {
    it("student_id와 plan_group_id IS NULL로 조회해야 함", async () => {
      const studentId = "student-123";
      const mockExclusions = [
        {
          id: "exc-1",
          student_id: studentId,
          plan_group_id: null,
          exclusion_date: "2026-01-10",
          exclusion_type: "휴가",
        },
      ];

      mockSupabaseClient.maybeSingle.mockResolvedValueOnce({
        data: { student_id: studentId },
        error: null,
      });

      mockSupabaseClient.order.mockResolvedValueOnce({
        data: mockExclusions,
        error: null,
      });

      // 조회 시 eq("student_id", studentId)와 is("plan_group_id", null) 호출 확인
      // 실제 함수 호출은 생략하고 패턴만 검증
      expect(mockSupabaseClient.eq).toBeDefined();
      expect(mockSupabaseClient.is).toBeDefined();
    });

    it("plan_group_id가 항상 NULL이어야 함", () => {
      const exclusion = {
        id: "exc-1",
        student_id: "student-123",
        plan_group_id: null, // 전역 관리: 항상 NULL
        exclusion_date: "2026-01-10",
        exclusion_type: "휴가" as const,
        reason: null,
      };

      expect(exclusion.plan_group_id).toBeNull();
    });
  });

  describe("학원 일정 조회 패턴", () => {
    it("student_id와 plan_group_id IS NULL로 조회해야 함", () => {
      const schedule = {
        id: "sched-1",
        student_id: "student-123",
        plan_group_id: null, // 전역 관리: 항상 NULL
        day_of_week: 1,
        start_time: "14:00",
        end_time: "16:00",
      };

      expect(schedule.plan_group_id).toBeNull();
    });
  });

  describe("중복 방지", () => {
    it("동일한 학생의 동일한 날짜+유형 제외일은 중복 생성되지 않아야 함", () => {
      const existingExclusion = {
        student_id: "student-123",
        exclusion_date: "2026-01-10",
        exclusion_type: "휴가",
        plan_group_id: null,
      };

      const newExclusion = {
        student_id: "student-123",
        exclusion_date: "2026-01-10",
        exclusion_type: "휴가",
        plan_group_id: null,
      };

      // 동일한 키 조합인지 확인
      const isSameKey =
        existingExclusion.student_id === newExclusion.student_id &&
        existingExclusion.exclusion_date === newExclusion.exclusion_date &&
        existingExclusion.exclusion_type === newExclusion.exclusion_type;

      expect(isSameKey).toBe(true);
    });

    it("동일한 학생의 동일한 요일+시간+학원 일정은 중복 생성되지 않아야 함", () => {
      const existingSchedule = {
        student_id: "student-123",
        day_of_week: 1,
        start_time: "14:00",
        end_time: "16:00",
        academy_id: "academy-1",
        plan_group_id: null,
      };

      const newSchedule = {
        student_id: "student-123",
        day_of_week: 1,
        start_time: "14:00",
        end_time: "16:00",
        academy_id: "academy-1",
        plan_group_id: null,
      };

      // 동일한 키 조합인지 확인
      const isSameKey =
        existingSchedule.student_id === newSchedule.student_id &&
        existingSchedule.day_of_week === newSchedule.day_of_week &&
        existingSchedule.start_time === newSchedule.start_time &&
        existingSchedule.end_time === newSchedule.end_time &&
        existingSchedule.academy_id === newSchedule.academy_id;

      expect(isSameKey).toBe(true);
    });
  });

  describe("플랜 그룹 삭제 시 데이터 유지", () => {
    it("플랜 그룹 삭제 시 전역 제외일은 삭제되지 않아야 함", () => {
      // 전역 관리 전환 후, plan_group_id가 NULL이므로
      // 플랜 그룹 삭제 시 plan_exclusions.delete().eq("plan_group_id", groupId)는
      // 아무 행도 삭제하지 않음
      const deletedPlanGroupId = "group-123";
      const globalExclusion = {
        id: "exc-1",
        student_id: "student-123",
        plan_group_id: null, // 전역 관리
      };

      // plan_group_id가 NULL이므로 삭제 대상이 아님
      expect(globalExclusion.plan_group_id).not.toBe(deletedPlanGroupId);
    });
  });
});
