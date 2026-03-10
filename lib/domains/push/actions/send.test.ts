/**
 * send.ts 단위 테스트
 *
 * @module lib/domains/push/actions/send.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// web-push 모킹
const mockSendNotification = vi.fn();
vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
    setVapidDetails: vi.fn(),
  },
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  setVapidDetails: vi.fn(),
}));

// VAPID 모킹
vi.mock("../vapid", () => ({
  ensureVapidConfigured: vi.fn(() => true),
}));

// Supabase admin 모킹
const mockFrom = vi.fn();
const mockSupabase = { from: mockFrom };
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

// "use server" directive 무시를 위해 동적 import
const { sendPushToUser } = await import("./send");

describe("sendPushToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본: 빈 구독 목록
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [] }),
        }),
      }),
    });
  });

  it("VAPID 미설정 시 { sent: 0, failed: 0 } 반환", async () => {
    const { ensureVapidConfigured } = await import("../vapid");
    vi.mocked(ensureVapidConfigured).mockReturnValueOnce(false);

    const result = await sendPushToUser("user-1", {
      title: "테스트",
      body: "본문",
    });
    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(mockSendNotification).not.toHaveBeenCalled();
  });

  it("활성 구독 없으면 { sent: 0, failed: 0 } 반환", async () => {
    const result = await sendPushToUser("user-1", {
      title: "테스트",
      body: "본문",
    });
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it("정상 발송 시 sent 카운트 증가", async () => {
    const subscriptions = [
      { id: "sub-1", subscription: { endpoint: "https://push.example.com/1", keys: { p256dh: "a", auth: "b" } } },
      { id: "sub-2", subscription: { endpoint: "https://push.example.com/2", keys: { p256dh: "c", auth: "d" } } },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: subscriptions }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({}) };
    });

    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    const result = await sendPushToUser("user-1", {
      title: "테스트",
      body: "본문",
    });
    expect(result).toEqual({ sent: 2, failed: 0 });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });

  it("410 Gone 응답 시 구독 비활성화", async () => {
    const subscriptions = [
      { id: "sub-gone", subscription: { endpoint: "https://push.example.com/gone", keys: { p256dh: "a", auth: "b" } } },
    ];

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({}),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: subscriptions }),
            }),
          }),
          update: mockUpdate,
        };
      }
      return { insert: vi.fn().mockResolvedValue({}) };
    });

    mockSendNotification.mockRejectedValue({ statusCode: 410, message: "Gone" });

    const result = await sendPushToUser("user-1", {
      title: "테스트",
      body: "본문",
    });
    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
  });

  it("4KB 초과 페이로드는 body를 200자로 truncate", async () => {
    const subscriptions = [
      { id: "sub-1", subscription: { endpoint: "https://push.example.com/1", keys: { p256dh: "a", auth: "b" } } },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: subscriptions }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({}) };
    });

    mockSendNotification.mockResolvedValue({ statusCode: 201 });

    // 매우 긴 body 생성 (4KB 초과)
    const longBody = "가".repeat(3000);
    const result = await sendPushToUser("user-1", {
      title: "테스트",
      body: longBody,
    });
    expect(result.sent).toBe(1);

    // sendNotification에 전달된 payload 확인
    const sentPayload = JSON.parse(mockSendNotification.mock.calls[0][1]);
    expect(sentPayload.body.length).toBeLessThanOrEqual(202); // 200 + "…"
  });

  it("429 응답 시 재시도 후 성공", async () => {
    const subscriptions = [
      { id: "sub-1", subscription: { endpoint: "https://push.example.com/1", keys: { p256dh: "a", auth: "b" } } },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === "push_subscriptions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: subscriptions }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({}) };
    });

    // 첫 번째 429, 두 번째 성공
    mockSendNotification
      .mockRejectedValueOnce({ statusCode: 429, message: "Too Many Requests" })
      .mockResolvedValueOnce({ statusCode: 201 });

    // sleep을 즉시 resolve로 대체
    vi.useFakeTimers();
    const promise = sendPushToUser("user-1", {
      title: "테스트",
      body: "본문",
    });
    // 타이머 진행
    await vi.runAllTimersAsync();
    const result = await promise;
    vi.useRealTimers();

    expect(result).toEqual({ sent: 1, failed: 0 });
    expect(mockSendNotification).toHaveBeenCalledTimes(2);
  });
});
