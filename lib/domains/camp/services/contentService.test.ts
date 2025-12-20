import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyExistingContents,
  validateAndResolveContent,
  prepareContentsToSave,
  savePlanContents,
} from "./contentService";
import type { PlanContentInsert } from "@/lib/types/plan/schema";
import type { Json } from "@/lib/supabase/database.types";

// Mock dependencies
vi.mock("@/lib/data/planGroups");
vi.mock("@/lib/data/contentMasters");
vi.mock("@/lib/errors");

describe("contentService", () => {
  let mockSupabase: SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    } as unknown as SupabaseClient;
  });

  describe("classifyExistingContents", () => {
    it("기존 콘텐츠를 학생 콘텐츠와 추천 콘텐츠로 올바르게 분류해야 함", () => {
      const existingContents = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
          is_auto_recommended: false,
          recommendation_source: null,
          recommendation_reason: null,
          recommendation_metadata: null as Json | null,
        },
        {
          content_type: "lecture",
          content_id: "lecture-1",
          start_range: 1,
          end_range: 50,
          display_order: 1,
          master_content_id: null,
          is_auto_recommended: true,
          recommendation_source: "auto" as const,
          recommendation_reason: "자동 추천",
          recommendation_metadata: null as Json | null,
        },
        {
          content_type: "book",
          content_id: "book-2",
          start_range: 101,
          end_range: 200,
          display_order: 2,
          master_content_id: null,
          is_auto_recommended: false,
          recommendation_source: "admin" as const,
          recommendation_reason: "관리자 추천",
          recommendation_metadata: null as Json | null,
        },
      ];

      const result = classifyExistingContents(existingContents);

      expect(result.studentContents).toHaveLength(1);
      expect(result.studentContents[0].content_id).toBe("book-1");
      expect(result.recommendedContents).toHaveLength(2);
      expect(result.recommendedContents[0].content_id).toBe("lecture-1");
      expect(result.recommendedContents[1].content_id).toBe("book-2");
    });

    it("null 입력 시 빈 배열을 반환해야 함", () => {
      const result = classifyExistingContents(null);

      expect(result.studentContents).toHaveLength(0);
      expect(result.recommendedContents).toHaveLength(0);
    });

    it("빈 배열 입력 시 빈 배열을 반환해야 함", () => {
      const result = classifyExistingContents([]);

      expect(result.studentContents).toHaveLength(0);
      expect(result.recommendedContents).toHaveLength(0);
    });

    it("is_auto_recommended가 true인 경우 추천 콘텐츠로 분류해야 함", () => {
      const existingContents = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
          is_auto_recommended: true,
          recommendation_source: null,
          recommendation_reason: null,
          recommendation_metadata: null as Json | null,
        },
      ];

      const result = classifyExistingContents(existingContents);

      expect(result.studentContents).toHaveLength(0);
      expect(result.recommendedContents).toHaveLength(1);
    });

    it("recommendation_source가 있는 경우 추천 콘텐츠로 분류해야 함", () => {
      const existingContents = [
        {
          content_type: "book",
          content_id: "book-1",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
          is_auto_recommended: false,
          recommendation_source: "template" as const,
          recommendation_reason: null,
          recommendation_metadata: null as Json | null,
        },
      ];

      const result = classifyExistingContents(existingContents);

      expect(result.studentContents).toHaveLength(0);
      expect(result.recommendedContents).toHaveLength(1);
    });
  });

  describe("prepareContentsToSave", () => {
    const tenantId = "tenant-123";
    const groupId = "group-123";

    it("새로운 학생 콘텐츠가 있으면 기존 콘텐츠를 대체해야 함", async () => {
      const wizardData = {
        student_contents: [
          {
            content_type: "book",
            content_id: "book-new",
            start_range: 1,
            end_range: 100,
            master_content_id: null,
          },
        ],
      };

      const existingStudentContents: Array<{
        content_type: string;
        content_id: string;
        start_range: number;
        end_range: number;
        display_order: number | null;
        master_content_id: string | null;
        is_auto_recommended: boolean | null;
        recommendation_source: "auto" | "admin" | "template" | null;
        recommendation_reason: string | null;
        recommendation_metadata: Json | null;
      }> = [];
      const existingRecommendedContents: typeof existingStudentContents = [];

      const result = await prepareContentsToSave(
        mockSupabase,
        groupId,
        tenantId,
        wizardData,
        existingStudentContents,
        existingRecommendedContents
      );

      expect(result).toHaveLength(1);
      expect(result[0].content_id).toBe("book-new");
      expect(result[0].is_auto_recommended).toBe(false);
      expect(result[0].recommendation_source).toBeNull();
    });

    it("새로운 추천 콘텐츠가 있으면 기존 콘텐츠를 대체해야 함", async () => {
      const wizardData = {
        recommended_contents: [
          {
            content_type: "lecture",
            content_id: "lecture-new",
            start_range: 1,
            end_range: 50,
            master_content_id: null,
            recommendation_reason: "새 추천",
          },
        ],
      };

      const existingStudentContents: Array<{
        content_type: string;
        content_id: string;
        start_range: number;
        end_range: number;
        display_order: number | null;
        master_content_id: string | null;
        is_auto_recommended: boolean | null;
        recommendation_source: "auto" | "admin" | "template" | null;
        recommendation_reason: string | null;
        recommendation_metadata: Json | null;
      }> = [];
      const existingRecommendedContents: typeof existingStudentContents = [];

      const result = await prepareContentsToSave(
        mockSupabase,
        groupId,
        tenantId,
        wizardData,
        existingStudentContents,
        existingRecommendedContents
      );

      expect(result).toHaveLength(1);
      expect(result[0].content_id).toBe("lecture-new");
      expect(result[0].is_auto_recommended).toBe(false);
      expect(result[0].recommendation_source).toBe("admin");
    });

    it("wizardData에 콘텐츠가 없으면 기존 콘텐츠를 보존해야 함", async () => {
      const wizardData = {};

      const existingStudentContents = [
        {
          content_type: "book",
          content_id: "book-existing",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
          is_auto_recommended: false,
          recommendation_source: null,
          recommendation_reason: null,
          recommendation_metadata: null as Json | null,
        },
      ];

      const existingRecommendedContents: typeof existingStudentContents = [];

      const result = await prepareContentsToSave(
        mockSupabase,
        groupId,
        tenantId,
        wizardData,
        existingStudentContents,
        existingRecommendedContents
      );

      expect(result).toHaveLength(1);
      expect(result[0].content_id).toBe("book-existing");
    });

    it("wizardData에 빈 배열이 있으면 기존 콘텐츠를 보존해야 함", async () => {
      const wizardData = {
        student_contents: [],
      };

      const existingStudentContents = [
        {
          content_type: "book",
          content_id: "book-existing",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
          is_auto_recommended: false,
          recommendation_source: null,
          recommendation_reason: null,
          recommendation_metadata: null as Json | null,
        },
      ];

      const existingRecommendedContents: typeof existingStudentContents = [];

      const result = await prepareContentsToSave(
        mockSupabase,
        groupId,
        tenantId,
        wizardData,
        existingStudentContents,
        existingRecommendedContents
      );

      expect(result).toHaveLength(1);
      expect(result[0].content_id).toBe("book-existing");
    });

    it("학생 콘텐츠와 추천 콘텐츠를 모두 병합해야 함", async () => {
      const wizardData = {
        student_contents: [
          {
            content_type: "book",
            content_id: "book-new",
            start_range: 1,
            end_range: 100,
            master_content_id: null,
          },
        ],
        recommended_contents: [
          {
            content_type: "lecture",
            content_id: "lecture-new",
            start_range: 1,
            end_range: 50,
            master_content_id: null,
          },
        ],
      };

      const existingStudentContents: Array<{
        content_type: string;
        content_id: string;
        start_range: number;
        end_range: number;
        display_order: number | null;
        master_content_id: string | null;
        is_auto_recommended: boolean | null;
        recommendation_source: "auto" | "admin" | "template" | null;
        recommendation_reason: string | null;
        recommendation_metadata: Json | null;
      }> = [];
      const existingRecommendedContents: typeof existingStudentContents = [];

      const result = await prepareContentsToSave(
        mockSupabase,
        groupId,
        tenantId,
        wizardData,
        existingStudentContents,
        existingRecommendedContents
      );

      expect(result).toHaveLength(2);
      expect(result[0].content_id).toBe("book-new");
      expect(result[0].recommendation_source).toBeNull();
      expect(result[1].content_id).toBe("lecture-new");
      expect(result[1].recommendation_source).toBe("admin");
    });
  });

  describe("validateAndResolveContent", () => {
    const studentId = "student-123";
    const tenantId = "tenant-123";

    beforeEach(() => {
      // Mock Supabase query chain
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      });
    });

    it("학생 교재가 존재하면 해당 ID를 반환해야 함", async () => {
      const content: PlanContentInsert = {
        tenant_id: tenantId,
        plan_group_id: "group-123",
        content_type: "book",
        content_id: "book-123",
        start_range: 1,
        end_range: 100,
        display_order: 0,
        master_content_id: null,
      };

      // Mock 학생 교재 조회 성공
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "book-123" },
          error: null,
        }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery);

      const result = await validateAndResolveContent(
        mockSupabase,
        content,
        studentId,
        tenantId
      );

      expect(result.isValid).toBe(true);
      expect(result.actualContentId).toBe("book-123");
    });

    it("마스터 교재를 학생 교재로 복사해야 함", async () => {
      const content: PlanContentInsert = {
        tenant_id: tenantId,
        plan_group_id: "group-123",
        content_type: "book",
        content_id: "master-book-123",
        start_range: 1,
        end_range: 100,
        display_order: 0,
        master_content_id: null,
      };

      // Mock 학생 교재 조회 실패 → 마스터 교재 조회 성공
      const mockStudentBookQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      const mockMasterBookQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "master-book-123" },
          error: null,
        }),
      };

      const mockStudentBookByMasterQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };

      (mockSupabase.from as ReturnType<typeof vi.fn>)
        .mockReturnValueOnce(mockStudentBookQuery) // 학생 교재 조회
        .mockReturnValueOnce(mockMasterBookQuery) // 마스터 교재 조회
        .mockReturnValueOnce(mockStudentBookByMasterQuery); // 학생 교재 by master 조회

      // Mock copyMasterBookToStudent
      const { copyMasterBookToStudent } = await import("@/lib/data/contentMasters");
      vi.mocked(copyMasterBookToStudent).mockResolvedValue({
        bookId: "student-book-123",
      });

      const result = await validateAndResolveContent(
        mockSupabase,
        content,
        studentId,
        tenantId
      );

      expect(result.isValid).toBe(true);
      expect(result.actualContentId).toBe("student-book-123");
    });

    it("커스텀 콘텐츠는 학생 ID로 직접 조회해야 함", async () => {
      const content: PlanContentInsert = {
        tenant_id: tenantId,
        plan_group_id: "group-123",
        content_type: "custom",
        content_id: "custom-123",
        start_range: 1,
        end_range: 100,
        display_order: 0,
        master_content_id: null,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "custom-123" },
          error: null,
        }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery);

      const result = await validateAndResolveContent(
        mockSupabase,
        content,
        studentId,
        tenantId
      );

      expect(result.isValid).toBe(true);
      expect(result.actualContentId).toBe("custom-123");
    });

    it("존재하지 않는 콘텐츠는 유효하지 않다고 판단해야 함", async () => {
      const content: PlanContentInsert = {
        tenant_id: tenantId,
        plan_group_id: "group-123",
        content_type: "book",
        content_id: "nonexistent-book",
        start_range: 1,
        end_range: 100,
        display_order: 0,
        master_content_id: null,
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery);

      const result = await validateAndResolveContent(
        mockSupabase,
        content,
        studentId,
        tenantId
      );

      expect(result.isValid).toBe(false);
    });
  });

  describe("savePlanContents", () => {
    const groupId = "group-123";
    const tenantId = "tenant-123";
    const studentId = "student-123";

    beforeEach(() => {
      vi.mock("@/lib/data/planGroups", () => ({
        createPlanContents: vi.fn().mockResolvedValue({ success: true }),
      }));
    });

    it("빈 배열이면 저장하지 않아야 함", async () => {
      const { createPlanContents } = await import("@/lib/data/planGroups");
      const mockCreatePlanContents = vi.mocked(createPlanContents);

      await savePlanContents(mockSupabase, groupId, tenantId, studentId, []);

      expect(mockCreatePlanContents).not.toHaveBeenCalled();
    });

    it("유효한 콘텐츠만 저장해야 함", async () => {
      const { createPlanContents } = await import("@/lib/data/planGroups");
      const mockCreatePlanContents = vi.mocked(createPlanContents);
      mockCreatePlanContents.mockResolvedValue({ success: true });

      const contentsToSave: PlanContentInsert[] = [
        {
          tenant_id: tenantId,
          plan_group_id: groupId,
          content_type: "book",
          content_id: "book-123",
          start_range: 1,
          end_range: 100,
          display_order: 0,
          master_content_id: null,
        },
      ];

      // Mock validateAndResolveContent를 위해 Supabase 쿼리 모킹
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { id: "book-123" },
          error: null,
        }),
      };
      (mockSupabase.from as ReturnType<typeof vi.fn>).mockReturnValue(mockQuery);

      await savePlanContents(
        mockSupabase,
        groupId,
        tenantId,
        studentId,
        contentsToSave
      );

      expect(mockCreatePlanContents).toHaveBeenCalled();
    });
  });
});

