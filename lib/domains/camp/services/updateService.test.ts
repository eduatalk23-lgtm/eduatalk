import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  updatePlanGroupMetadata,
  updatePlanExclusions,
  updateAcademySchedules,
} from "./updateService";
import type { PlanGroupSchedulerOptions } from "@/lib/types/schedulerSettings";
import type { DailyScheduleInfo } from "@/lib/types/plan";

// Mock dependencies
vi.mock("@/lib/utils/schedulerOptionsMerge");
vi.mock("@/lib/data/planGroups");
vi.mock("@/lib/errors");

describe("updateService", () => {
  let mockSupabase: SupabaseClient;
  const groupId = "group-123";
  const tenantId = "tenant-123";
  const studentId = "student-123";

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    } as unknown as SupabaseClient;
  });

  describe("updatePlanGroupMetadata", () => {
    it("플랜 그룹 메타데이터를 올바르게 업데이트해야 함", async () => {
      const { mergeTimeSettingsSafely } = await import(
        "@/lib/utils/schedulerOptionsMerge"
      );
      vi.mocked(mergeTimeSettingsSafely).mockReturnValue({
        someOption: "value",
      } as PlanGroupSchedulerOptions);

      const creationData = {
        name: "테스트 플랜",
        plan_purpose: "수능",
        scheduler_type: "auto",
        period_start: "2025-01-01",
        period_end: "2025-12-31",
        plan_type: "camp",
      };

      // Mock update query
      const mockUpdate = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: vi.fn().mockReturnValue(mockUpdate),
      });

      await updatePlanGroupMetadata(
        mockSupabase,
        groupId,
        tenantId,
        creationData
      );

      expect(mockSupabase.from).toHaveBeenCalledWith("plan_groups");
      expect(mockUpdate.eq).toHaveBeenCalledWith("id", groupId);
      expect(mockUpdate.eq).toHaveBeenCalledWith("tenant_id", tenantId);
    });

    it("plan_purpose를 정규화해야 함 (수능 → 모의고사(수능))", async () => {
      const { mergeTimeSettingsSafely } = await import(
        "@/lib/utils/schedulerOptionsMerge"
      );
      vi.mocked(mergeTimeSettingsSafely).mockReturnValue({});

      const creationData = {
        plan_purpose: "수능",
      };

      const mockUpdate = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: vi.fn().mockReturnValue(mockUpdate),
      });

      await updatePlanGroupMetadata(
        mockSupabase,
        groupId,
        tenantId,
        creationData
      );

      // update 호출 시 plan_purpose가 "모의고사(수능)"으로 정규화되었는지 확인
      const updateCall = (mockSupabase.from as ReturnType<typeof vi.fn>).mock
        .results[0].value.update as ReturnType<typeof vi.fn>;
      const updatePayload = updateCall.mock.calls[0][0];

      expect(updatePayload.plan_purpose).toBe("모의고사(수능)");
    });

    it("에러 발생 시 AppError를 throw해야 함", async () => {
      const { mergeTimeSettingsSafely } = await import(
        "@/lib/utils/schedulerOptionsMerge"
      );
      vi.mocked(mergeTimeSettingsSafely).mockReturnValue({});

      const creationData = {
        name: "테스트 플랜",
      };

      const mockUpdate = {
        eq: vi.fn().mockResolvedValue({
          error: { message: "업데이트 실패" },
        }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: vi.fn().mockReturnValue(mockUpdate),
      });

      await expect(
        updatePlanGroupMetadata(mockSupabase, groupId, tenantId, creationData)
      ).rejects.toThrow();
    });
  });

  describe("updatePlanExclusions", () => {
    it("제외일이 undefined이면 아무것도 하지 않아야 함", async () => {
      await updatePlanExclusions(mockSupabase, groupId, tenantId, undefined);

      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("제외일 배열이 비어있으면 삭제만 수행해야 함", async () => {
      const mockDelete = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: vi.fn().mockReturnValue(mockDelete),
      });

      const { createPlanExclusions } = await import("@/lib/data/planGroups");
      vi.mocked(createPlanExclusions).mockResolvedValue({ success: true });

      await updatePlanExclusions(mockSupabase, groupId, tenantId, []);

      expect(mockSupabase.from).toHaveBeenCalledWith("plan_exclusions");
      expect(mockDelete.eq).toHaveBeenCalledWith("plan_group_id", groupId);
    });

    it("새로운 제외일을 생성해야 함", async () => {
      const exclusions = [
        {
          exclusion_date: "2025-01-01",
          exclusion_type: "holiday",
          reason: "신정",
        },
        {
          exclusion_date: "2025-01-15",
          exclusion_type: "exam",
          reason: null,
        },
      ];

      const mockDelete = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: vi.fn().mockReturnValue(mockDelete),
      });

      const { createPlanExclusions } = await import("@/lib/data/planGroups");
      vi.mocked(createPlanExclusions).mockResolvedValue({ success: true });

      await updatePlanExclusions(
        mockSupabase,
        groupId,
        tenantId,
        exclusions
      );

      expect(createPlanExclusions).toHaveBeenCalledWith(
        groupId,
        tenantId,
        expect.arrayContaining([
          expect.objectContaining({
            exclusion_date: "2025-01-01",
            exclusion_type: "holiday",
            reason: "신정",
          }),
          expect.objectContaining({
            exclusion_date: "2025-01-15",
            exclusion_type: "exam",
            reason: null,
          }),
        ])
      );
    });

    it("제외일 생성 실패 시 AppError를 throw해야 함", async () => {
      const exclusions = [
        {
          exclusion_date: "2025-01-01",
          exclusion_type: "holiday",
          reason: "신정",
        },
      ];

      const mockDelete = {
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        delete: vi.fn().mockReturnValue(mockDelete),
      });

      const { createPlanExclusions } = await import("@/lib/data/planGroups");
      vi.mocked(createPlanExclusions).mockResolvedValue({
        success: false,
        error: "생성 실패",
      });

      await expect(
        updatePlanExclusions(mockSupabase, groupId, tenantId, exclusions)
      ).rejects.toThrow();
    });
  });

  describe("updateAcademySchedules", () => {
    beforeEach(() => {
      vi.mock("@/lib/data/planGroups", () => ({
        getStudentAcademySchedules: vi.fn().mockResolvedValue([]),
        createStudentAcademySchedules: vi.fn().mockResolvedValue({
          success: true,
        }),
      }));
    });

    it("학원 일정이 undefined이면 아무것도 하지 않아야 함", async () => {
      await updateAcademySchedules(
        mockSupabase,
        studentId,
        tenantId,
        undefined
      );

      const { getStudentAcademySchedules } = await import(
        "@/lib/data/planGroups"
      );
      expect(getStudentAcademySchedules).not.toHaveBeenCalled();
    });

    it("중복되지 않은 새로운 학원 일정만 추가해야 함", async () => {
      const { getStudentAcademySchedules, createStudentAcademySchedules } =
        await import("@/lib/data/planGroups");

      // 기존 일정 모킹
      vi.mocked(getStudentAcademySchedules).mockResolvedValue([
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "12:00",
          academy_name: "기존 학원",
          subject: "수학",
        },
      ]);

      vi.mocked(createStudentAcademySchedules).mockResolvedValue({
        success: true,
      });

      const academySchedules = [
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "12:00",
          academy_name: "기존 학원",
          subject: "수학",
        },
        {
          day_of_week: 2,
          start_time: "14:00",
          end_time: "17:00",
          academy_name: "새 학원",
          subject: "영어",
        },
      ];

      await updateAcademySchedules(
        mockSupabase,
        studentId,
        tenantId,
        academySchedules
      );

      // 중복되지 않은 것만 추가되어야 함
      expect(createStudentAcademySchedules).toHaveBeenCalledWith(
        studentId,
        tenantId,
        [
          {
            day_of_week: 2,
            start_time: "14:00",
            end_time: "17:00",
            academy_name: "새 학원",
            subject: "영어",
          },
        ],
        true
      );
    });

    it("모든 학원 일정이 이미 존재하면 추가하지 않아야 함", async () => {
      const { getStudentAcademySchedules, createStudentAcademySchedules } =
        await import("@/lib/data/planGroups");

      // 기존 일정 모킹
      vi.mocked(getStudentAcademySchedules).mockResolvedValue([
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "12:00",
          academy_name: "기존 학원",
          subject: "수학",
        },
      ]);

      vi.mocked(createStudentAcademySchedules).mockResolvedValue({
        success: true,
      });

      const academySchedules = [
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "12:00",
          academy_name: "기존 학원",
          subject: "수학",
        },
      ];

      await updateAcademySchedules(
        mockSupabase,
        studentId,
        tenantId,
        academySchedules
      );

      // 추가되지 않아야 함
      expect(createStudentAcademySchedules).not.toHaveBeenCalled();
    });

    it("학원 일정 생성 실패 시 AppError를 throw해야 함", async () => {
      const { getStudentAcademySchedules, createStudentAcademySchedules } =
        await import("@/lib/data/planGroups");

      vi.mocked(getStudentAcademySchedules).mockResolvedValue([]);
      vi.mocked(createStudentAcademySchedules).mockResolvedValue({
        success: false,
        error: "생성 실패",
      });

      const academySchedules = [
        {
          day_of_week: 1,
          start_time: "09:00",
          end_time: "12:00",
          academy_name: "새 학원",
          subject: "수학",
        },
      ];

      await expect(
        updateAcademySchedules(
          mockSupabase,
          studentId,
          tenantId,
          academySchedules
        )
      ).rejects.toThrow();
    });
  });
});

