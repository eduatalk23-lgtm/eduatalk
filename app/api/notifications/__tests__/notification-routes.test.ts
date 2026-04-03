/**
 * Notification API 라우트 단위 테스트 (P5)
 *
 * 커버리지:
 *   - GET  /api/notifications
 *   - DELETE /api/notifications/[id]
 *   - POST /api/notifications/[id]/read
 *   - POST /api/notifications/read-all
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/services/inAppNotificationService", () => ({
  getAllNotifications: vi.fn(),
  deleteNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllNotificationsAsRead: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  CACHE_NO_STORE: { "Cache-Control": "no-store" },
}));

// ============================================
// Imports (after mocks)
// ============================================

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getAllNotifications,
  deleteNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/services/inAppNotificationService";

// ============================================
// 공통 헬퍼
// ============================================

function makeGetRequest(url = "http://localhost/api/notifications"): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, { method: "GET" });
}

function makePostRequest(url: string, body: object = {}): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(url: string): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest(url, { method: "DELETE" });
}

function makeParamsPromise(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

type MockUser = { userId: string; role: string };

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockGetAllNotifications = vi.mocked(getAllNotifications);
const mockDeleteNotification = vi.mocked(deleteNotification);
const mockMarkNotificationAsRead = vi.mocked(markNotificationAsRead);
const mockMarkAllNotificationsAsRead = vi.mocked(markAllNotificationsAsRead);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// GET /api/notifications
// ============================================

describe("GET /api/notifications", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../route");
    return GET(req);
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute(makeGetRequest());
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("정상 조회 → 200 + notifications", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockGetAllNotifications.mockResolvedValue([
      { id: "n1", type: "info", message: "알림 1", read: false, createdAt: new Date().toISOString() },
      { id: "n2", type: "warning", message: "알림 2", read: true, createdAt: new Date().toISOString() },
    ]);

    const res = await callRoute(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; notifications: unknown[] };
    expect(json.success).toBe(true);
    expect(json.notifications).toHaveLength(2);
    expect(mockGetAllNotifications).toHaveBeenCalledWith("user-1");
  });

  it("서비스 throw → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockGetAllNotifications.mockRejectedValue(new Error("DB 오류"));

    const res = await callRoute(makeGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("알림 조회에 실패했습니다.");
  });
});

// ============================================
// DELETE /api/notifications/[id]
// ============================================

describe("DELETE /api/notifications/[id]", () => {
  async function callRoute(req: import("next/server").NextRequest, id: string) {
    const { DELETE } = await import("../[id]/route");
    return DELETE(req, { params: makeParamsPromise(id) });
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute(makeDeleteRequest("http://localhost/api/notifications/n1"), "n1");
    expect(res.status).toBe(401);
  });

  it("삭제 성공 → 200 success:true", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockDeleteNotification.mockResolvedValue({ success: true });

    const res = await callRoute(makeDeleteRequest("http://localhost/api/notifications/n1"), "n1");
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    expect(mockDeleteNotification).toHaveBeenCalledWith("user-1", "n1");
  });

  it("삭제 실패 (result.success=false) → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockDeleteNotification.mockResolvedValue({ success: false, error: "알림을 찾을 수 없습니다." });

    const res = await callRoute(makeDeleteRequest("http://localhost/api/notifications/n1"), "n1");
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("알림을 찾을 수 없습니다.");
  });

  it("서비스 throw → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockDeleteNotification.mockRejectedValue(new Error("삭제 예외"));

    const res = await callRoute(makeDeleteRequest("http://localhost/api/notifications/n1"), "n1");
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("알림 삭제에 실패했습니다.");
  });
});

// ============================================
// POST /api/notifications/[id]/read
// ============================================

describe("POST /api/notifications/[id]/read", () => {
  async function callRoute(req: import("next/server").NextRequest, id: string) {
    const { POST } = await import("../[id]/read/route");
    return POST(req, { params: makeParamsPromise(id) });
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/n1/read"), "n1");
    expect(res.status).toBe(401);
  });

  it("읽음 처리 성공 → 200 success:true", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkNotificationAsRead.mockResolvedValue({ success: true });

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/n1/read"), "n1");
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    expect(mockMarkNotificationAsRead).toHaveBeenCalledWith("user-1", "n1");
  });

  it("읽음 처리 실패 (result.success=false) → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkNotificationAsRead.mockResolvedValue({ success: false, error: "처리 실패" });

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/n1/read"), "n1");
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("처리 실패");
  });

  it("서비스 throw → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkNotificationAsRead.mockRejectedValue(new Error("읽음 예외"));

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/n1/read"), "n1");
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("알림 읽음 처리에 실패했습니다.");
  });
});

// ============================================
// POST /api/notifications/read-all
// ============================================

describe("POST /api/notifications/read-all", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../read-all/route");
    return POST(req);
  }

  it("미인증 → 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/read-all"));
    expect(res.status).toBe(401);
  });

  it("전체 읽음 처리 성공 → 200 success:true", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkAllNotificationsAsRead.mockResolvedValue({ success: true });

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/read-all"));
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    expect(mockMarkAllNotificationsAsRead).toHaveBeenCalledWith("user-1");
  });

  it("전체 읽음 처리 실패 (result.success=false) → 400", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkAllNotificationsAsRead.mockResolvedValue({ success: false, error: "전체 처리 실패" });

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/read-all"));
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("전체 처리 실패");
  });

  it("서비스 throw → 500", async () => {
    mockGetCurrentUser.mockResolvedValue({ userId: "user-1", role: "student" } as MockUser);
    mockMarkAllNotificationsAsRead.mockRejectedValue(new Error("전체 읽음 예외"));

    const res = await callRoute(makePostRequest("http://localhost/api/notifications/read-all"));
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("전체 알림 읽음 처리에 실패했습니다.");
  });
});
