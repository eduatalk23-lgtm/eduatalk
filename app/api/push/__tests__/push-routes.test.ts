/**
 * Push API 라우트 단위 테스트 (P5)
 *
 * 커버리지:
 *   - POST /api/push/click
 *   - GET  /api/push/debug
 *   - GET  /api/push/gdpr
 *   - DELETE /api/push/gdpr
 *   - POST /api/push/resubscribe
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/auth/cachedGetUser", () => ({
  getCachedAuthUser: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCachedAuthUser } from "@/lib/auth/cachedGetUser";

// ============================================
// 공통 헬퍼
// ============================================

function makePostRequest(url: string, body: object): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(url: string): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, { method: "GET" });
}

function makeDeleteRequest(url: string): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, { method: "DELETE" });
}

/** Supabase admin mock — 체이닝 지원 */
function makeAdminMock(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    }),
    ...overrides,
  };
}

type MockUser = { userId: string; role: string };
type MockAuthUser = { id: string; email: string };

const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetCachedAuthUser = vi.mocked(getCachedAuthUser);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// POST /api/push/click
// ============================================

describe("POST /api/push/click", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../click/route");
    return POST(req);
  }

  it("notificationLogId 없음 → 400", async () => {
    const res = await callRoute(makePostRequest("http://localhost/api/push/click", {}));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid notificationLogId");
  });

  it("UUID 형식 불일치 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/push/click", { notificationLogId: "not-a-uuid" })
    );
    expect(res.status).toBe(400);
  });

  it("admin client 없음 → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/click", {
        notificationLogId: "550e8400-e29b-41d4-a716-446655440000",
      })
    );
    expect(res.status).toBe(500);
  });

  it("DB update 오류 → 500", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: { message: "update 실패" } }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/click", {
        notificationLogId: "550e8400-e29b-41d4-a716-446655440000",
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Update failed");
  });

  it("정상 클릭 추적 → 200 success:true", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(makeAdminMock() as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/click", {
        notificationLogId: "550e8400-e29b-41d4-a716-446655440000",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("JSON 파싱 실패 → 400", async () => {
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const req = new NextRequest("http://localhost/api/push/click", {
      method: "POST",
      body: "invalid-json",
    });
    const res = await callRoute(req);
    expect(res.status).toBe(400);
  });
});

// ============================================
// GET /api/push/debug
// ============================================

describe("GET /api/push/debug", () => {
  async function callRoute() {
    const { GET } = await import("../debug/route");
    return GET();
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute();
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("not_authenticated");
  });

  it("admin client 없음 → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "admin" } as MockUser);
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("no_admin_client");
  });

  it("정상 조회 → 200 subscriptions 포함", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "admin" } as MockUser);
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{ id: "sub-1", device_label: "Chrome", is_active: true, created_at: "2026-01-01", updated_at: "2026-01-01" }],
              error: null,
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string; subscriptions: unknown[]; totalActive: number };
    expect(json.userId).toBe("user-1");
    expect(json.subscriptions).toHaveLength(1);
    expect(json.totalActive).toBe(1);
  });
});

// ============================================
// GET /api/push/gdpr  (내보내기)
// ============================================

describe("GET /api/push/gdpr", () => {
  async function callRoute() {
    const { GET } = await import("../gdpr/route");
    return GET();
  }

  it("미인증 → 401", async () => {
    mockGetCachedAuthUser.mockResolvedValue(null);

    const res = await callRoute();
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockGetCachedAuthUser.mockResolvedValue({ id: "user-1", email: "test@test.com" } as MockAuthUser);
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(500);
  });

  it("정상 내보내기 → 200 exported_at 포함", async () => {
    mockGetCachedAuthUser.mockResolvedValue({ id: "user-1", email: "test@test.com" } as MockAuthUser);

    // push_subscriptions: select().eq() → Promise
    const subChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
    // notification_log: select().eq().order().limit() → Promise
    const logChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };
    // push_dlq: select().eq().order() → Promise
    const dlqChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    const adminMock = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "push_subscriptions") return subChain;
        if (table === "notification_log") return logChain;
        if (table === "push_dlq") return dlqChain;
        return subChain;
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(200);
    const json = await res.json() as { exported_at: string; user_id: string };
    expect(json.user_id).toBe("user-1");
    expect(json.exported_at).toBeTruthy();
  });
});

// ============================================
// DELETE /api/push/gdpr  (삭제)
// ============================================

describe("DELETE /api/push/gdpr", () => {
  async function callRoute() {
    const { DELETE } = await import("../gdpr/route");
    return DELETE();
  }

  it("미인증 → 401", async () => {
    mockGetCachedAuthUser.mockResolvedValue(null);

    const res = await callRoute();
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockGetCachedAuthUser.mockResolvedValue({ id: "user-1", email: "test@test.com" } as MockAuthUser);
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(500);
  });

  it("정상 삭제 → 200 counts 포함", async () => {
    mockGetCachedAuthUser.mockResolvedValue({ id: "user-1", email: "test@test.com" } as MockAuthUser);
    const adminMock = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute();
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; counts: { push_dlq: number } };
    expect(json.message).toContain("deleted");
    expect(json.counts).toBeDefined();
  });
});

// ============================================
// POST /api/push/resubscribe
// ============================================

describe("POST /api/push/resubscribe", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../resubscribe/route");
    return POST(req);
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", {
        newSubscription: { endpoint: "https://push.example.com/sub", keys: { p256dh: "key1", auth: "auth1" } },
      })
    );
    expect(res.status).toBe(401);
  });

  it("newSubscription endpoint 없음 → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", { newSubscription: {} })
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Invalid subscription data");
  });

  it("endpoint https 미사용 → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", {
        newSubscription: { endpoint: "http://push.example.com/sub", keys: { p256dh: "key1", auth: "auth1" } },
      })
    );
    expect(res.status).toBe(400);
  });

  it("keys 누락 → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", {
        newSubscription: { endpoint: "https://push.example.com/sub", keys: {} },
      })
    );
    expect(res.status).toBe(400);
  });

  it("DB upsert 오류 → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    const serverMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: { message: "upsert 실패" } }),
      }),
    };
    mockCreateSupabaseServerClient.mockResolvedValue(serverMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", {
        newSubscription: { endpoint: "https://push.example.com/sub", keys: { p256dh: "key1", auth: "auth1" } },
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Upsert failed");
  });

  it("정상 재구독 → 200 success:true", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    const serverMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    mockCreateSupabaseServerClient.mockResolvedValue(serverMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/push/resubscribe", {
        oldEndpoint: "https://old.push.example.com/sub",
        newSubscription: { endpoint: "https://new.push.example.com/sub", keys: { p256dh: "key1", auth: "auth1" } },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("JSON 파싱 실패 → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    const { NextRequest } = require("next/server") as typeof import("next/server");
    const req = new NextRequest("http://localhost/api/push/resubscribe", {
      method: "POST",
      body: "invalid-json",
    });
    const res = await callRoute(req);
    expect(res.status).toBe(400);
  });
});
