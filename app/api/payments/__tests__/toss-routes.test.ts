/**
 * 토스페이먼츠 결제 API 라우트 단위 테스트
 *
 * 커버리지:
 *   - /api/payments/toss/confirm        (POST) — 인증된 단일/배치 결제 승인
 *   - /api/payments/toss/confirm-guest  (POST) — 토큰 기반 게스트 결제 승인
 *   - /api/payments/toss/webhook        (POST) — Toss 웹훅 이벤트 처리
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================
// Mocks
// ============================================

vi.mock("@/lib/auth/getCurrentUserRole", () => ({
  getCachedUserRole: vi.fn(),
}));

vi.mock("@/lib/services/tossPayments", () => ({
  confirmTossPayment: vi.fn(),
  getPaymentByOrderId: vi.fn(),
  mapTossErrorToMessage: vi.fn((code: string) => `[${code}] 오류 메시지`),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/domains/parent/utils", () => ({
  getLinkedStudents: vi.fn(),
}));

vi.mock("@/lib/domains/payment/paymentLink/delivery", () => ({
  sendPaymentReceiptNotification: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// ============================================
// Imports (after mocks)
// ============================================

import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { confirmTossPayment, getPaymentByOrderId, mapTossErrorToMessage } from "@/lib/services/tossPayments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getLinkedStudents } from "@/lib/domains/parent/utils";
import { sendPaymentReceiptNotification } from "@/lib/domains/payment/paymentLink/delivery";
import type { TossPaymentResponse } from "@/lib/services/tossPayments";

// ============================================
// 공통 헬퍼
// ============================================

function makePostRequest(url: string, body: object): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 최소 TossPaymentResponse mock */
function makeTossResponse(overrides: Partial<TossPaymentResponse> = {}): TossPaymentResponse {
  return {
    paymentKey: "toss-pk-abc123",
    orderId: "TLU-ORDER-001",
    orderName: "테스트 수업",
    status: "DONE",
    method: "카드",
    totalAmount: 100000,
    balanceAmount: 100000,
    requestedAt: "2026-01-01T10:00:00+09:00",
    approvedAt: "2026-01-01T10:00:05+09:00",
    receipt: { url: "https://toss.im/receipt/abc" },
    cancels: null,
    ...overrides,
  };
}

/** Supabase 체이닝 mock — select().eq().maybeSingle() 형태 */
function makeSupabaseMock(
  recordsByTable: Record<string, { data: unknown; error: unknown } | null>,
  updateResult: { error: unknown } = { error: null },
  rpcResult: { error: unknown } = { error: null }
) {
  const selectChain = (tableName: string) => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(
            recordsByTable[tableName] ?? { data: null, error: null }
          ),
          in: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(
              recordsByTable[tableName] ?? { data: null, error: null }
            ),
          }),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        in: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(
            recordsByTable[tableName] ?? { data: null, error: null }
          ),
        }),
        maybeSingle: vi.fn().mockResolvedValue(
          recordsByTable[tableName] ?? { data: null, error: null }
        ),
      }),
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(updateResult),
        in: vi.fn().mockResolvedValue(updateResult),
        mockResolvedValue: vi.fn().mockResolvedValue(updateResult),
      }),
      in: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue(updateResult),
      }),
    }),
  });

  const mock = {
    from: vi.fn((tableName: string) => selectChain(tableName)),
    rpc: vi.fn().mockResolvedValue(rpcResult),
  };

  return mock as unknown as ReturnType<typeof createSupabaseAdminClient>;
}

const mockGetCachedUserRole = vi.mocked(getCachedUserRole);
const mockConfirmTossPayment = vi.mocked(confirmTossPayment);
const mockGetPaymentByOrderId = vi.mocked(getPaymentByOrderId);
const mockMapTossErrorToMessage = vi.mocked(mapTossErrorToMessage);
const mockCreateSupabaseAdminClient = vi.mocked(createSupabaseAdminClient);
const mockCreateSupabaseServerClient = vi.mocked(createSupabaseServerClient);
const mockGetLinkedStudents = vi.mocked(getLinkedStudents);
const mockSendPaymentReceiptNotification = vi.mocked(sendPaymentReceiptNotification);

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// POST /api/payments/toss/confirm
// ============================================

describe("POST /api/payments/toss/confirm", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../toss/confirm/route");
    return POST(
      makePostRequest("http://localhost/api/payments/toss/confirm", body) as Parameters<typeof POST>[0]
    );
  }

  // ------ 인증 관련 ------

  it("userId 없음 → 401", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: null, role: null, tenantId: null });

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(401);
    const json = await res.json() as { success: boolean; error: { message: string } };
    expect(json.success).toBe(false);
  });

  it("허용되지 않는 role(student) → 401", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "student", tenantId: "t1" });

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(401);
  });

  // ------ 파라미터 검증 ------

  it("paymentKey 누락 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "parent", tenantId: "t1" });

    const res = await callRoute({ orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("paymentKey");
  });

  it("orderId 누락 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "parent", tenantId: "t1" });

    const res = await callRoute({ paymentKey: "pk", amount: 100000 });

    expect(res.status).toBe(400);
  });

  it("amount 누락 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "parent", tenantId: "t1" });

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001" });

    expect(res.status).toBe(400);
  });

  // ------ 단일 결제 (handleSingleConfirm) ------

  it("결제 레코드 없음 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_records: { data: null, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("결제 레코드");
  });

  it("이미 paid 상태인 레코드 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 100000,
      status: "paid",
      toss_order_id: "TLU-001",
      tenant_id: "t1",
      student_id: "s1",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_records: { data: record, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("이미 결제");
  });

  it("금액 불일치 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
      tenant_id: "t1",
      student_id: "s1",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_records: { data: record, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 50000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("금액");
  });

  it("Toss API 승인 실패 → 400 + 에러 메시지 포함", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
      tenant_id: "t1",
      student_id: "s1",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_records: { data: record, error: null } })
    );

    const tossError = new Error("카드 결제 실패") as Error & { code?: string };
    tossError.code = "REJECT_CARD_PAYMENT";
    mockConfirmTossPayment.mockRejectedValue(tossError);
    mockMapTossErrorToMessage.mockReturnValue("한도 초과 또는 잔액 부족으로 결제에 실패했습니다.");

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toBe("한도 초과 또는 잔액 부족으로 결제에 실패했습니다.");
  });

  it("단일 결제 승인 성공 (admin) → 200 + paymentKey, orderId, status", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
      tenant_id: "t1",
      student_id: "s1",
    };

    // update chain: eq().eq() → Promise
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(makeTossResponse({ orderId: "TLU-001" }));

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { paymentKey: string; orderId: string; status: string } };
    expect(json.success).toBe(true);
    expect(json.data.paymentKey).toBe("toss-pk-abc123");
    expect(json.data.orderId).toBe("TLU-001");
    expect(json.data.status).toBe("paid");
  });

  it("학부모 결제 — 연결되지 않은 학생 → 403", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "parent1", role: "parent", tenantId: "t1" });

    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
      tenant_id: "t1",
      student_id: "other-student",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_records: { data: record, error: null } })
    );
    mockCreateSupabaseServerClient.mockResolvedValue({} as Awaited<ReturnType<typeof createSupabaseServerClient>>);
    mockGetLinkedStudents.mockResolvedValue([{ id: "my-student" } as Parameters<typeof mockGetLinkedStudents>[0]]);

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(403);
  });

  // ------ 배치 결제 (handleBatchConfirm) ------

  it("배치 결제 — 주문 없음 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_orders: { data: null, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-BATCH-001", amount: 200000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("일괄 결제 주문");
  });

  it("배치 결제 — 이미 paid 상태 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const order = {
      id: "order1",
      tenant_id: "t1",
      total_amount: 200000,
      status: "paid",
      toss_order_id: "TLU-BATCH-001",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_orders: { data: order, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-BATCH-001", amount: 200000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("이미 결제");
  });

  it("배치 결제 — 금액 불일치 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const order = {
      id: "order1",
      tenant_id: "t1",
      total_amount: 200000,
      status: "pending",
      toss_order_id: "TLU-BATCH-001",
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_orders: { data: order, error: null } })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-BATCH-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("금액");
  });

  it("배치 결제 승인 성공 → 200 + status paid", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const order = {
      id: "order1",
      tenant_id: "t1",
      total_amount: 200000,
      status: "pending",
      toss_order_id: "TLU-BATCH-001",
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-BATCH-001", totalAmount: 200000 })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-BATCH-001", amount: 200000 });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { status: string } };
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("paid");
  });

  it("배치 결제 — RPC 실패 → 400", async () => {
    mockGetCachedUserRole.mockResolvedValue({ userId: "u1", role: "admin", tenantId: "t1" });

    const order = {
      id: "order1",
      tenant_id: "t1",
      total_amount: 200000,
      status: "pending",
      toss_order_id: "TLU-BATCH-001",
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: order, error: null }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: { message: "RPC 실패" } }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-BATCH-001", totalAmount: 200000 })
    );

    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-BATCH-001", amount: 200000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("결제 내역 업데이트");
  });
});

// ============================================
// POST /api/payments/toss/confirm-guest
// ============================================

describe("POST /api/payments/toss/confirm-guest", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../toss/confirm-guest/route");
    return POST(
      makePostRequest("http://localhost/api/payments/toss/confirm-guest", body) as Parameters<typeof POST>[0]
    );
  }

  // ------ 파라미터 검증 ------

  it("token 누락 → 400", async () => {
    const res = await callRoute({ paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("token");
  });

  it("paymentKey 누락 → 400", async () => {
    const res = await callRoute({ token: "tok", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
  });

  it("orderId 누락 → 400", async () => {
    const res = await callRoute({ token: "tok", paymentKey: "pk", amount: 100000 });

    expect(res.status).toBe(400);
  });

  it("amount 누락 → 400", async () => {
    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001" });

    expect(res.status).toBe(400);
  });

  // ------ 인증 없이 동작하는지 ------

  it("인증 없이 토큰만으로 처리 — getCachedUserRole 호출 안 됨", async () => {
    // adminClient는 DB 오류 반환으로 설정하여 조기 리턴 유도
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_links: { data: null, error: { message: "없음" } } })
    );

    await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(mockGetCachedUserRole).not.toHaveBeenCalled();
  });

  // ------ 토큰 검증 ------

  it("존재하지 않는 토큰 → 400", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_links: { data: null, error: null } })
    );

    const res = await callRoute({ token: "invalid-tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("유효하지 않은 결제 링크");
  });

  it("completed 상태 링크 → 400", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "completed",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_links: { data: link, error: null } })
    );

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("유효하지 않습니다");
  });

  it("만료된 링크 → 400", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() - 3600_000).toISOString(), // 1시간 전 만료
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: link, error: null }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("만료된 결제 링크");
  });

  it("링크 금액과 요청 금액 불일치 → 400", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({ payment_links: { data: link, error: null } })
    );

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 50000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("금액");
  });

  // ------ 결제 레코드 검증 ------

  it("이미 paid 상태인 결제 레코드 → 400", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };
    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 100000,
      status: "paid",
      toss_order_id: "TLU-001",
    };

    let callCount = 0;
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve({ data: link, error: null });
              return Promise.resolve({ data: record, error: null });
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toContain("이미 결제");
  });

  // ------ Toss API 성공/실패 ------

  it("Toss API 승인 실패 → 400", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };
    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
    };

    let callCount = 0;
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve({ data: link, error: null });
              return Promise.resolve({ data: record, error: null });
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const tossError = new Error("결제 실패") as Error & { code?: string };
    tossError.code = "INVALID_REQUEST";
    mockConfirmTossPayment.mockRejectedValue(tossError);
    mockMapTossErrorToMessage.mockReturnValue("잘못된 요청입니다.");

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: { message: string } };
    expect(json.error.message).toBe("잘못된 요청입니다.");
  });

  it("게스트 결제 승인 성공 → 200 + paymentKey, status", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: null,
      delivery_method: null,
    };
    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
    };

    let callCount = 0;
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve({ data: link, error: null });
              return Promise.resolve({ data: record, error: null });
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(makeTossResponse({ orderId: "TLU-001" }));

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; data: { paymentKey: string; status: string } };
    expect(json.success).toBe(true);
    expect(json.data.paymentKey).toBe("toss-pk-abc123");
    expect(json.data.status).toBe("paid");
  });

  it("영수증 알림 발송 — recipient_phone + delivery_method 있을 때 비동기 호출", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: "010-1234-5678",
      delivery_method: "sms",
    };
    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
    };

    let callCount = 0;
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve({ data: link, error: null });
              return Promise.resolve({ data: record, error: null });
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(makeTossResponse({ orderId: "TLU-001" }));
    mockSendPaymentReceiptNotification.mockResolvedValue(undefined);

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(200);
    expect(mockSendPaymentReceiptNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientPhone: "010-1234-5678",
        deliveryMethod: "sms",
      })
    );
  });

  it("delivery_method = manual이면 영수증 알림 호출 안 함", async () => {
    const link = {
      id: "link1",
      payment_record_id: "rec1",
      amount: 100000,
      status: "active",
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      tenant_id: "t1",
      academy_name: "테스트학원",
      student_name: "홍길동",
      program_name: "수학",
      recipient_phone: "010-1234-5678",
      delivery_method: "manual",
    };
    const record = {
      id: "rec1",
      amount: 100000,
      paid_amount: 0,
      status: "unpaid",
      toss_order_id: "TLU-001",
    };

    let callCount = 0;
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) return Promise.resolve({ data: link, error: null });
              return Promise.resolve({ data: record, error: null });
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    mockConfirmTossPayment.mockResolvedValue(makeTossResponse({ orderId: "TLU-001" }));

    const res = await callRoute({ token: "tok", paymentKey: "pk", orderId: "TLU-001", amount: 100000 });

    expect(res.status).toBe(200);
    expect(mockSendPaymentReceiptNotification).not.toHaveBeenCalled();
  });
});

// ============================================
// POST /api/payments/toss/webhook
// ============================================

describe("POST /api/payments/toss/webhook", () => {
  async function callRoute(body: object) {
    const { POST } = await import("../toss/webhook/route");
    return POST(
      makePostRequest("http://localhost/api/payments/toss/webhook", body) as Parameters<typeof POST>[0]
    );
  }

  // 웹훅은 항상 200을 반환해야 한다 (Toss 문서 요구사항)

  it("orderId 없음 → 즉시 200 반환", async () => {
    const res = await callRoute({ status: "DONE" });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("우리 시스템 접두사(TLU-)가 없는 orderId → 200 반환 (무시)", async () => {
    const res = await callRoute({ orderId: "OTHER-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
    expect(mockGetPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("처리 대상 아닌 status(WAITING_FOR_DEPOSIT) → 200 반환 (무시)", async () => {
    const res = await callRoute({ orderId: "TLU-001", status: "WAITING_FOR_DEPOSIT" });

    expect(res.status).toBe(200);
    expect(mockGetPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("status 없음 → 200 반환 (무시)", async () => {
    const res = await callRoute({ orderId: "TLU-001" });

    expect(res.status).toBe(200);
    expect(mockGetPaymentByOrderId).not.toHaveBeenCalled();
  });

  it("Toss API 조회 실패 → 200 반환 (웹훅 실패 안 함)", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(
      makeSupabaseMock({})
    );
    mockGetPaymentByOrderId.mockRejectedValue(new Error("Toss API 오류"));

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
  });

  it("Toss API 상태와 웹훅 상태 불일치 → 200 반환 (처리 안 함)", async () => {
    mockCreateSupabaseAdminClient.mockReturnValue(makeSupabaseMock({}));
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-ORDER-001", status: "CANCELED" })
    );

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
  });

  // ------ DONE 이벤트 처리 ------

  it("DONE 이벤트 — 결제 레코드 없음 → 200 반환 (DB 업데이트 생략)", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-ORDER-001", status: "DONE", totalAmount: 100000 })
    );

    // payment_records에 미납 레코드 없음
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("DONE 이벤트 — 금액 불일치 → 200 반환 (DB 업데이트 생략)", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-ORDER-001", status: "DONE", totalAmount: 50000 })
    );

    const record = { id: "rec1", amount: 100000, status: "unpaid" };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("DONE 이벤트 — 정상 처리 → DB 업데이트 호출 + 200", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({ orderId: "TLU-ORDER-001", status: "DONE", totalAmount: 100000 })
    );

    const record = { id: "rec1", amount: 100000, status: "unpaid" };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
  });

  // ------ CANCELED 이벤트 처리 ------

  it("CANCELED 이벤트 — paid 레코드 없음 → 200 (DB 업데이트 생략)", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({
        orderId: "TLU-ORDER-001",
        status: "CANCELED",
        balanceAmount: 0,
        cancels: [{ cancelReason: "고객 요청", canceledAt: "2026-01-01T12:00:00+09:00", cancelAmount: 100000, cancelStatus: "DONE", transactionKey: "tx1" }],
      })
    );

    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "CANCELED" });

    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("CANCELED 이벤트 — 전액 환불 처리 → status refunded, DB 업데이트 호출 + 200", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({
        orderId: "TLU-ORDER-001",
        status: "CANCELED",
        balanceAmount: 0,
        cancels: [{ cancelReason: "고객 요청", canceledAt: "2026-01-01T12:00:00+09:00", cancelAmount: 100000, cancelStatus: "DONE", transactionKey: "tx1" }],
      })
    );

    const record = { id: "rec1", amount: 100000, paid_amount: 100000, status: "paid", toss_payment_key: "toss-pk-abc123" };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "CANCELED" });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
    // update 호출 인자에 status: "refunded" 포함 확인
    const updateCall = updateMock.mock.calls[0][0] as { status: string };
    expect(updateCall.status).toBe("refunded");
  });

  it("PARTIAL_CANCELED 이벤트 — 부분 환불 처리 → status partial + 200", async () => {
    mockGetPaymentByOrderId.mockResolvedValue(
      makeTossResponse({
        orderId: "TLU-ORDER-001",
        status: "PARTIAL_CANCELED",
        balanceAmount: 50000, // 5만원 잔액 = 5만원 환불
        cancels: [{ cancelReason: "부분 환불", canceledAt: "2026-01-01T12:00:00+09:00", cancelAmount: 50000, cancelStatus: "DONE", transactionKey: "tx2" }],
      })
    );

    const record = { id: "rec1", amount: 100000, paid_amount: 100000, status: "paid", toss_payment_key: "toss-pk-abc123" };
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    const adminMock = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: record, error: null }),
            }),
          }),
        }),
        update: updateMock,
      }),
      rpc: vi.fn().mockResolvedValue({ error: null }),
    } as unknown as ReturnType<typeof createSupabaseAdminClient>;
    mockCreateSupabaseAdminClient.mockReturnValue(adminMock);

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "PARTIAL_CANCELED" });

    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalled();
    const updateCall = updateMock.mock.calls[0][0] as { status: string; paid_amount: number };
    expect(updateCall.status).toBe("partial");
    expect(updateCall.paid_amount).toBe(50000);
  });

  it("처리 중 예외 발생해도 항상 200 반환", async () => {
    mockCreateSupabaseAdminClient.mockImplementation(() => {
      throw new Error("DB 연결 실패");
    });

    const res = await callRoute({ orderId: "TLU-ORDER-001", status: "DONE" });

    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
  });
});
