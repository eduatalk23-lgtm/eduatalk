import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/tenant/getTenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  AppError: class AppError extends Error {
    constructor(
      message: string,
      public code: string,
      public statusCode: number,
      public isOperational: boolean,
      public details?: unknown
    ) {
      super(message);
    }
  },
  ErrorCode: {
    NOT_FOUND: "NOT_FOUND",
    INTERNAL_ERROR: "INTERNAL_ERROR",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
    DATABASE_ERROR: "DATABASE_ERROR",
  },
  withErrorHandling: <T extends (...args: unknown[]) => Promise<unknown>>(
    fn: T
  ) => fn,
}));

import {
  getSlotTemplatePresets,
  createSlotTemplatePreset,
  updateSlotTemplatePreset,
  deleteSlotTemplatePreset,
  setDefaultPreset,
} from "./slotPresets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import type { SlotTemplate } from "@/lib/types/content-selection";

describe("slotPresets", () => {
  const tenantId = "tenant-123";
  const userId = "user-123";
  const presetId = "preset-123";

  const mockSlotTemplates: SlotTemplate[] = [
    {
      slot_index: 0,
      slot_type: "book",
      subject_category: "수학",
    },
    {
      slot_index: 1,
      slot_type: "lecture",
      subject_category: "영어",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(requireAdminOrConsultant).mockResolvedValue({
      userId,
      role: "admin",
      tenantId,
    });

    vi.mocked(getTenantContext).mockResolvedValue({
      tenantId,
      tenantName: "Test Tenant",
      tenantDomain: "test.domain.com",
    });
  });

  describe("getSlotTemplatePresets", () => {
    it("프리셋 목록을 조회해야 함", async () => {
      const mockPresets = [
        {
          id: presetId,
          tenant_id: tenantId,
          name: "기본 프리셋",
          slot_templates: mockSlotTemplates,
          is_default: true,
        },
      ];

      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOrder = vi.fn().mockReturnThis();
      const mockOrder2 = vi.fn().mockResolvedValue({
        data: mockPresets,
        error: null,
      });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: mockSelect,
          eq: mockEq,
          order: mockOrder.mockReturnValueOnce({ order: mockOrder2 }),
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const result = await getSlotTemplatePresets();

      expect(result.success).toBe(true);
      expect(result.presets).toEqual(mockPresets);
    });

    it("테넌트 컨텍스트가 없으면 에러를 throw해야 함", async () => {
      vi.mocked(getTenantContext).mockResolvedValue(null);

      await expect(getSlotTemplatePresets()).rejects.toThrow(
        "기관 정보를 찾을 수 없습니다."
      );
    });

    it("Supabase 클라이언트가 없으면 에러를 throw해야 함", async () => {
      vi.mocked(createSupabaseAdminClient).mockReturnValue(
        null as unknown as ReturnType<typeof createSupabaseAdminClient>
      );

      await expect(getSlotTemplatePresets()).rejects.toThrow(
        "관리자 권한이 필요합니다."
      );
    });
  });

  describe("createSlotTemplatePreset", () => {
    it("새 프리셋을 생성해야 함", async () => {
      const newPreset = {
        id: presetId,
        tenant_id: tenantId,
        name: "새 프리셋",
        slot_templates: mockSlotTemplates,
        is_default: false,
        created_by: userId,
      };

      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: newPreset,
        error: null,
      });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle,
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const result = await createSlotTemplatePreset({
        name: "새 프리셋",
        slot_templates: mockSlotTemplates,
      });

      expect(result.success).toBe(true);
      expect(result.preset).toEqual(newPreset);
    });

    it("이름이 비어있으면 에러를 throw해야 함", async () => {
      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      await expect(
        createSlotTemplatePreset({
          name: "",
          slot_templates: mockSlotTemplates,
        })
      ).rejects.toThrow("프리셋 이름을 입력해주세요.");
    });

    it("이름이 100자를 초과하면 에러를 throw해야 함", async () => {
      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const longName = "a".repeat(101);

      await expect(
        createSlotTemplatePreset({
          name: longName,
          slot_templates: mockSlotTemplates,
        })
      ).rejects.toThrow("프리셋 이름은 100자 이내로 입력해주세요.");
    });

    it("슬롯 템플릿이 비어있으면 에러를 throw해야 함", async () => {
      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      await expect(
        createSlotTemplatePreset({
          name: "테스트",
          slot_templates: [],
        })
      ).rejects.toThrow("슬롯 템플릿이 비어있습니다.");
    });

    it("슬롯이 9개를 초과하면 에러를 throw해야 함", async () => {
      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn(),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const tooManySlots = Array.from({ length: 10 }, (_, i) => ({
        slot_index: i,
        slot_type: "book" as const,
        subject_category: "수학",
      }));

      await expect(
        createSlotTemplatePreset({
          name: "테스트",
          slot_templates: tooManySlots,
        })
      ).rejects.toThrow("슬롯은 최대 9개까지 저장할 수 있습니다.");
    });

    it("중복 이름이면 에러를 throw해야 함", async () => {
      const mockInsert = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "unique violation" },
      });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle,
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      await expect(
        createSlotTemplatePreset({
          name: "중복 이름",
          slot_templates: mockSlotTemplates,
        })
      ).rejects.toThrow("동일한 이름의 프리셋이 이미 존재합니다.");
    });
  });

  describe("updateSlotTemplatePreset", () => {
    it("프리셋을 업데이트해야 함", async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq1 = vi.fn().mockReturnThis();
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
          eq: mockEq1.mockReturnValueOnce({ eq: mockEq2 }),
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const result = await updateSlotTemplatePreset(presetId, {
        name: "수정된 이름",
      });

      expect(result.success).toBe(true);
    });

    it("프리셋 ID가 유효하지 않으면 에러를 throw해야 함", async () => {
      await expect(
        updateSlotTemplatePreset("", { name: "테스트" })
      ).rejects.toThrow("프리셋 ID가 올바르지 않습니다.");
    });
  });

  describe("deleteSlotTemplatePreset", () => {
    it("프리셋을 삭제해야 함", async () => {
      const mockDelete = vi.fn().mockReturnThis();
      const mockEq1 = vi.fn().mockReturnThis();
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          delete: mockDelete,
          eq: mockEq1.mockReturnValueOnce({ eq: mockEq2 }),
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const result = await deleteSlotTemplatePreset(presetId);

      expect(result.success).toBe(true);
    });

    it("프리셋 ID가 유효하지 않으면 에러를 throw해야 함", async () => {
      await expect(deleteSlotTemplatePreset("")).rejects.toThrow(
        "프리셋 ID가 올바르지 않습니다."
      );
    });
  });

  describe("setDefaultPreset", () => {
    it("기본 프리셋을 설정해야 함", async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq1 = vi.fn().mockReturnThis();
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(createSupabaseAdminClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          update: mockUpdate,
          eq: mockEq1.mockReturnValue({ eq: mockEq2 }),
        }),
      } as unknown as ReturnType<typeof createSupabaseAdminClient>);

      const result = await setDefaultPreset(presetId);

      expect(result.success).toBe(true);
    });

    it("프리셋 ID가 유효하지 않으면 에러를 throw해야 함", async () => {
      await expect(setDefaultPreset("")).rejects.toThrow(
        "프리셋 ID가 올바르지 않습니다."
      );
    });
  });
});
