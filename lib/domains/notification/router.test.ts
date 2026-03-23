/**
 * router.ts 단위 테스트
 *
 * shouldSkip 필터링 로직 + routeNotification 통합 흐름 검증
 *
 * @module lib/domains/notification/router.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// sendPushToUser 모킹
const mockSendPushToUser = vi.fn();
vi.mock("@/lib/domains/push/actions/send", () => ({
  sendPushToUser: (...args: unknown[]) => mockSendPushToUser(...args),
}));

// Supabase admin 모킹
const mockInsert = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: "log-1" } }),
  }),
});
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({}),
});

// 쿼리 체인 헬퍼
function chainQuery(data: unknown, count?: number) {
  const chain: Record<string, unknown> = {};
  const obj = {
    select: vi.fn().mockReturnValue(chain),
    eq: vi.fn().mockReturnValue(chain),
    is: vi.fn().mockReturnValue(chain),
    neq: vi.fn().mockReturnValue(chain),
    gt: vi.fn().mockReturnValue(chain),
    gte: vi.fn().mockReturnValue(chain),
    like: vi.fn().mockReturnValue(chain),
    limit: vi.fn().mockReturnValue(chain),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
  Object.assign(chain, obj);
  // Promise.then for direct await
  chain.then = (resolve: (v: unknown) => void) =>
    resolve({ data, count, error: null });
  return obj;
}

const mockFromHandlers: Record<string, ReturnType<typeof chainQuery>> = {};
const mockFrom = vi.fn((table: string) => {
  if (mockFromHandlers[table]) return mockFromHandlers[table];
  // notification_log 기본 동작
  if (table === "notification_log") {
    return {
      insert: mockInsert,
      update: mockUpdate,
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
            like: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({ data: null, count: 0 }),
              }),
            }),
          }),
        }),
      }),
    };
  }
  return chainQuery(null);
});

const mockSupabase = { from: mockFrom };
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => mockSupabase,
  type: {} as unknown,
}));

const { routeNotification } = await import("./router");

describe("routeNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockFromHandlers).forEach(
      (k) => delete mockFromHandlers[k]
    );

    // 기본: preference OK, 프레즌스 idle, 구독 있음
    mockFromHandlers["student_notification_preferences"] = chainQuery({
      chat_push_enabled: true,
      quiet_hours_enabled: false,
    });
    mockFromHandlers["user_presence"] = chainQuery({
      status: "idle",
      updated_at: new Date(Date.now() - 120_000).toISOString(),
    });

    mockSendPushToUser.mockResolvedValue({ sent: 1, failed: 0 });
  });

  it("기본 케이스: 정상 발송", async () => {
    const result = await routeNotification({
      type: "chat_message",
      recipientIds: ["user-1"],
      payload: { title: "새 메시지", body: "안녕하세요", tag: "chat-room-1" },
      priority: "normal",
      source: "db_trigger",
    });

    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockSendPushToUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "새 메시지",
        body: "안녕하세요",
        notificationLogId: "log-1",
      })
    );
  });

  it("preference_off → 스킵", async () => {
    mockFromHandlers["student_notification_preferences"] = chainQuery({
      chat_push_enabled: false,
      quiet_hours_enabled: false,
    });

    const result = await routeNotification({
      type: "chat_message",
      recipientIds: ["user-1"],
      payload: { title: "새 메시지", body: "안녕하세요" },
      priority: "normal",
      source: "db_trigger",
    });

    expect(result.skipped).toBe(1);
    expect(result.sent).toBe(0);
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("구독 없으면 no_subscription으로 마킹", async () => {
    mockSendPushToUser.mockResolvedValue({ sent: 0, failed: 0 });

    const result = await routeNotification({
      type: "chat_message",
      recipientIds: ["user-1"],
      payload: { title: "새 메시지", body: "안녕하세요" },
      priority: "normal",
      source: "db_trigger",
    });

    expect(result.skipped).toBe(1);
  });

  it("여러 수신자에게 개별 발송", async () => {
    const result = await routeNotification({
      type: "plan_created",
      recipientIds: ["user-1", "user-2", "user-3"],
      payload: { title: "새 플랜", body: "플랜이 생성되었습니다" },
      priority: "normal",
      source: "server_action",
    });

    expect(mockSendPushToUser).toHaveBeenCalledTimes(3);
    expect(result.sent).toBe(3);
  });
});

describe("isInQuietHours (간접 테스트)", () => {
  it("방해금지 시간대에는 스킵 (normal 우선순위)", async () => {
    // 현재 시간을 포함하는 방해금지 범위 (0~23 안전하게)
    const now = new Date();
    const h = now.getHours();
    const startH = String((h + 23) % 24).padStart(2, "0"); // h-1 (wrap safe)
    const endH = String((h + 1) % 24).padStart(2, "0");

    mockFromHandlers["student_notification_preferences"] = chainQuery({
      study_reminder_push_enabled: true,
      quiet_hours_enabled: true,
      quiet_hours_start: `${startH}:00`,
      quiet_hours_end: `${endH}:00`,
    });

    // 명시적으로 mock 초기화 (이전 테스트 호출 잔여 방지)
    mockSendPushToUser.mockClear();

    const result = await routeNotification({
      type: "study_reminder",
      recipientIds: ["user-1"],
      payload: { title: "학습 알림", body: "공부 시간입니다" },
      priority: "normal",
      source: "cron",
    });

    expect(result.skipped).toBe(1);
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("high 우선순위는 방해금지 무시", async () => {
    const now = new Date();
    const h = now.getHours();
    const startH = String((h + 23) % 24).padStart(2, "0");
    const endH = String((h + 1) % 24).padStart(2, "0");

    mockFromHandlers["student_notification_preferences"] = chainQuery({
      quiet_hours_enabled: true,
      quiet_hours_start: `${startH}:00`,
      quiet_hours_end: `${endH}:00`,
    });

    const result = await routeNotification({
      type: "admin_notification",
      recipientIds: ["user-1"],
      payload: { title: "긴급 공지", body: "중요 공지사항" },
      priority: "high",
      source: "server_action",
    });

    expect(result.sent).toBe(1);
  });
});
