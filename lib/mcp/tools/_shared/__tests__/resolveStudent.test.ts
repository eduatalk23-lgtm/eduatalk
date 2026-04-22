// ============================================
// G-6 Sprint 4 — resolveStudentTarget 의 role 분기 검증.
// 특히 Option A: superadmin cross-tenant 경로.
// ============================================

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));
vi.mock("@/lib/data/students", () => ({
  getStudentById: vi.fn(),
}));
vi.mock("@/lib/domains/student/actions/search", () => ({
  searchStudentsAction: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

import { resolveStudentTarget } from "../resolveStudent";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { searchStudentsAction } from "@/lib/domains/student/actions/search";

type StudentRow = {
  id: string;
  name: string | null;
  grade: number | null;
  school_name: string | null;
  tenant_id: string | null;
  is_active: boolean;
};

function makeAdminClientMock(result: { data: StudentRow[] | null; error: { message: string } | null }) {
  const limit = vi.fn().mockResolvedValue(result);
  const eqActive = vi.fn(() => ({ limit }));
  const eqName = vi.fn(() => ({ eq: eqActive }));
  const select = vi.fn(() => ({ eq: eqName }));
  const from = vi.fn(() => ({ select }));
  return { from } as unknown as ReturnType<typeof createSupabaseAdminClient>;
}

describe("resolveStudentTarget — superadmin (Option A)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: "sa-1",
      role: "superadmin",
      tenantId: null,
      email: "ops@eduatalk.com",
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>);
  });

  it("이름 매치 1명 → 학생 tenant_id 를 downstream 으로 전달", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({
        data: [
          {
            id: "s-1",
            name: "김세린",
            grade: 2,
            school_name: "인제고",
            tenant_id: "t-A",
            is_active: true,
          },
        ],
        error: null,
      }),
    );

    const result = await resolveStudentTarget({ studentName: "김세린" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.studentId).toBe("s-1");
      expect(result.tenantId).toBe("t-A");
      expect(result.studentName).toBe("김세린");
    }
  });

  it("studentName 생략 → 이름 요청 reason", async () => {
    const result = await resolveStudentTarget({ studentName: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("학생 이름");
    }
  });

  it("매치 0명 → 찾지 못함 reason", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({ data: [], error: null }),
    );
    const result = await resolveStudentTarget({ studentName: "없는이름" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("없는이름");
      expect(result.reason).toContain("찾지 못");
    }
  });

  it("매치 다수 → candidates 포함 reason", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({
        data: [
          { id: "s-1", name: "김세린", grade: 2, school_name: "인제고", tenant_id: "t-A", is_active: true },
          { id: "s-2", name: "김세린", grade: 3, school_name: "인제고", tenant_id: "t-B", is_active: true },
        ],
        error: null,
      }),
    );
    const result = await resolveStudentTarget({ studentName: "김세린" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.candidates?.length).toBe(2);
      expect(result.reason).toContain("2명");
    }
  });

  it("학생의 tenant_id 가 null → 거부 (운영 이상 징후 방어)", async () => {
    vi.mocked(createSupabaseAdminClient).mockReturnValue(
      makeAdminClientMock({
        data: [
          { id: "s-1", name: "김세린", grade: 2, school_name: null, tenant_id: null, is_active: true },
        ],
        error: null,
      }),
    );
    const result = await resolveStudentTarget({ studentName: "김세린" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("테넌트");
    }
  });

  it("admin 분기(기존)는 searchStudentsAction 경로를 그대로 사용", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      userId: "ad-1",
      role: "admin",
      tenantId: "t-A",
      email: "admin@tenant-a.com",
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>);

    vi.mocked(searchStudentsAction).mockResolvedValue({
      success: true,
      students: [
        {
          id: "s-1",
          name: "김세린",
          grade: 2,
          class: null,
          phone: null,
          division: null,
          school_name: "인제고",
          gender: null,
          is_active: true,
          status: null,
          has_email: false,
          profile_image_url: null,
          withdrawn_at: null,
          withdrawn_reason: null,
        },
      ],
      total: 1,
    });

    const result = await resolveStudentTarget({ studentName: "김세린" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tenantId).toBe("t-A"); // admin 은 user.tenantId 사용
    }
    expect(createSupabaseAdminClient).not.toHaveBeenCalled(); // superadmin 전용 경로 비진입
  });
});
