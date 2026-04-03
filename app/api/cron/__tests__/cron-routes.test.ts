/**
 * Cron API 라우트 단위 테스트 (P5)
 *
 * 커버리지:
 *   - /api/cron/auto-billing
 *   - /api/cron/cleanup-chat-attachments
 *   - /api/cron/consultation-reminders
 *   - /api/cron/enrollment-expiry
 *   - /api/cron/google-calendar-sync
 *   - /api/cron/google-calendar-webhook-renew
 *   - /api/cron/payment-link-maintenance
 *   - /api/cron/payment-reminders
 *   - /api/cron/process-camp-expiry
 *   - /api/cron/process-camp-reminders
 *   - /api/cron/push-cleanup
 *   - /api/cron/send-scheduled-messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/clientSelector", () => ({
  getSupabaseClientForRLSBypass: vi.fn(),
}));

vi.mock("@/lib/domains/payment/actions/billing", () => ({
  runAutoBillingForTenant: vi.fn(),
}));

vi.mock("@/lib/domains/chat/cleanup", () => ({
  cleanupOrphanedAttachments: vi.fn(),
}));

vi.mock("@/lib/domains/drive/cleanup", () => ({
  cleanupDriveFiles: vi.fn(),
}));

vi.mock("@/lib/domains/consulting/services/reminderService", () => ({
  processConsultationReminders: vi.fn(),
}));

vi.mock("@/lib/domains/enrollment/services/expiryService", () => ({
  processEnrollmentExpiry: vi.fn(),
}));

vi.mock("@/lib/domains/googleCalendar", () => ({
  createGoogleEvent: vi.fn(),
  updateGoogleEvent: vi.fn(),
  cancelGoogleEvent: vi.fn(),
  getTokensByTenant: vi.fn(),
}));

vi.mock("@/lib/domains/googleCalendar/webhookHandler", () => ({
  renewWebhooksForTenant: vi.fn(),
}));

vi.mock("@/lib/domains/googleCalendar/types", () => ({
  MAX_RETRY_COUNT: 3,
}));

vi.mock("@/lib/domains/payment/paymentLink/delivery", () => ({
  sendPaymentLinkExpiryReminder: vi.fn(),
}));

vi.mock("@/lib/domains/payment/services/reminderService", () => ({
  processPaymentReminders: vi.fn(),
}));

vi.mock("@/lib/services/campInvitationExpiryService", () => ({
  processExpiredInvitations: vi.fn(),
  sendExpiryReminderNotifications: vi.fn(),
}));

vi.mock("@/lib/services/campReminderService", () => ({
  processReminders: vi.fn(),
}));

vi.mock("@/lib/domains/chat/scheduled/processScheduledMessages", () => ({
  processScheduledMessages: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseClientForRLSBypass } from "@/lib/supabase/clientSelector";
import { runAutoBillingForTenant } from "@/lib/domains/payment/actions/billing";
import { cleanupOrphanedAttachments } from "@/lib/domains/chat/cleanup";
import { cleanupDriveFiles } from "@/lib/domains/drive/cleanup";
import { processConsultationReminders } from "@/lib/domains/consulting/services/reminderService";
import { processEnrollmentExpiry } from "@/lib/domains/enrollment/services/expiryService";
import {
  createGoogleEvent,
  updateGoogleEvent,
  cancelGoogleEvent,
} from "@/lib/domains/googleCalendar";
import { renewWebhooksForTenant } from "@/lib/domains/googleCalendar/webhookHandler";
import { sendPaymentLinkExpiryReminder } from "@/lib/domains/payment/paymentLink/delivery";
import { processPaymentReminders } from "@/lib/domains/payment/services/reminderService";
import {
  processExpiredInvitations,
  sendExpiryReminderNotifications,
} from "@/lib/services/campInvitationExpiryService";
import { processReminders } from "@/lib/services/campReminderService";
import { processScheduledMessages } from "@/lib/domains/chat/scheduled/processScheduledMessages";

// ============================================
// 공통 헬퍼
// ============================================

/** CRON_SECRET Bearer 헤더를 가진 GET 요청 */
function makeCronGetRequest(secret = "test-secret"): Request {
  return new Request("http://localhost/api/cron/test", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

/** CRON_SECRET Bearer 헤더를 가진 NextRequest (timingSafeEqual 타입) */
function makeCronNextRequest(secret = "test-secret"): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest("http://localhost/api/cron/test", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

function makeNoAuthRequest(): Request {
  return new Request("http://localhost/api/cron/test", { method: "GET" });
}

function makeNoAuthNextRequest(): import("next/server").NextRequest {
  const { NextRequest } = require("next/server") as typeof import("next/server");
  return new NextRequest("http://localhost/api/cron/test", { method: "GET" });
}

/** Supabase admin chain mock (체이닝 지원) */
function makeAdminMock() {
  const deleteChain = {
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  Object.assign(deleteChain, { then: undefined }); // Promise-like 방지

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      update: vi.fn().mockReturnValue(updateChain),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        then: vi.fn().mockResolvedValue({ count: 0, error: null }),
      }),
    }),
  };
}

const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockGetSupabaseClientForRLSBypass = vi.mocked(getSupabaseClientForRLSBypass);
const mockRunAutoBillingForTenant = vi.mocked(runAutoBillingForTenant);
const mockCleanupOrphanedAttachments = vi.mocked(cleanupOrphanedAttachments);
const mockCleanupDriveFiles = vi.mocked(cleanupDriveFiles);
const mockProcessConsultationReminders = vi.mocked(processConsultationReminders);
const mockProcessEnrollmentExpiry = vi.mocked(processEnrollmentExpiry);
const mockCreateGoogleEvent = vi.mocked(createGoogleEvent);
const mockUpdateGoogleEvent = vi.mocked(updateGoogleEvent);
const mockCancelGoogleEvent = vi.mocked(cancelGoogleEvent);
const mockRenewWebhooksForTenant = vi.mocked(renewWebhooksForTenant);
const mockSendPaymentLinkExpiryReminder = vi.mocked(sendPaymentLinkExpiryReminder);
const mockProcessPaymentReminders = vi.mocked(processPaymentReminders);
const mockProcessExpiredInvitations = vi.mocked(processExpiredInvitations);
const mockSendExpiryReminderNotifications = vi.mocked(sendExpiryReminderNotifications);
const mockProcessReminders = vi.mocked(processReminders);
const mockProcessScheduledMessages = vi.mocked(processScheduledMessages);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
});

// ============================================
// /api/cron/auto-billing
// ============================================

describe("GET /api/cron/auto-billing", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../auto-billing/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const req = makeCronGetRequest("wrong-secret");
    const res = await callRoute(req);
    expect(res.status).toBe(401);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("Unauthorized");
  });

  it("admin client 초기화 실패 → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);
    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });

  it("테넌트 없음 → 200 No tenants", async () => {
    const adminMock = makeAdminMock();
    adminMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    } as unknown as ReturnType<ReturnType<typeof makeAdminMock>["from"]>);
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string };
    expect(json.message).toBe("No tenants with settings");
  });

  it("정상 실행 → 200 results", async () => {
    const today = new Date();
    const tenants = [
      {
        id: "tenant-1",
        settings: {
          billing: {
            auto_billing_enabled: true,
            billing_day: today.getDate(),
            due_day_offset: 7,
          },
        },
      },
    ];
    const adminMock = makeAdminMock();
    adminMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: tenants, error: null }),
      }),
    } as unknown as ReturnType<ReturnType<typeof makeAdminMock>["from"]>);
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);
    mockRunAutoBillingForTenant.mockResolvedValue({ created: 2, skipped: 1 });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; results: Array<{ tenantId: string }> };
    expect(json.message).toBe("Auto billing completed");
    expect(json.results).toHaveLength(1);
    expect(mockRunAutoBillingForTenant).toHaveBeenCalledWith("tenant-1", expect.any(String), expect.any(String));
  });

  it("비즈니스 로직 throw → 500", async () => {
    const adminMock = makeAdminMock();
    adminMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockRejectedValue(new Error("DB 오류")),
      }),
    } as unknown as ReturnType<ReturnType<typeof makeAdminMock>["from"]>);
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("DB 오류");
  });
});

// ============================================
// /api/cron/cleanup-chat-attachments
// ============================================

describe("GET /api/cron/cleanup-chat-attachments", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../cleanup-chat-attachments/route");
    return GET(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(makeNoAuthNextRequest());
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronNextRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 success", async () => {
    mockCleanupOrphanedAttachments.mockResolvedValue({
      success: true,
      orphanedDeleted: 3,
      expiredDeleted: 1,
      storageDeletedCount: 4,
      errors: [],
    });
    mockCleanupDriveFiles.mockResolvedValue({
      success: true,
      expiredDeleted: 2,
      storageDeletedCount: 2,
      errors: [],
    });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; chat: { orphanedDeleted: number } };
    expect(json.success).toBe(true);
    expect(json.chat.orphanedDeleted).toBe(3);
  });

  it("비즈니스 로직 throw → 500", async () => {
    mockCleanupOrphanedAttachments.mockRejectedValue(new Error("스토리지 오류"));

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("스토리지 오류");
  });
});

// ============================================
// /api/cron/consultation-reminders
// ============================================

describe("GET /api/cron/consultation-reminders", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../consultation-reminders/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 + message", async () => {
    mockProcessConsultationReminders.mockResolvedValue({ sent: 5, failed: 0 });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; sent: number };
    expect(json.message).toBe("Consultation reminders processed");
    expect(json.sent).toBe(5);
    expect(mockProcessConsultationReminders).toHaveBeenCalledOnce();
  });

  it("서비스 throw → 500", async () => {
    mockProcessConsultationReminders.mockRejectedValue(new Error("SMS 실패"));

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("SMS 실패");
  });
});

// ============================================
// /api/cron/enrollment-expiry
// ============================================

describe("GET /api/cron/enrollment-expiry", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../enrollment-expiry/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 + message", async () => {
    mockProcessEnrollmentExpiry.mockResolvedValue({ expired: 3, notified: 3 });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; expired: number };
    expect(json.message).toBe("Enrollment expiry processed");
    expect(json.expired).toBe(3);
    expect(mockProcessEnrollmentExpiry).toHaveBeenCalledOnce();
  });

  it("서비스 throw → 500", async () => {
    mockProcessEnrollmentExpiry.mockRejectedValue(new Error("만료 오류"));

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/google-calendar-sync
// ============================================

describe("GET /api/cron/google-calendar-sync", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../google-calendar-sync/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });

  it("큐 항목 없음 → 200 처리할 항목 없음", async () => {
    const adminMock = makeAdminMock();
    adminMock.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as unknown as ReturnType<ReturnType<typeof makeAdminMock>["from"]>);
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(adminMock as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string };
    expect(json.message).toBe("처리할 항목 없음");
  });

  it("create 액션 성공 → 200 succeeded:1", async () => {
    const rows = [
      {
        id: "q1",
        tenant_id: "t1",
        schedule_id: "s1",
        action: "create" as const,
        admin_user_id: "admin1",
        status: "pending",
        retry_count: 0,
      },
    ];

    const updateChain = { eq: vi.fn().mockResolvedValue({ error: null }) };
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: rows, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue(updateChain),
      }),
    };
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(adminMock as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);
    mockCreateGoogleEvent.mockResolvedValue({ success: true });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { succeeded: number };
    expect(json.succeeded).toBe(1);
  });

  it("서비스 throw → 500", async () => {
    mockGetSupabaseClientForRLSBypass.mockRejectedValue(new Error("GCal 오류"));

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/google-calendar-webhook-renew
// ============================================

describe("GET /api/cron/google-calendar-webhook-renew", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../google-calendar-webhook-renew/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(null as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });

  it("토큰 없음 → 200 tenantsProcessed:0", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(adminMock as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { tenantsProcessed: number };
    expect(json.tenantsProcessed).toBe(0);
  });

  it("정상 웹훅 갱신 → 200 renewed:1", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ tenant_id: "t1" }],
            error: null,
          }),
        }),
      }),
    };
    mockGetSupabaseClientForRLSBypass.mockResolvedValue(adminMock as unknown as Awaited<ReturnType<typeof getSupabaseClientForRLSBypass>>);
    mockRenewWebhooksForTenant.mockResolvedValue({ renewed: 1, failed: 0 });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { renewed: number; tenantsProcessed: number };
    expect(json.renewed).toBe(1);
    expect(json.tenantsProcessed).toBe(1);
  });

  it("서비스 throw → 500", async () => {
    mockGetSupabaseClientForRLSBypass.mockRejectedValue(new Error("갱신 실패"));

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/payment-link-maintenance
// ============================================

describe("GET /api/cron/payment-link-maintenance", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../payment-link-maintenance/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });

  it("정상 실행 (만료 링크 처리) → 200", async () => {
    const updateChain = {
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [{ id: "link-1" }], error: null }),
    };
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const adminMock = {
      from: vi.fn().mockReturnValueOnce({ update: vi.fn().mockReturnValue(updateChain) })
              .mockReturnValueOnce({ select: vi.fn().mockReturnValue(selectChain) }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; expired: number };
    expect(json.message).toBe("Payment link maintenance completed");
    expect(json.expired).toBe(1);
  });

  it("서비스 throw → 500", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockReturnValue({
              select: vi.fn().mockRejectedValue(new Error("DB 오류")),
            }),
          }),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/payment-reminders
// ============================================

describe("GET /api/cron/payment-reminders", () => {
  async function callRoute(req: Request) {
    const { GET } = await import("../payment-reminders/route");
    return GET(req);
  }

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronGetRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 + message", async () => {
    mockProcessPaymentReminders.mockResolvedValue({ sent: 4, failed: 0 });

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { message: string; sent: number };
    expect(json.message).toBe("Payment reminders processed");
    expect(json.sent).toBe(4);
    expect(mockProcessPaymentReminders).toHaveBeenCalledOnce();
  });

  it("서비스 throw → 500", async () => {
    mockProcessPaymentReminders.mockRejectedValue(new Error("리마인더 실패"));

    const res = await callRoute(makeCronGetRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/process-camp-expiry
// ============================================

describe("GET /api/cron/process-camp-expiry", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../process-camp-expiry/route");
    return GET(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(makeNoAuthNextRequest());
    expect(res.status).toBe(401);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronNextRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 success", async () => {
    mockSendExpiryReminderNotifications.mockResolvedValue({ success: true, count: 2 });
    mockProcessExpiredInvitations.mockResolvedValue({ success: true, count: 5 });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; expiredCount: number; reminderCount: number };
    expect(json.success).toBe(true);
    expect(json.expiredCount).toBe(5);
    expect(json.reminderCount).toBe(2);
  });

  it("만료 처리 실패 → 500", async () => {
    mockSendExpiryReminderNotifications.mockResolvedValue({ success: true, count: 0 });
    mockProcessExpiredInvitations.mockResolvedValue({ success: false, count: 0, error: "만료 오류" });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(false);
  });

  it("서비스 throw → 500", async () => {
    mockSendExpiryReminderNotifications.mockRejectedValue(new Error("예외 발생"));

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/process-camp-reminders
// ============================================

describe("GET /api/cron/process-camp-reminders", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../process-camp-reminders/route");
    return GET(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(makeNoAuthNextRequest());
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronNextRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 success", async () => {
    mockProcessReminders.mockResolvedValue({ success: true, count: 3 });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; count: number };
    expect(json.success).toBe(true);
    expect(json.count).toBe(3);
  });

  it("리마인더 실패 → 500", async () => {
    mockProcessReminders.mockResolvedValue({ success: false, count: 0, error: "발송 실패" });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
  });

  it("서비스 throw → 500", async () => {
    mockProcessReminders.mockRejectedValue(new Error("예외 발생"));

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/push-cleanup
// ============================================

describe("GET /api/cron/push-cleanup", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../push-cleanup/route");
    return GET(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(makeNoAuthNextRequest());
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronNextRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("admin client 없음 → 500", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(null as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
  });

  it("정상 실행 → 200 success:true", async () => {
    const deleteChain = {
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      then: (resolve: (v: { count: number; error: null }) => void) =>
        resolve({ count: 5, error: null }),
    };
    const adminMock = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue(deleteChain),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("서비스 throw → 500", async () => {
    const adminMock = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockRejectedValue(new Error("삭제 실패")),
          not: vi.fn().mockReturnThis(),
        }),
      }),
    };
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock as unknown as ReturnType<typeof createSupabaseAdminClient>);

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
  });
});

// ============================================
// /api/cron/send-scheduled-messages
// ============================================

describe("GET /api/cron/send-scheduled-messages", () => {
  async function callRoute(req: import("next/server").NextRequest) {
    const { GET } = await import("../send-scheduled-messages/route");
    return GET(req);
  }

  it("인증 헤더 없음 → 401", async () => {
    const res = await callRoute(makeNoAuthNextRequest());
    expect(res.status).toBe(401);
  });

  it("CRON_SECRET 불일치 → 401", async () => {
    const res = await callRoute(makeCronNextRequest("bad"));
    expect(res.status).toBe(401);
  });

  it("정상 실행 → 200 success:true + durationMs", async () => {
    mockProcessScheduledMessages.mockResolvedValue({ processed: 3, sent: 3, failed: 0 });

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; durationMs: number; processed: number };
    expect(json.success).toBe(true);
    expect(json.processed).toBe(3);
    expect(typeof json.durationMs).toBe("number");
  });

  it("서비스 throw → 500", async () => {
    mockProcessScheduledMessages.mockRejectedValue(new Error("스케줄 처리 실패"));

    const res = await callRoute(makeCronNextRequest());
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe("스케줄 처리 실패");
  });
});
