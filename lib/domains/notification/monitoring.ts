import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SkipReason } from "./types";

// ============================================
// 타입 정의
// ============================================

export type TodayStats = {
  sent: number;
  skipped: number;
  failed: number;
};

export type SkipReasonStat = {
  reason: SkipReason;
  count: number;
  percentage: number;
};

export type DeviceStat = {
  label: string;
  count: number;
};

export type NotificationMonitoringData = {
  today: TodayStats;
  skipReasons: SkipReasonStat[];
  subscriptions: {
    total: number;
    uniqueUsers: number;
    byDevice: DeviceStat[];
  };
  clickRate: {
    rate: number;
    clicked: number;
    total: number;
  };
};

// ============================================
// 모니터링 데이터 조회
// ============================================

const SKIP_REASONS: SkipReason[] = [
  "preference_off",
  "muted",
  "quiet_hours",
  "online",
  "rate_limited",
  "duplicate",
  "no_subscription",
];

const DEVICE_LABELS = [
  "iOS Safari",
  "Android Chrome",
  "macOS Desktop",
  "Windows Desktop",
  "Linux Desktop",
  "Unknown Device",
];

/**
 * 관리자 알림 모니터링 대시보드 데이터를 조회합니다.
 * notification_log + push_subscriptions 테이블 기반.
 */
export async function getNotificationMonitoringData(): Promise<NotificationMonitoringData | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // notification_log 테이블은 database.types.ts에 미포함이므로 as unknown 캐스트 사용
  const logTable = "notification_log" as "push_subscriptions";

  // 병렬 쿼리 실행
  const [
    sentResult,
    skippedResult,
    failedResult,
    ...skipReasonResults
  ] = await Promise.all([
    // 오늘 발송 성공
    supabase
      .from(logTable)
      .select("id", { count: "exact", head: true })
      .is("skipped_reason" as "keys_auth", null)
      .eq("delivered" as "keys_auth", true as unknown as string)
      .gte("sent_at" as "keys_auth", todayISO) as unknown as Promise<{ count: number | null }>,

    // 오늘 스킵
    supabase
      .from(logTable)
      .select("id", { count: "exact", head: true })
      .not("skipped_reason" as "keys_auth", "is", null)
      .gte("sent_at" as "keys_auth", todayISO) as unknown as Promise<{ count: number | null }>,

    // 오늘 실패 (발송 시도했으나 delivered=false)
    supabase
      .from(logTable)
      .select("id", { count: "exact", head: true })
      .is("skipped_reason" as "keys_auth", null)
      .eq("delivered" as "keys_auth", false as unknown as string)
      .gte("sent_at" as "keys_auth", todayISO) as unknown as Promise<{ count: number | null }>,

    // 스킵 사유별 카운트
    ...SKIP_REASONS.map((reason) =>
      (supabase
        .from(logTable)
        .select("id", { count: "exact", head: true })
        .eq("skipped_reason" as "keys_auth", reason)
        .gte("sent_at" as "keys_auth", todayISO) as unknown as Promise<{ count: number | null }>)
    ),
  ]);

  // 구독 + 클릭률 병렬 쿼리
  const [
    totalSubsResult,
    clickedResult,
    totalDeliveredResult,
    ...deviceResults
  ] = await Promise.all([
    // 활성 구독 수
    supabase
      .from("push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    // 최근 7일 클릭 수
    supabase
      .from(logTable)
      .select("id", { count: "exact", head: true })
      .eq("clicked" as "keys_auth", true as unknown as string)
      .gte("sent_at" as "keys_auth", sevenDaysAgo) as unknown as Promise<{ count: number | null }>,

    // 최근 7일 전체 발송 수
    supabase
      .from(logTable)
      .select("id", { count: "exact", head: true })
      .is("skipped_reason" as "keys_auth", null)
      .eq("delivered" as "keys_auth", true as unknown as string)
      .gte("sent_at" as "keys_auth", sevenDaysAgo) as unknown as Promise<{ count: number | null }>,

    // 디바이스별 구독 수
    ...DEVICE_LABELS.map((label) =>
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .eq("device_label", label)
    ),
  ]);

  // 고유 사용자 수 (활성 구독 기준)
  const { data: uniqueUsersData } = await supabase
    .from("push_subscriptions")
    .select("user_id")
    .eq("is_active", true);

  const uniqueUsers = new Set(
    (uniqueUsersData ?? []).map((d: { user_id: string }) => d.user_id)
  ).size;

  // 결과 조합
  const today: TodayStats = {
    sent: sentResult.count ?? 0,
    skipped: skippedResult.count ?? 0,
    failed: failedResult.count ?? 0,
  };

  const totalSkipped = today.skipped || 1; // 0 나누기 방지
  const skipReasons: SkipReasonStat[] = SKIP_REASONS.map((reason, i) => {
    const count = skipReasonResults[i].count ?? 0;
    return {
      reason,
      count,
      percentage: today.skipped > 0 ? Math.round((count / totalSkipped) * 100) : 0,
    };
  }).filter((s) => s.count > 0);

  const byDevice: DeviceStat[] = DEVICE_LABELS.map((label, i) => ({
    label,
    count: deviceResults[i].count ?? 0,
  })).filter((d) => d.count > 0);

  const clicked = clickedResult.count ?? 0;
  const totalDelivered = totalDeliveredResult.count ?? 0;

  return {
    today,
    skipReasons,
    subscriptions: {
      total: totalSubsResult.count ?? 0,
      uniqueUsers,
      byDevice,
    },
    clickRate: {
      rate: totalDelivered > 0 ? Math.round((clicked / totalDelivered) * 100) : 0,
      clicked,
      total: totalDelivered,
    },
  };
}
