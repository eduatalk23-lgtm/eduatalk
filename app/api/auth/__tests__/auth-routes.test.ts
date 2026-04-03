/**
 * 인증 API 라우트 단위 테스트
 *
 * 커버리지:
 *   - /api/auth/me                (GET) — 현재 로그인 사용자 정보 조회
 *   - /api/auth/check-superadmin  (GET) — Super Admin 여부 확인
 *   - /api/auth/google            (GET) — Google OAuth 시작 (리다이렉트)
 *   - /api/auth/google/callback   (GET) — Google OAuth 콜백 (토큰 교환 + 저장)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUserRole", () => ({
  getCachedUserRole: vi.fn(),
}));

vi.mock("@/lib/tenant/getTenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/lib/auth/isAdminRole", () => ({
  isAdminRole: vi.fn(),
}));

vi.mock("@/lib/domains/googleCalendar", () => ({
  generateAuthUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  parseOAuthState: vi.fn(),
  saveToken: vi.fn(),
}));

vi.mock("@/lib/domains/googleCalendar/oauth", () => ({
  createAuthenticatedClient: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: {
    oauth2: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/clientSelector", () => ({
  getSupabaseClientForRLSBypass: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import {
  generateAuthUrl,
  exchangeCodeForTokens,
  parseOAuthState,
  saveToken,
} from "@/lib/domains/googleCalendar";
import { createAuthenticatedClient } from "@/lib/domains/googleCalendar/oauth";
import { google } from "googleapis";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";

import type { CurrentUser } from "@/lib/auth/getCurrentUser";
import type { TenantContext } from "@/lib/tenant/getTenantContext";

// ============================================
// 공통 헬퍼
// ============================================

function makeGetRequest(
  url: string,
  searchParams?: Record<string, string>
): NextRequest {
  const urlObj = new URL(url, "http://localhost");
  if (searchParams) {
    Object.entries(searchParams).forEach(([k, v]) =>
      urlObj.searchParams.set(k, v)
    );
  }
  return new NextRequest(urlObj.toString(), { method: "GET" });
}

// typed mocks
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetCachedUserRole = vi.mocked(getCachedUserRole);
const mockGetTenantContext = vi.mocked(getTenantContext);
const mockIsAdminRole = vi.mocked(isAdminRole);
const mockGenerateAuthUrl = vi.mocked(generateAuthUrl);
const mockExchangeCodeForTokens = vi.mocked(exchangeCodeForTokens);
const mockParseOAuthState = vi.mocked(parseOAuthState);
const mockCreateAuthenticatedClient = vi.mocked(createAuthenticatedClient);
const mockGoogleOauth2 = vi.mocked(google.oauth2);
const mockGetSupabaseClientForRLSBypass = vi.mocked(
  getSupabaseClientForRLSBypass
);
const mockSaveToken = vi.mocked(saveToken);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// /api/auth/me
// ============================================

describe("GET /api/auth/me", () => {
  async function callRoute() {
    const { GET } = await import("../me/route");
    const req = makeGetRequest("http://localhost/api/auth/me");
    return GET(req as Parameters<typeof GET>[0]);
  }

  it("인증된 사용자 → 200 + 사용자 정보", async () => {
    const mockUser: CurrentUser = {
      userId: "user-abc",
      role: "admin",
      tenantId: "tenant-xyz",
      email: "admin@example.com",
    };
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: CurrentUser;
    };
    expect(json.success).toBe(true);
    expect(json.data.userId).toBe("user-abc");
    expect(json.data.role).toBe("admin");
    expect(json.data.tenantId).toBe("tenant-xyz");
    expect(json.data.email).toBe("admin@example.com");
  });

  it("미인증 사용자 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute();

    expect(res.status).toBe(401);
    const json = (await res.json()) as {
      success: boolean;
      error: { message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.message).toBe("로그인이 필요합니다.");
  });

  it("getCurrentUser throw → 500", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("auth 서버 장애"));

    const res = await callRoute();

    expect(res.status).toBe(500);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("student 역할 사용자 → 200 + role:student", async () => {
    const mockUser: CurrentUser = {
      userId: "student-001",
      role: "student",
      tenantId: "tenant-xyz",
      email: "student@example.com",
    };
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: CurrentUser;
    };
    expect(json.data.role).toBe("student");
  });
});

// ============================================
// /api/auth/check-superadmin
// ============================================

describe("GET /api/auth/check-superadmin", () => {
  async function callRoute() {
    const { GET } = await import("../check-superadmin/route");
    return GET();
  }

  it("superadmin 역할 → isSuperAdmin:true", async () => {
    const ctx: TenantContext = {
      tenantId: "tenant-xyz",
      role: "superadmin",
      userId: "user-super",
    };
    mockGetTenantContext.mockResolvedValue(ctx);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { isSuperAdmin: boolean };
    };
    expect(json.success).toBe(true);
    expect(json.data.isSuperAdmin).toBe(true);
  });

  it("admin 역할 → isSuperAdmin:false", async () => {
    const ctx: TenantContext = {
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    };
    mockGetTenantContext.mockResolvedValue(ctx);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { isSuperAdmin: boolean };
    };
    expect(json.data.isSuperAdmin).toBe(false);
  });

  it("consultant 역할 → isSuperAdmin:false", async () => {
    const ctx: TenantContext = {
      tenantId: "tenant-xyz",
      role: "consultant",
      userId: "user-consultant",
    };
    mockGetTenantContext.mockResolvedValue(ctx);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { isSuperAdmin: boolean };
    };
    expect(json.data.isSuperAdmin).toBe(false);
  });

  it("student 역할 → isSuperAdmin:false", async () => {
    const ctx: TenantContext = {
      tenantId: "tenant-xyz",
      role: "student",
      userId: "user-student",
    };
    mockGetTenantContext.mockResolvedValue(ctx);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { isSuperAdmin: boolean };
    };
    expect(json.data.isSuperAdmin).toBe(false);
  });

  it("미인증 (tenantContext null) → isSuperAdmin:false", async () => {
    mockGetTenantContext.mockResolvedValue(null);

    const res = await callRoute();

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { isSuperAdmin: boolean };
    };
    expect(json.data.isSuperAdmin).toBe(false);
  });
});

// ============================================
// /api/auth/google (OAuth 시작)
// ============================================

describe("GET /api/auth/google", () => {
  async function callRoute(searchParams?: Record<string, string>) {
    const { GET } = await import("../google/route");
    const req = makeGetRequest(
      "http://localhost/api/auth/google",
      searchParams
    );
    return GET(req as Parameters<typeof GET>[0]);
  }

  it("미인증 사용자 → 401", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: null,
      role: null,
      tenantId: null,
    });
    mockIsAdminRole.mockReturnValue(false);

    const res = await callRoute({ target: "personal" });

    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("non-admin 역할 → 401", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-student",
      role: "student",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(false);

    const res = await callRoute({ target: "personal" });

    expect(res.status).toBe(401);
  });

  it("admin이지만 tenantId 없음 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: null,
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: null,
      role: "admin",
      userId: "user-admin",
    });

    const res = await callRoute({ target: "personal" });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("기관 정보 없음");
  });

  it("잘못된 target 파라미터 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    });

    const res = await callRoute({ target: "invalid" });

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("잘못된 target");
  });

  it("정상 요청 (target=personal) → redirect", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    });
    mockGenerateAuthUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?state=abc"
    );

    const res = await callRoute({ target: "personal" });

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://accounts.google.com/o/oauth2/auth?state=abc"
    );
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "user-admin",
        tenantId: "tenant-xyz",
        target: "personal",
      })
    );
  });

  it("정상 요청 (target=shared) → redirect", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    });
    mockGenerateAuthUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?state=xyz"
    );

    const res = await callRoute({ target: "shared" });

    expect(res.status).toBe(307);
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ target: "shared" })
    );
  });

  it("target 파라미터 없음 → 기본값 personal로 동작", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    });
    mockGenerateAuthUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?state=default"
    );

    const res = await callRoute();

    expect(res.status).toBe(307);
    expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
      expect.objectContaining({ target: "personal" })
    );
  });

  it("generateAuthUrl throw → 500", async () => {
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockIsAdminRole.mockReturnValue(true);
    mockGetTenantContext.mockResolvedValue({
      tenantId: "tenant-xyz",
      role: "admin",
      userId: "user-admin",
    });
    mockGenerateAuthUrl.mockImplementation(() => {
      throw new Error("OAuth 환경 변수 누락");
    });

    const res = await callRoute({ target: "personal" });

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Internal Server Error");
  });
});

// ============================================
// /api/auth/google/callback (OAuth 콜백)
// ============================================

describe("GET /api/auth/google/callback", () => {
  async function callRoute(searchParams?: Record<string, string>) {
    const { GET } = await import("../google/callback/route");
    const req = makeGetRequest(
      "http://localhost/api/auth/google/callback",
      searchParams
    );
    return GET(req as Parameters<typeof GET>[0]);
  }

  /** redirect URL 에서 쿼리 파라미터 추출 헬퍼 */
  function getRedirectParam(res: Response, param: string): string | null {
    const location = res.headers.get("location");
    if (!location) return null;
    const url = new URL(location);
    return url.searchParams.get(param);
  }

  /** 콜백 성공 플로우에 필요한 공통 mock 설정 */
  function setupSuccessfulTokenExchange() {
    mockParseOAuthState.mockReturnValue({
      adminUserId: "user-admin",
      tenantId: "tenant-xyz",
      target: "personal",
      timestamp: Date.now(),
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockExchangeCodeForTokens.mockResolvedValue({
      access_token: "at-123",
      refresh_token: "rt-456",
      expiry_date: Date.now() + 3600_000,
      scope: "calendar.readonly",
    });
    mockCreateAuthenticatedClient.mockReturnValue(
      {} as ReturnType<typeof createAuthenticatedClient>
    );
    mockGoogleOauth2.mockReturnValue({
      userinfo: {
        get: vi.fn().mockResolvedValue({
          data: { email: "admin@gmail.com" },
        }),
      },
    } as unknown as ReturnType<typeof google.oauth2>);
  }

  it("error 파라미터 있음 (동의 거부) → consent_denied redirect", async () => {
    const res = await callRoute({
      error: "access_denied",
      code: "abc",
      state: "xyz",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("consent_denied");
  });

  it("code 없음 → missing_params redirect", async () => {
    const res = await callRoute({ state: "some-state" });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("missing_params");
  });

  it("state 없음 → missing_params redirect", async () => {
    const res = await callRoute({ code: "some-code" });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("missing_params");
  });

  it("code와 state 모두 없음 → missing_params redirect", async () => {
    const res = await callRoute();

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("missing_params");
  });

  it("state 파싱 실패 (invalid_state) → redirect", async () => {
    mockParseOAuthState.mockReturnValue(null);

    const res = await callRoute({ code: "valid-code", state: "invalid-state" });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("invalid_state");
  });

  it("userId 불일치 → user_mismatch redirect", async () => {
    mockParseOAuthState.mockReturnValue({
      adminUserId: "user-admin-A",
      tenantId: "tenant-xyz",
      target: "personal",
      timestamp: Date.now(),
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin-B",
      role: "admin",
      tenantId: "tenant-xyz",
    });

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("user_mismatch");
  });

  it("미인증 사용자 (userId null) → user_mismatch redirect", async () => {
    mockParseOAuthState.mockReturnValue({
      adminUserId: "user-admin-A",
      tenantId: "tenant-xyz",
      target: "personal",
      timestamp: Date.now(),
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: null,
      role: null,
      tenantId: null,
    });

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("user_mismatch");
  });

  it("토큰 교환 실패 → exchange_failed redirect", async () => {
    mockParseOAuthState.mockReturnValue({
      adminUserId: "user-admin",
      tenantId: "tenant-xyz",
      target: "personal",
      timestamp: Date.now(),
    });
    mockGetCachedUserRole.mockResolvedValue({
      userId: "user-admin",
      role: "admin",
      tenantId: "tenant-xyz",
    });
    mockExchangeCodeForTokens.mockRejectedValue(
      new Error("토큰 교환 실패")
    );

    const res = await callRoute({
      code: "expired-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("exchange_failed");
  });

  it("adminClient 획득 실패 (null) → server_error redirect", async () => {
    setupSuccessfulTokenExchange();
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(
      null as unknown as Awaited<
        ReturnType<typeof getSupabaseClientForRLSBypass>
      >
    );

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("server_error");
  });

  it("saveToken 실패 (success:false) → save_failed redirect", async () => {
    setupSuccessfulTokenExchange();
    const mockAdminClient = {} as Awaited<
      ReturnType<typeof getSupabaseClientForRLSBypass>
    >;
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(mockAdminClient);
    mockSaveToken.mockResolvedValue({ success: false, error: "DB 오류" });

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "error")).toBe("save_failed");
  });

  it("정상 플로우 → success=connected redirect", async () => {
    setupSuccessfulTokenExchange();
    const mockAdminClient = {} as Awaited<
      ReturnType<typeof getSupabaseClientForRLSBypass>
    >;
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(mockAdminClient);
    mockSaveToken.mockResolvedValue({ success: true });

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "success")).toBe("connected");
    expect(mockSaveToken).toHaveBeenCalledWith(
      mockAdminClient,
      expect.objectContaining({
        adminUserId: "user-admin",
        tenantId: "tenant-xyz",
        accessToken: "at-123",
        refreshToken: "rt-456",
        googleEmail: "admin@gmail.com",
      })
    );
  });

  it("정상 플로우 (이메일 없음) → googleEmail undefined 전달", async () => {
    setupSuccessfulTokenExchange();
    // Override: userinfo.get returns no email
    mockGoogleOauth2.mockReturnValue({
      userinfo: {
        get: vi.fn().mockResolvedValue({
          data: { email: null },
        }),
      },
    } as unknown as ReturnType<typeof google.oauth2>);

    const mockAdminClient = {} as Awaited<
      ReturnType<typeof getSupabaseClientForRLSBypass>
    >;
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(mockAdminClient);
    mockSaveToken.mockResolvedValue({ success: true });

    const res = await callRoute({
      code: "valid-code",
      state: "valid-state",
    });

    expect(res.status).toBe(307);
    expect(getRedirectParam(res, "success")).toBe("connected");
    expect(mockSaveToken).toHaveBeenCalledWith(
      mockAdminClient,
      expect.objectContaining({
        googleEmail: undefined,
      })
    );
  });
});
