/**
 * SMS API 라우트 단위 테스트 (P5)
 *
 * 커버리지:
 *   - POST /api/purio/send
 *   - POST /api/purio/cancel
 *   - POST /api/sms/sync-delivery
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/tenant/getTenantContext", () => ({
  getTenantContext: vi.fn(),
}));

vi.mock("@/lib/services/smsService", () => ({
  sendSMS: vi.fn(),
  sendBulkSMS: vi.fn(),
  cancelScheduledMessage: vi.fn(),
}));

vi.mock("@/lib/services/alimtalkService", () => ({
  sendAlimtalk: vi.fn(),
  sendBulkAlimtalk: vi.fn(),
}));

vi.mock("@/lib/services/alimtalkTemplates", () => ({
  getAlimtalkTemplate: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    PPURIO_KAKAO_SENDER_PROFILE: null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/errors", () => ({
  AppError: class AppError extends Error {
    statusCode: number;
    constructor(message: string, code: string, statusCode = 500) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  ErrorCode: {},
  logError: vi.fn(),
}));

vi.mock("@/lib/utils/studentPhoneUtils", () => ({
  getStudentPhonesBatch: vi.fn(),
}));

vi.mock("@/lib/utils/errorHandling", () => ({
  handleSupabaseError: vi.fn((e: unknown) => (e instanceof Error ? e.message : "오류")),
  extractErrorDetails: vi.fn(() => ({})),
}));

vi.mock("@/lib/domains/sms/syncDeliveryResults", () => ({
  syncDeliveryResults: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { requireAdmin } from "@/lib/auth/guards";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendSMS, sendBulkSMS, cancelScheduledMessage } from "@/lib/services/smsService";
import { sendAlimtalk, sendBulkAlimtalk } from "@/lib/services/alimtalkService";
import { getAlimtalkTemplate } from "@/lib/services/alimtalkTemplates";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncDeliveryResults } from "@/lib/domains/sms/syncDeliveryResults";

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

/** 기본 Supabase server mock */
function makeServerMock() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { name: "테스트학원" }, error: null }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  };
}

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetTenantContext = vi.mocked(getTenantContext);
const mockSendSMS = vi.mocked(sendSMS);
const mockSendBulkSMS = vi.mocked(sendBulkSMS);
const mockCancelScheduledMessage = vi.mocked(cancelScheduledMessage);
const mockSendAlimtalk = vi.mocked(sendAlimtalk);
const mockSendBulkAlimtalk = vi.mocked(sendBulkAlimtalk);
const mockGetAlimtalkTemplate = vi.mocked(getAlimtalkTemplate);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockSyncDeliveryResults = vi.mocked(syncDeliveryResults);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(undefined);
  mockGetTenantContext.mockResolvedValue({ tenantId: "tenant-1" });
  mockGetAlimtalkTemplate.mockReturnValue(null);
  mockCreateSupabaseServerClient.mockResolvedValue(makeServerMock() as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);
});

// ============================================
// POST /api/purio/send
// ============================================

describe("POST /api/purio/send", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../purio/send/route");
    return POST(req);
  }

  it("인증 실패 (requireAdmin throw) → 500", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("권한이 없습니다."));

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "single", phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("tenantId 없음 → 404", async () => {
    mockGetTenantContext.mockResolvedValue(null);

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "single", phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(404);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe("기관 정보를 찾을 수 없습니다.");
  });

  it("type 누락 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("type 잘못됨 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "invalid", phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(400);
  });

  it("단일 발송: phone 없음 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "single", message: "테스트" })
    );
    expect(res.status).toBe(400);
  });

  it("단일 SMS 발송 성공 → 200", async () => {
    mockSendSMS.mockResolvedValue({ success: true, messageKey: "msg-001" });

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "single", phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; msgId: string; channel: string };
    expect(json.success).toBe(true);
    expect(json.channel).toBe("sms");
    expect(mockSendSMS).toHaveBeenCalledOnce();
  });

  it("단일 SMS 발송 실패 → 500", async () => {
    mockSendSMS.mockResolvedValue({ success: false, error: "발송 서버 오류" });

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "single", phone: "010-1234-5678", message: "테스트" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe("발송 서버 오류");
  });

  it("예약 시간 형식 오류 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", {
        type: "single",
        phone: "010-1234-5678",
        message: "테스트",
        sendTime: "2026-01-01 10:00:00", // 잘못된 형식
      })
    );
    expect(res.status).toBe(400);
  });

  it("대량 발송: recipients/studentIds 없음 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", { type: "bulk", message: "테스트" })
    );
    expect(res.status).toBe(400);
  });

  it("대량 발송: message 없음 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", {
        type: "bulk",
        recipients: [{ studentId: "s1", phone: "010-1111-2222" }],
      })
    );
    expect(res.status).toBe(400);
  });

  it("대량 SMS 발송 성공 (recipients 방식) → 200", async () => {
    mockSendBulkSMS.mockResolvedValue({ success: 2, failed: 0, errors: [] });
    const serverMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { name: "테스트학원" }, error: null }),
          }),
          in: vi.fn().mockResolvedValue({
            data: [{ id: "s1", name: "홍길동" }, { id: "s2", name: "김철수" }],
            error: null,
          }),
        }),
      }),
    };
    mockCreateSupabaseServerClient.mockResolvedValue(serverMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", {
        type: "bulk",
        message: "{학생명} 안녕하세요",
        recipients: [
          { studentId: "s1", phone: "010-1111-2222" },
          { studentId: "s2", phone: "010-3333-4444" },
        ],
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: number; failed: number };
    expect(json.success).toBe(2);
    expect(json.failed).toBe(0);
  });

  it("대량 발송: 발송 가능 연락처 0건 → 400", async () => {
    const serverMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { name: "테스트학원" }, error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [{ id: "s1", name: "홍길동" }], error: null }),
        }),
      }),
    };
    mockCreateSupabaseServerClient.mockResolvedValue(serverMock as unknown as Awaited<ReturnType<typeof createSupabaseServerClient>>);

    // phone이 없는 recipients → 필터링 후 0건
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/send", {
        type: "bulk",
        message: "테스트",
        recipients: [{ studentId: "s1", phone: "" }], // 빈 phone
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
  });
});

// ============================================
// POST /api/purio/cancel
// ============================================

describe("POST /api/purio/cancel", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { POST } = await import("../purio/cancel/route");
    return POST(req);
  }

  it("인증 실패 → 500", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Unauthorized"));

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", { messageKey: "msg-001" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("tenantId 없음 → 404", async () => {
    mockGetTenantContext.mockResolvedValue(null);

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", { messageKey: "msg-001" })
    );
    expect(res.status).toBe(404);
  });

  it("messageKey 없음 → 400", async () => {
    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", {})
    );
    expect(res.status).toBe(400);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe("메시지 키가 필요합니다.");
  });

  it("취소 성공 → 200 success:true", async () => {
    mockCancelScheduledMessage.mockResolvedValue({ success: true });

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", { messageKey: "msg-001" })
    );
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    expect(mockCancelScheduledMessage).toHaveBeenCalledWith("msg-001", "tenant-1");
  });

  it("취소 실패 (result.success=false) → 500", async () => {
    mockCancelScheduledMessage.mockResolvedValue({ success: false, error: "이미 발송됨" });

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", { messageKey: "msg-001" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe("이미 발송됨");
  });

  it("서비스 throw → 500", async () => {
    mockCancelScheduledMessage.mockRejectedValue(new Error("취소 API 오류"));

    const res = await callRoute(
      makePostRequest("http://localhost/api/purio/cancel", { messageKey: "msg-001" })
    );
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("취소 API 오류");
  });
});

// ============================================
// POST /api/sms/sync-delivery
// ============================================

describe("POST /api/sms/sync-delivery", () => {
  async function callRoute() {
    const { POST } = await import("../sms/sync-delivery/route");
    return POST();
  }

  it("권한 없음 (requireAdmin throw '권한') → 403", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("권한이 없습니다."));

    const res = await callRoute();
    expect(res.status).toBe(403);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toContain("권한");
  });

  it("정상 동기화 → 200 result 반환", async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockSyncDeliveryResults.mockResolvedValue({ success: true, synced: 10, delivered: 8, failed: 2 });

    const res = await callRoute();
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; synced: number; delivered: number };
    expect(json.success).toBe(true);
    expect(json.synced).toBe(10);
    expect(json.delivered).toBe(8);
    expect(mockSyncDeliveryResults).toHaveBeenCalledOnce();
  });

  it("syncDeliveryResults throw → 500", async () => {
    mockRequireAdmin.mockResolvedValue(undefined);
    mockSyncDeliveryResults.mockRejectedValue(new Error("동기화 실패"));

    const res = await callRoute();
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBe("동기화 실패");
  });
});
