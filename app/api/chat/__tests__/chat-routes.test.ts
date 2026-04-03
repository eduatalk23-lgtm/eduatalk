/**
 * Chat Push-Notify API 라우트 단위 테스트 (P5)
 *
 * 커버리지:
 *   - POST /api/chat/push-notify
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/domains/notification/router", () => ({
  routeNotification: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routeNotification } from "@/lib/domains/notification/router";

// ============================================
// 공통 헬퍼
// ============================================

function makeCronPostRequest(body: object, secret = "test-secret"): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest("http://localhost/api/chat/push-notify", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function makeNoAuthPostRequest(body: object): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest("http://localhost/api/chat/push-notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 기본 chat room + members mock */
function makeRoomMock(roomData: { type: string; name: string } | null, memberIds: string[]) {
  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "chat_rooms") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: roomData, error: null }),
            }),
          }),
        };
      }
      if (table === "chat_room_members") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              neq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: memberIds.map((id) => ({ user_id: id })),
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  };
}

const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockRouteNotification = vi.mocked(routeNotification);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

// ============================================
// POST /api/chat/push-notify
// ============================================

describe("POST /api/chat/push-notify", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../push-notify/route");
    return POST(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(
      makeNoAuthPostRequest({ message_id: "m1", room_id: "r1", sender_id: "s1" })
    );
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", room_id: "r1", sender_id: "s1" }, "wrong-secret")
    );
    expect(res.status).toBe(401);
  });

  it("room_id 없음 → 400", async () => {
    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", sender_id: "s1" })
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Missing required fields");
  });

  it("sender_id 없음 → 400", async () => {
    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", room_id: "r1" })
    );
    expect(res.status).toBe(400);
  });

  it("admin client 없음 → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", room_id: "r1", sender_id: "s1", content: "hi" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Admin client unavailable");
  });

  it("room 없음 → 200 skipped:room_not_found", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(makeRoomMock(null, []) as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", room_id: "r1", sender_id: "s1", content: "hi", created_at: "2026-01-01T10:00:00Z", message_type: "text", sender_name: "Alice", metadata: null })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; skipped: string };
    expect(json.ok).toBe(true);
    expect(json.skipped).toBe("room_not_found");
  });

  it("수신자 없음 → 200 skipped:no_recipients", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeRoomMock({ type: "direct", name: "1:1" }, []) as unknown as ReturnType<typeof createSupabaseAdminClient>
    );

    const res = await callRoute(
      makeCronPostRequest({ message_id: "m1", room_id: "r1", sender_id: "s1", content: "hi", created_at: "2026-01-01T10:00:00Z", message_type: "text", sender_name: "Alice", metadata: null })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; skipped: string };
    expect(json.skipped).toBe("no_recipients");
  });

  it("일반 메시지 → 200 routeNotification 호출", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeRoomMock({ type: "direct", name: null }, ["user-2"]) as unknown as ReturnType<typeof createSupabaseAdminClient>
    );
    mockRouteNotification.mockResolvedValue(undefined);

    const res = await callRoute(
      makeCronPostRequest({
        message_id: "m1",
        room_id: "r1",
        sender_id: "s1",
        sender_name: "Alice",
        content: "안녕하세요",
        created_at: "2026-01-01T10:00:00Z",
        message_type: "text",
        metadata: null,
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; recipients: number };
    expect(json.ok).toBe(true);
    expect(json.recipients).toBe(1);
    expect(mockRouteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat_message" })
    );
  });

  it("그룹 메시지 → routeNotification에 chat_group_message 타입", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeRoomMock({ type: "group", name: "스터디방" }, ["user-2", "user-3"]) as unknown as ReturnType<typeof createSupabaseAdminClient>
    );
    mockRouteNotification.mockResolvedValue(undefined);

    const res = await callRoute(
      makeCronPostRequest({
        message_id: "m1",
        room_id: "r1",
        sender_id: "s1",
        sender_name: "Alice",
        content: "그룹 메시지",
        created_at: "2026-01-01T10:00:00Z",
        message_type: "text",
        metadata: null,
      })
    );
    expect(res.status).toBe(200);
    expect(mockRouteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat_group_message" })
    );
  });

  it("멘션 포함 → chat_mention 알림 추가 발송", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeRoomMock({ type: "group", name: "스터디방" }, ["user-2", "user-3"]) as unknown as ReturnType<typeof createSupabaseAdminClient>
    );
    mockRouteNotification.mockResolvedValue(undefined);

    const res = await callRoute(
      makeCronPostRequest({
        message_id: "m1",
        room_id: "r1",
        sender_id: "s1",
        sender_name: "Alice",
        content: "@user-2 확인해주세요",
        created_at: "2026-01-01T10:00:00Z",
        message_type: "text",
        metadata: { mentions: [{ userId: "user-2" }] },
      })
    );
    expect(res.status).toBe(200);
    // 일반 + 멘션 2회 호출
    expect(mockRouteNotification).toHaveBeenCalledTimes(2);
    expect(mockRouteNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: "chat_mention" })
    );
  });

  it("routeNotification throw → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeRoomMock({ type: "direct", name: null }, ["user-2"]) as unknown as ReturnType<typeof createSupabaseAdminClient>
    );
    mockRouteNotification.mockRejectedValue(new Error("라우터 오류"));

    const res = await callRoute(
      makeCronPostRequest({
        message_id: "m1",
        room_id: "r1",
        sender_id: "s1",
        sender_name: "Alice",
        content: "hi",
        created_at: "2026-01-01T10:00:00Z",
        message_type: "text",
        metadata: null,
      })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("라우터 오류");
  });
});
