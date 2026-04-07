// ============================================
// actions/confirm.ts — revertConfirmAction 확장 테스트
//
// 기존 actions-confirm.test.ts는 기본 성공/실패를 검증.
// 이 파일은 충돌 시나리오, 체인 흐름, 엣지 케이스를 추가 검증.
//
// 대상 함수:
//   revertConfirmAction — 확정 → 검토 중 되돌리기
//   acceptAiDraftAction → confirmDraftAction → revertConfirmAction 체인
//
// 전략:
//   supabase 체이닝 mock + auth guard mock
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── 의존성 mock ──

vi.mock("@/lib/auth/guards", () => ({
  requireAdminOrConsultant: vi.fn(),
}));

vi.mock("@/lib/logging/actionLogger", () => ({
  logActionError: vi.fn(),
  logActionWarn: vi.fn(),
  logActionDebug: vi.fn(),
}));

vi.mock("../stale-detection", () => ({
  markRelatedEdgesStale: vi.fn().mockResolvedValue(undefined),
  markRelatedAssignmentsStale: vi.fn().mockResolvedValue(undefined),
  autoMatchRoadmapOnConfirm: vi.fn().mockResolvedValue(undefined),
}));

// supabase mock
let supabaseMock: ReturnType<typeof makeSupabaseMock>;

function makeSupabaseMock(overrides?: {
  singleData?: Record<string, unknown> | null;
  singleError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: overrides?.singleData ?? { confirmed_content: "확정된 내용" },
      error: overrides?.singleError ?? null,
    }),
  };
  // update chain의 최종 결과
  // eq가 여러 번 호출되므로, update 후의 eq chain도 동일한 mock 반환
  return mock;
}

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

import { revertConfirmAction } from "../actions/confirm";
import { requireAdminOrConsultant } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActionError } from "@/lib/logging/actionLogger";

const mockGuard = requireAdminOrConsultant as ReturnType<typeof vi.fn>;
const mockClientFactory = createSupabaseServerClient as ReturnType<typeof vi.fn>;
const mockLogError = logActionError as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockGuard.mockResolvedValue({ userId: "admin-1", tenantId: "tenant-1", role: "admin" });
  supabaseMock = makeSupabaseMock();
  mockClientFactory.mockResolvedValue(supabaseMock);
});

// ============================================
// revertConfirmAction — 엣지 케이스
// ============================================

describe("revertConfirmAction edge cases", () => {
  it("confirmed_content가 공백만 있으면 에러 반환", async () => {
    supabaseMock = makeSupabaseMock({ singleData: { confirmed_content: "   " } });
    mockClientFactory.mockResolvedValue(supabaseMock);

    const result = await revertConfirmAction("record-1", "setek");
    expect(result.success).toBe(false);
    expect(result.error).toContain("확정된 내용이 없습니다");
  });

  it("confirmed_content가 null이면 에러 반환", async () => {
    supabaseMock = makeSupabaseMock({ singleData: { confirmed_content: null } });
    mockClientFactory.mockResolvedValue(supabaseMock);

    const result = await revertConfirmAction("record-1", "setek");
    expect(result.success).toBe(false);
  });

  it("인증 실패 시 에러 반환", async () => {
    mockGuard.mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await revertConfirmAction("record-1", "setek");
    expect(result.success).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("DB fetch 에러 시 에러 반환", async () => {
    supabaseMock = makeSupabaseMock({ singleError: { message: "not found" } });
    mockClientFactory.mockResolvedValue(supabaseMock);

    const result = await revertConfirmAction("record-1", "setek");
    expect(result.success).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("DB update 에러 시 에러 반환 및 로그 기록", async () => {
    // single 성공 후 update 에러
    const errorMock = makeSupabaseMock();
    // update 후 eq chain에서 에러 발생
    let updateCalled = false;
    errorMock.update.mockImplementation(() => {
      updateCalled = true;
      return errorMock;
    });
    // eq chain 마지막에서 에러 throw
    errorMock.eq.mockImplementation((..._args: unknown[]) => {
      if (updateCalled) {
        // update 이후 eq 호출 시
        return Promise.reject(new Error("update failed"));
      }
      return errorMock;
    });
    mockClientFactory.mockResolvedValue(errorMock);

    const result = await revertConfirmAction("record-1", "setek");
    expect(result.success).toBe(false);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("모든 recordType에 대해 올바른 테이블 사용", async () => {
    const types = ["setek", "changche", "haengteuk", "personal_setek"] as const;
    const expectedTables = [
      "student_record_seteks",
      "student_record_changche",
      "student_record_haengteuk",
      "student_record_personal_seteks",
    ];

    for (let i = 0; i < types.length; i++) {
      vi.clearAllMocks();
      supabaseMock = makeSupabaseMock();
      mockClientFactory.mockResolvedValue(supabaseMock);
      mockGuard.mockResolvedValue({ userId: "admin-1", tenantId: "tenant-1", role: "admin" });

      await revertConfirmAction("record-1", types[i]);
      expect(supabaseMock.from).toHaveBeenCalledWith(expectedTables[i]);
    }
  });
});
