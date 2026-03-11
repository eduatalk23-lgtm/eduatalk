"use server";

import {
  createSupabaseAdminClient,
  type SupabaseAdminClient,
} from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/domains/push/actions/send";
import {
  type NotificationType,
  type NotificationPriority,
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
    const { skipReason, silent } = await checkUserPreferences(
      supabase,
      userId,
      request.type,
      request.payload,
      request.priority,
      request.referenceId,
      request.messageCreatedAt
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
    const { payload: finalPayload, condensed } =
      await maybeCondenseGroupChat(supabase, userId, request);

    // 먼저 로그를 insert하여 id를 확보 → push payload에 포함 (클릭 추적용)
    const { data: logRow } = await supabase
      .from("notification_log")
      .insert({
        user_id: userId,
        type: request.type,
        channel: "push",
        title: request.payload.title,
        body: request.payload.body,
        reference_id: request.referenceId ?? null,
      })
      .select("id")
      .single();

    const { sent, failed } = await sendPushToUser(userId, {
      title: finalPayload.title,
      body: finalPayload.body,
      url: finalPayload.url,
      tag: finalPayload.tag,
      icon: finalPayload.icon,
      type: request.type,
      notificationLogId: logRow?.id,
      timestamp: request.messageCreatedAt
        ? new Date(request.messageCreatedAt).getTime()
        : Date.now(),
      urgency: mapPriorityToUrgency(request.priority, request.type),
      condensed,
      silent,
    });

    if (sent === 0 && failed === 0) {
      results.skipped++;
      if (logRow?.id) {
        await supabase
          .from("notification_log")
          .update({ skipped_reason: "no_subscription" })
          .eq("id", logRow.id);
      }
    } else {
      results.sent += sent;
      results.failed += failed;
      if (logRow?.id) {
        await supabase
          .from("notification_log")
          .update({ delivered: sent > 0 })
          .eq("id", logRow.id);
      }
    }
  }

  return results;
}

// ============================================
// 필터링 로직
// ============================================

interface PreferenceResult {
  skipReason: SkipReason | null;
  /** 사용자가 소리+진동을 모두 OFF한 경우 true → SW에서 silent 알림 표시 */
  silent: boolean;
}

async function checkUserPreferences(
  supabase: SupabaseAdminClient,
  userId: string,
  type: NotificationType,
  payload: { tag?: string },
  priority: string,
  referenceId?: string,
  messageCreatedAt?: string
): Promise<PreferenceResult> {
  // 1+2. 사용자 설정 + 방해금지 + 소리/진동 설정 (1회 쿼리)
  const prefField = NOTIFICATION_PREFERENCE_MAP[type];
  const selectFields = [
    "quiet_hours_enabled",
    "quiet_hours_start",
    "quiet_hours_end",
    "chat_sound_enabled",
    "chat_vibrate_enabled",
    ...(prefField ? [prefField] : []),
  ].join(", ");

  const { data: prefs } = (await supabase
    .from("student_notification_preferences")
    .select(selectFields)
    .eq("student_id", userId)
    .single()) as unknown as { data: Record<string, unknown> | null };

  // 1. 사용자 설정 확인
  if (prefField && prefs && prefs[prefField] === false) {
    return { skipReason: "preference_off", silent: false };
  }

  // 2. 방해금지 시간 확인 (high 우선순위는 무시)
  if (priority !== "high" && prefs?.quiet_hours_enabled) {
    // KST 기준으로 현재 시간 계산 (Vercel 서버는 UTC)
    const now = new Date();
    const kstOffset = 9 * 60; // KST = UTC+9
    const kstMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + kstOffset;
    const adjustedMinutes = ((kstMinutes % 1440) + 1440) % 1440; // 0~1439 범위
    const currentTime = `${String(Math.floor(adjustedMinutes / 60)).padStart(2, "0")}:${String(adjustedMinutes % 60).padStart(2, "0")}`;
    if (
      isInQuietHours(
        currentTime,
        (prefs.quiet_hours_start as string) ?? "",
        (prefs.quiet_hours_end as string) ?? ""
      )
    ) {
      return { skipReason: "quiet_hours", silent: false };
    }
  }

  // 소리/진동 설정 → silent 플래그 (채팅 타입에만 적용)
  const isChatType = type === "chat_message" || type === "chat_group_message" || type === "chat_mention";
  const silent = isChatType
    ? prefs?.chat_sound_enabled === false && prefs?.chat_vibrate_enabled === false
    : false;

  // 3. 채팅 뮤트 + 이미 읽음 확인 (1회 쿼리)
  if (isChatType) {
    // tag에서 roomId 추출 ("chat-{roomId}" 또는 "chat-mention-{roomId}")
    const roomId = payload.tag?.replace(/^chat-(?:mention-)?/, "");
    if (roomId) {
      const { data: member } = await supabase
        .from("chat_room_members")
        .select("is_muted, last_read_at")
        .eq("room_id", roomId)
        .eq("user_id", userId)
        .single();

      // 뮤트 체크: chat_mention은 뮤트 무시 (카카오톡/Slack 표준)
      if (type !== "chat_mention" && member?.is_muted) return { skipReason: "muted", silent: false };

      // 이미 읽은 메시지면 push 스킵
      // (Realtime으로 화면에서 먼저 본 경우 last_read_at가 업데이트됨)
      if (
        messageCreatedAt &&
        member?.last_read_at &&
        new Date(member.last_read_at) >= new Date(messageCreatedAt)
      ) {
        return { skipReason: "already_read", silent: false };
      }
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

    if (recent?.length) return { skipReason: "duplicate", silent: false };
  }

  // 5. 빈도 제한 (1시간 내 10건)
  const { count } = await supabase
    .from("notification_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("channel", "push")
    .is("skipped_reason", null)
    .gte("sent_at", new Date(Date.now() - 3_600_000).toISOString());

  if ((count ?? 0) >= 10) return { skipReason: "rate_limited", silent: false };

  // 6. 앱 활성 상태 확인
  const { data: presence, error: presenceError } = await supabase
    .from("user_presence")
    .select("status, updated_at, current_chat_room_id")
    .eq("user_id", userId)
    .single();

  // 쿼리 실패 시 알림을 차단하지 않음 (안전 방향: 발송)
  if (presenceError && presenceError.code !== "PGRST116") {
    console.warn("[Router] Presence query failed:", presenceError.code);
    return { skipReason: null, silent };
  }

  const isActive =
    presence?.status === "active" &&
    presence.updated_at &&
    Date.now() - new Date(presence.updated_at).getTime() < PRESENCE_STALE_THRESHOLD;

  if (isActive) {
    if (isChatType) {
      // 채팅 알림: 해당 채팅방을 보고 있으면 스킵, 다른 페이지면 발송
      const roomId = payload.tag?.replace(/^chat-(?:mention-)?/, "");
      if (roomId && presence.current_chat_room_id === roomId) {
        return { skipReason: "viewing_room", silent: false };
      }
      // 다른 페이지에 있으면 push 발송 (return null → 계속 진행)
    } else {
      // 비채팅 알림: 앱 활성이면 push 스킵
      return { skipReason: "online", silent: false };
    }
  }

  return { skipReason: null, silent };
}

/**
 * 알림 우선순위 + 타입 → Web Push urgency 매핑.
 * high: 즉시 전달 (멘션, 긴급 알림)
 * normal: 일반 전달 (채팅, 플랜 업데이트)
 * low: 배터리 절약 (리마인더, 성과, 주간 요약)
 */
function mapPriorityToUrgency(
  priority: NotificationPriority,
  type: NotificationType
): "very-low" | "low" | "normal" | "high" {
  if (priority === "high") return "high";

  // 타입별 세분화
  switch (type) {
    case "chat_mention":
      return "high";
    case "chat_message":
    case "chat_group_message":
    case "plan_created":
    case "plan_updated":
    case "plan_overdue":
    case "admin_notification":
    case "camp_invitation":
    case "attendance":
    case "system":
      return "normal";
    case "study_reminder":
    case "event_reminder":
    case "camp_reminder":
    case "consultation_reminder":
    case "payment_reminder":
    case "plan_delayed_warning":
    case "plan_incomplete_reminder":
    case "achievement":
    case "learning_milestone":
    case "daily_goal_complete":
    case "study_streak":
    case "weekly_plan_summary":
    case "camp_status_change":
      return "low";
    default:
      return priority === "low" ? "low" : "normal";
  }
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
): Promise<{ payload: NotificationRequest["payload"]; condensed: boolean }> {
  if (request.type !== "chat_group_message") {
    return { payload: request.payload, condensed: false };
  }

  // referenceId 형식: "{roomId}:{messageId}"
  const roomId = request.referenceId?.split(":")[0];
  if (!roomId) return { payload: request.payload, condensed: false };

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
      payload: {
        ...request.payload,
        body: `${(count ?? 0) + 1}개의 새 메시지`,
      },
      condensed: true,
    };
  }

  return { payload: request.payload, condensed: false };
}
