/**
 * Batch Actions 단위 테스트
 *
 * createBatchUnifiedPlans Server Action 테스트
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/domains/plan/llm/actions/unifiedPlanGeneration", () => ({
  runUnifiedPlanGenerationPipeline: vi.fn(),
  mapWizardToUnifiedInput: vi.fn(),
  validateWizardDataForPipeline: vi.fn(),
}));

import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";
import {
  runUnifiedPlanGenerationPipeline,
  mapWizardToUnifiedInput,
  validateWizardDataForPipeline,
} from "@/lib/domains/plan/llm/actions/unifiedPlanGeneration";
import { createBatchUnifiedPlans, type UnifiedPlanBatchInput, type BatchStudentInput } from "../batchActions";

const mockRequireAdminOrConsultant = vi.mocked(requireAdminOrConsultant);
const mockValidateWizardDataForPipeline = vi.mocked(validateWizardDataForPipeline);
const mockMapWizardToUnifiedInput = vi.mocked(mapWizardToUnifiedInput);
const mockRunUnifiedPlanGenerationPipeline = vi.mocked(runUnifiedPlanGenerationPipeline);
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("createBatchUnifiedPlans", () => {
  const mockTenantId = "tenant-123";
  const mockUserId = "user-123";

  const defaultStudents: BatchStudentInput[] = [
    { studentId: "student-1", studentName: "홍길동" },
    { studentId: "student-2", studentName: "김철수" },
  ];

  const defaultSettings: UnifiedPlanBatchInput = {
    name: "1학기 수학 플랜",
    planPurpose: "내신대비",
    periodStart: "2025-03-01",
    periodEnd: "2025-03-31",
    contentSelection: {
      subjectCategory: "수학",
      subject: "미적분",
      difficulty: "개념",
      contentType: "book",
    },
    schedulerOptions: {
      study_days: 6,
      review_days: 1,
      student_level: "medium",
    },
    studyType: "weakness",
    generateMarkdown: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockRequireAdminOrConsultant.mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      role: "admin",
    });

    mockValidateWizardDataForPipeline.mockReturnValue({
      valid: true,
      errors: [],
    });

    mockMapWizardToUnifiedInput.mockReturnValue({
      studentId: "student-1",
      tenantId: mockTenantId,
      planName: "1학기 수학 플랜",
      planPurpose: "내신대비",
      periodStart: "2025-03-01",
      periodEnd: "2025-03-31",
      timeSettings: {
        studyHours: { start: "09:00", end: "22:00" },
      },
      generationOptions: {
        saveToDb: true,
        generateMarkdown: true,
        dryRun: false,
      },
    });
  });

  describe("권한 검증", () => {
    it("관리자/상담사 권한이 없으면 실패", async () => {
      mockRequireAdminOrConsultant.mockRejectedValue(new Error("권한이 없습니다"));

      const result = await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(result.success).toBe(false);
      expect(result.error).toContain("권한");
      expect(result.failedCount).toBe(defaultStudents.length);
    });

    it("tenantId가 없는 학생은 개별 실패 처리", async () => {
      mockRequireAdminOrConsultant.mockResolvedValue({
        userId: mockUserId,
        tenantId: null, // tenantId 없음
        role: "admin",
      });

      const studentsWithoutTenant: BatchStudentInput[] = [
        { studentId: "student-1", studentName: "홍길동" }, // tenantId 없음
      ];

      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "테스트", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      const result = await createBatchUnifiedPlans(studentsWithoutTenant, defaultSettings);

      expect(result.results[0].success).toBe(false);
      expect(result.results[0].error).toBe("tenant_id_required");
    });
  });

  describe("입력 검증", () => {
    it("검증 실패 시 전체 배치 실패 반환", async () => {
      mockValidateWizardDataForPipeline.mockReturnValue({
        valid: false,
        errors: ["이름은 필수입니다", "기간이 올바르지 않습니다"],
      });

      const result = await createBatchUnifiedPlans(defaultStudents, {
        ...defaultSettings,
        name: "",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("입력 검증 실패");
      expect(result.error).toContain("이름은 필수입니다");
      expect(result.failedCount).toBe(defaultStudents.length);
      expect(result.successCount).toBe(0);
    });

    it("검증 통과 시 파이프라인 실행", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "1학기 수학 플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [{ id: "plan-1" }, { id: "plan-2" }],
        markdown: "# 플랜",
      });

      const result = await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(mockValidateWizardDataForPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          name: defaultSettings.name,
          planPurpose: defaultSettings.planPurpose,
          periodStart: defaultSettings.periodStart,
          periodEnd: defaultSettings.periodEnd,
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe("파이프라인 실행", () => {
    it("모든 학생에 대해 파이프라인 성공 시 전체 성공", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "1학기 수학 플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [{ id: "plan-1" }, { id: "plan-2" }, { id: "plan-3" }],
        markdown: "# 플랜 마크다운",
        validation: { warnings: [] },
      });

      const result = await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(result.success).toBe(true);
      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(2);

      // 각 학생의 결과 확인
      expect(result.results[0]).toMatchObject({
        studentId: "student-1",
        studentName: "홍길동",
        success: true,
        planGroupId: "group-1",
        planCount: 3,
        markdown: "# 플랜 마크다운",
      });
      expect(result.results[1]).toMatchObject({
        studentId: "student-2",
        studentName: "김철수",
        success: true,
      });
    });

    it("일부 학생 파이프라인 실패 시 부분 성공", async () => {
      mockRunUnifiedPlanGenerationPipeline
        .mockResolvedValueOnce({
          success: true,
          planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
          plans: [{ id: "plan-1" }],
        })
        .mockResolvedValueOnce({
          success: false,
          failedAt: "schedule_generation",
          error: "스케줄 생성 실패",
        });

      const result = await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(result.success).toBe(false); // 하나라도 실패하면 전체 성공 아님
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);

      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
      expect(result.results[1].message).toContain("schedule_generation");
    });

    it("파이프라인에서 예외 발생 시 개별 실패 처리", async () => {
      mockRunUnifiedPlanGenerationPipeline
        .mockResolvedValueOnce({
          success: true,
          planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
          plans: [],
        })
        .mockRejectedValueOnce(new Error("네트워크 오류"));

      const result = await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
      expect(result.results[1].error).toBe("네트워크 오류");
    });
  });

  describe("콘텐츠 선택", () => {
    it("contentSelection이 있으면 파이프라인 입력에 포함", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      await createBatchUnifiedPlans(
        [{ studentId: "student-1", studentName: "홍길동" }],
        {
          ...defaultSettings,
          contentSelection: {
            subjectCategory: "영어",
            subject: "독해",
            difficulty: "심화",
            contentType: "lecture",
          },
        }
      );

      expect(mockRunUnifiedPlanGenerationPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSelection: expect.objectContaining({
            subjectCategory: "영어",
            subject: "독해",
            difficulty: "심화",
            contentType: "lecture",
            maxResults: 5,
          }),
        })
      );
    });

    it("contentSelection 기본값 적용", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      await createBatchUnifiedPlans(
        [{ studentId: "student-1", studentName: "홍길동" }],
        {
          ...defaultSettings,
          contentSelection: {
            subjectCategory: "수학",
            // subject, difficulty, contentType 생략
          },
        }
      );

      expect(mockRunUnifiedPlanGenerationPipeline).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSelection: expect.objectContaining({
            subjectCategory: "수학",
            difficulty: "개념", // 기본값
            contentType: "book", // 기본값
          }),
        })
      );
    });
  });

  describe("학생별 tenantId 처리", () => {
    it("학생에 tenantId가 있으면 해당 값 사용", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      const studentsWithTenant: BatchStudentInput[] = [
        { studentId: "student-1", studentName: "홍길동", tenantId: "custom-tenant" },
      ];

      await createBatchUnifiedPlans(studentsWithTenant, defaultSettings);

      expect(mockMapWizardToUnifiedInput).toHaveBeenCalledWith(
        expect.anything(),
        "student-1",
        "custom-tenant", // 학생의 tenantId 사용
        expect.anything()
      );
    });

    it("학생에 tenantId가 없으면 현재 사용자의 tenantId 사용", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      const studentsWithoutTenant: BatchStudentInput[] = [
        { studentId: "student-1", studentName: "홍길동" }, // tenantId 없음
      ];

      await createBatchUnifiedPlans(studentsWithoutTenant, defaultSettings);

      expect(mockMapWizardToUnifiedInput).toHaveBeenCalledWith(
        expect.anything(),
        "student-1",
        mockTenantId, // 현재 사용자의 tenantId 사용
        expect.anything()
      );
    });
  });

  describe("경로 재검증", () => {
    it("성공 시 관련 경로 재검증", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      await createBatchUnifiedPlans(defaultStudents, defaultSettings);

      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/students");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/plan-creation");
    });
  });

  describe("경고 메시지 전달", () => {
    it("파이프라인 경고가 있으면 결과에 포함", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [{ id: "plan-1" }],
        validation: {
          warnings: [
            { type: "overlap", message: "일부 시간이 겹칩니다" },
            { type: "short_session", message: "세션이 너무 짧습니다" },
          ],
        },
      });

      const result = await createBatchUnifiedPlans(
        [{ studentId: "student-1", studentName: "홍길동" }],
        defaultSettings
      );

      expect(result.results[0].warnings).toEqual([
        "일부 시간이 겹칩니다",
        "세션이 너무 짧습니다",
      ]);
    });
  });

  describe("마크다운 생성 옵션", () => {
    it("generateMarkdown이 false면 마크다운 생성 안함", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
        markdown: undefined,
      });

      await createBatchUnifiedPlans(
        [{ studentId: "student-1", studentName: "홍길동" }],
        { ...defaultSettings, generateMarkdown: false }
      );

      expect(mockMapWizardToUnifiedInput).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          generateMarkdown: false,
        })
      );
    });

    it("generateMarkdown 기본값은 true", async () => {
      mockRunUnifiedPlanGenerationPipeline.mockResolvedValue({
        success: true,
        planGroup: { id: "group-1", name: "플랜", periodStart: "2025-03-01", periodEnd: "2025-03-31" },
        plans: [],
      });

      const settingsWithoutMarkdownOption = { ...defaultSettings };
      delete settingsWithoutMarkdownOption.generateMarkdown;

      await createBatchUnifiedPlans(
        [{ studentId: "student-1", studentName: "홍길동" }],
        settingsWithoutMarkdownOption
      );

      expect(mockMapWizardToUnifiedInput).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          generateMarkdown: true,
        })
      );
    });
  });
});
