"use server";

import {
  createSupabaseAdminClient,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/domains/push/actions/send";
import {
  type NotificationType,
  type NotificationRequest,
  type SkipReason,
  NOTIFICATION_PREFERENCE_MAP,
} from "./types";

/**
 * heartbeat 기준 활성 상태 판단 임계치 (ms).
 * useAppPresence 훅이 30초마다 heartbeat를 전송하므로,
 * 45초(1.5배)를 초과하면 비활성으로 간주합니다.
 *
 * iOS PWA는 백그라운드 진입 시 JS 실행이 즉시 중단되어
 * visibilitychange → "idle" upsert가 완료되지 않을 수 있습니다.
 * 45초면 heartbeat 1회 미수신 시점에 비활성 전환되어
 * push 알림이 정상 발송됩니다.
 */
const PRESENCE_STALE_THRESHOLD = 45_000;
/** 그룹 채팅 요약 판단 윈도우 (5분) */
const GROUP_SUMMARY_WINDOW = 300_000;
/** 그룹 채팅 요약 발동 임계치 */
const GROUP_SUMMARY_THRESHOLD = 3;

/**
 * 서버 사이드 Notification Router.
 *
 * 모든 Push 알림의 단일 진입점.
 * 수신자별로 설정/뮤트/방해금지/빈도/중복을 확인한 후 발송합니다.
 *
 * fire-and-forget 패턴으로 호출:
 *   routeNotification(request).catch(console.error);
 */
export async function routeNotification(
  request: NotificationRequest
): Promise<{ sent: number; skipped: number; failed: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { sent: 0, skipped: 0, failed: 0 };

  const results = { sent: 0, skipped: 0, failed: 0 };

  for (const userId of request.recipientIds) {
    const skipReason = await shouldSkip(
      supabase,
      userId,
      request.type,
      request.payload,
      request.priority,
      request.referenceId
    );

    if (skipReason) {
      results.skipped++;
      await supabase.from("notification_log").insert({
        user_id: userId,
        type: request.type,
        channel: "push",
        title: request.payload.title,
        body: request.payload.body,
        reference_id: request.referenceId ?? null,
        skipped_reason: skipReason,
      });
      continue;
    }

    // 그룹 채팅 요약 알림: 5분 내 3건 이상이면 요약으로 교체
    const finalPayload = await maybeCondenseGroupChat(
      supabase,
      userId,
      request
    );

    const { sent, failed } = await sendPushToUser(userId, {
      title: finalPayload.title,
      body: finalPayload.body,
      url: finalPayload.url,
      tag: finalPayload.tag,
      icon: finalPayload.icon,
      type: request.type,
    });

    if (sent === 0 && failed === 0) {
      results.skipped++;
      await supabase.from("notification_log").insert({
        user_id: userId,
        type: request.type,
        channel: "push",
        title: request.payload.title,
        body: request.payload.body,
        reference_id: request.referenceId ?? null,
        skipped_reason: "no_subscription",
      });
    } else {
      results.sent += sent;
      results.failed += failed;
      await supabase.from("notification_log").insert({
        user_id: userId,
        type: request.type,
        channel: "push",
        title: request.payload.title,
        body: request.payload.body,
        reference_id: request.referenceId ?? null,
        delivered: sent > 0,
      });
    }
  }

  return results;
}

// ============================================
// 필터링 로직
// ============================================

async function shouldSkip(
  supabase: SupabaseAdminClient,
  userId: string,
  type: NotificationType,
  payload: { tag?: string },
  priority: string,
  referenceId?: string
): Promise<SkipReason | null> {
  // 1+2. 사용자 설정 + 방해금지 시간 (1회 쿼리)
  const prefField = NOTIFICATION_PREFERENCE_MAP[type];
  const selectFields = [
    "quiet_hours_enabled",
    "quiet_hours_start",
    "quiet_hours_end",
    ...(prefField ? [prefField] : []),
  ].join(", ");

  const { data: prefs } = (await supabase
    .from("student_notification_preferences")
    .select(selectFields)
    .eq("student_id", userId)
    .single()) as unknown as { data: Record<string, unknown> | null };

  // 1. 사용자 설정 확인
  if (prefField && prefs && prefs[prefField] === false) {
    return "preference_off";
  }

  // 2. 방해금지 시간 확인 (high 우선순위는 무시)
  if (priority !== "high" && prefs?.quiet_hours_enabled) {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (
      isInQuietHours(
        currentTime,
        (prefs.quiet_hours_start as string) ?? "",
        (prefs.quiet_hours_end as string) ?? ""
      )
    ) {
      return "quiet_hours";
    }
  }

  // 3. 채팅 뮤트 확인
  if (type === "chat_message" || type === "chat_group_message") {
    const roomId = payload.tag?.replace("chat-", "");
    if (roomId) {
      const { data: member } = await supabase
        .from("chat_room_members")
        .select("is_muted")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      if (member?.is_muted) return "muted";
    }
  }

  // 4. 중복 방지 (30초 내 동일 referenceId — 같은 메시지의 재전송만 차단)
  if (referenceId) {
    const { data: recent } = await supabase
      .from("notification_log")
      .select("id")
      .eq("user_id", userId)
      .eq("reference_id", referenceId)
      .is("skipped_reason", null)
      .gte("sent_at", new Date(Date.now() - 30_000).toISOString())
      .limit(1);

    if (recent?.length) return "duplicate";
  }

  // 5. 빈도 제한 (1시간 내 10건)
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", "push")
    .is("skipped_reason", null)
    .gte("sent_at", new Date(Date.now() - 3_600_000).toISOString());

  if ((count ?? 0) >= 10) return "rate_limited";

  // 6. 앱 활성 상태 확인 (active + heartbeat 이내 → Push 스킵)
  // 채팅 메시지는 online 필터를 건너뜀:
  //  - 채팅방 안에 있으면 realtime으로 이미 수신 (push tag 중복 처리)
  //  - 다른 페이지에 있으면 push가 유일한 알림 수단
  //  - 앱을 닫으면 heartbeat 중단되므로 자연스럽게 통과
  if (type !== "chat_message" && type !== "chat_group_message") {
    // user_presence 테이블은 database.types.ts에 아직 미포함 (마이그레이션 후 재생성 필요)
    const { data: presence, error: presenceError } = (await supabase
      .from("user_presence" as "push_subscriptions")
      .select("status, updated_at")
      .eq("user_id", userId)
      .single()) as unknown as {
      data: { status: string; updated_at: string } | null;
      error: { code: string; message: string } | null;
    };

    // 쿼리 실패 시 알림을 차단하지 않음 (안전 방향: 발송)
    if (presenceError && presenceError.code !== "PGRST116") {
      console.warn("[Router] Presence query failed:", presenceError.code);
      return null;
    }

    if (
      presence?.status === "active" &&
      presence.updated_at &&
      Date.now() - new Date(presence.updated_at).getTime() <
        PRESENCE_STALE_THRESHOLD
    ) {
      return "online";
    }
  }

  return null;
}

function isInQuietHours(
  current: string,
  start: string,
  end: string
): boolean {
  if (start <= end) {
    return current >= start && current <= end;
  }
  // 자정을 넘는 경우 (예: 23:00 ~ 07:00)
  return current >= start || current <= end;
}

// ============================================
// 그룹 채팅 요약 알림
// ============================================

/**
 * 그룹 채팅에서 5분 내 3건 이상 발송되었으면 요약 알림으로 교체.
 * 개별 알림 대신 "N개의 새 메시지" 형태로 표시합니다.
 */
async function maybeCondenseGroupChat(
  supabase: SupabaseAdminClient,
  userId: string,
  request: NotificationRequest
): Promise<NotificationRequest["payload"]> {
  if (request.type !== "chat_group_message") {
    return request.payload;
  }

  // referenceId 형식: "{roomId}:{messageId}"
  const roomId = request.referenceId?.split(":")[0];
  if (!roomId) return request.payload;

  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "chat_group_message")
    .like("reference_id", `${roomId}:%`)
    .is("skipped_reason", null)
    .gte(
      "sent_at",
      new Date(Date.now() - GROUP_SUMMARY_WINDOW).toISOString()
    );

  if ((count ?? 0) >= GROUP_SUMMARY_THRESHOLD) {
    return {
      ...request.payload,
      body: `${(count ?? 0) + 1}개의 새 메시지`,
    };
  }

  return request.payload;
}
