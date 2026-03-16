"use server";

import webpush from "web-push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { ensureVapidConfigured } from "../vapid";

type PushUrgency = "very-low" | "low" | "normal" | "high";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  type?: string;
  notificationLogId?: string;
  /** 이벤트 발생 시각 (알림에 "N분 전" 표시용) */
  timestamp?: number;
  /** Web Push urgency (기본: normal). high=즉시 전달, low=배터리 절약 */
  urgency?: PushUrgency;
  /** 서버에서 이미 요약된 알림인지 (SW per-tag 카운트 스킵용) */
  condensed?: boolean;
  /** 사용자가 소리+진동을 모두 OFF한 경우 true → SW에서 silent 알림 표시 */
  silent?: boolean;
  /** 서버 기준 해당 채팅방의 미읽은 메시지 수 (SW 로컬 카운트 교정용) */
  unreadCount?: number;
}

/** 이 상태 코드를 받으면 구독이 만료/무효이므로 비활성화 */
const STALE_SUBSCRIPTION_CODES = [400, 404, 410, 413];

/** 재시도 대상 상태 코드 (429 Rate Limit, 5xx 서버 에러) */
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503];

/** 최대 재시도 횟수 */
const MAX_RETRIES = 3;

/** Web Push 페이로드 최대 크기 (바이트) */
const MAX_PAYLOAD_BYTES = 4096;

/**
 * 알림 tag → Web Push topic 헤더 변환.
 * 오프라인 시 같은 topic의 메시지는 최신 1개만 전달 (RFC 8030 §5.4).
 * topic은 URL-safe Base64, 최대 32자.
 */
function tagToTopic(tag: string | undefined): string | undefined {
  if (!tag) return undefined;

  // chat tag: "chat-{roomId}" or "chat-mention-{roomId}"
  const chatMatch = tag.match(/^chat-(?:mention-)?(.+)$/);
  if (chatMatch) {
    const roomId = chatMatch[1];
    // UUID → hex → base64url (32 hex = 16 bytes = 22 base64 chars)
    const clean = roomId.replace(/-/g, "");
    if (/^[0-9a-f]{32}$/i.test(clean)) {
      return Buffer.from(clean, "hex").toString("base64url").slice(0, 32);
    }
  }

  // 기타 tag: UTF-8 → base64url, 32자 제한
  return Buffer.from(tag).toString("base64url").slice(0, 32);
}

/**
 * 특정 사용자의 모든 활성 디바이스에 Push 발송.
 * 410 Gone / 404 응답 시 해당 구독을 자동 비활성화.
 * 429 / 5xx 시 Exponential Backoff 재시도 (최대 3회).
 * 최종 실패 시 DLQ(push_dlq)에 저장.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0 };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) return { sent: 0, failed: 0 };

  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, subscription")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!subscriptions?.length) return { sent: 0, failed: 0 };

  // urgency는 Web Push 헤더에만 사용 → payload에서 제거하여 4KB 절약
  const { urgency: _urgency, ...payloadWithoutUrgency } = payload;

  // 페이로드 4KB 제한 검증 (Web Push 표준)
  let payloadStr = JSON.stringify(payloadWithoutUrgency);
  if (new TextEncoder().encode(payloadStr).byteLength > MAX_PAYLOAD_BYTES) {
    const truncatedPayload = {
      ...payloadWithoutUrgency,
      body: payload.body.slice(0, 200) + "…",
    };
    payloadStr = JSON.stringify(truncatedPayload);
    if (new TextEncoder().encode(payloadStr).byteLength > MAX_PAYLOAD_BYTES) {
      console.warn("[Push] Payload exceeds 4KB even after truncation");
      return { sent: 0, failed: 0 };
    }
  }

  let sent = 0;
  let failed = 0;

  const urgency = payload.urgency ?? "normal";
  const ttl = urgency === "high" ? 86400 : urgency === "low" ? 43200 : 86400;
  const topic = tagToTopic(payload.tag);

  const results = await Promise.allSettled(
    subscriptions.map((row) =>
      sendWithRetry(row, payloadStr, urgency, ttl, topic)
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      const err = result.reason;

      if (STALE_SUBSCRIPTION_CODES.includes(err?.statusCode)) {
        // 구독 만료/무효 → 비활성화
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("id", subscriptions[i].id);
      } else {
        // 재시도 실패 포함 → DLQ에 저장
        await supabase.from("push_dlq").insert({
          user_id: userId,
          subscription_id: subscriptions[i].id,
          payload: payload as unknown as Json,
          error_code: err?.statusCode ?? null,
          error_message: err?.message?.slice(0, 500) ?? "Unknown error",
          retry_count: MAX_RETRIES,
        }).then(null, (dlqErr: unknown) => {
          // DLQ insert 실패해도 발송 로직 차단 안 함
          console.error("[Push] DLQ insert failed:", dlqErr);
        });

        console.warn("[Push] Final send failure after retries:", {
          subscriptionId: subscriptions[i].id,
          statusCode: err?.statusCode,
          message: err?.message,
        });
      }
    }
  }

  return { sent, failed };
}

/**
 * 단일 구독에 Push 발송 + Exponential Backoff 재시도.
 * 429/5xx 에러 시 최대 MAX_RETRIES까지 재시도.
 */
async function sendWithRetry(
  row: { id: string; subscription: unknown },
  payloadStr: string,
  urgency: PushUrgency = "normal",
  ttl = 86400,
  topic?: string,
  attempt = 0
): Promise<webpush.SendResult> {
  try {
    return await webpush.sendNotification(
      row.subscription as unknown as webpush.PushSubscription,
      payloadStr,
      { TTL: ttl, urgency, ...(topic ? { topic } : {}) }
    );
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;

    // 재시도 불가능한 에러 (stale subscription 등) → 즉시 throw
    if (!statusCode || !RETRYABLE_STATUS_CODES.includes(statusCode)) {
      throw err;
    }

    // 최대 재시도 초과 → throw
    if (attempt >= MAX_RETRIES) {
      throw err;
    }

    // Exponential backoff: 1초, 2초, 4초 + jitter
    const baseDelay = Math.pow(2, attempt) * 1000;
    const jitter = Math.random() * 500;
    await sleep(baseDelay + jitter);

    return sendWithRetry(row, payloadStr, urgency, ttl, topic, attempt + 1);
  }
}

/** 동시 발송 제한 (Push 서비스 429 방지) */
const BATCH_CONCURRENCY = 5;

/**
 * 여러 사용자에게 동일 Push를 Batch 발송.
 * 동시 발송 수를 BATCH_CONCURRENCY로 제한하여
 * Push 서비스 Rate Limit(429)을 방지합니다.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!userIds.length) return { sent: 0, failed: 0, skipped: 0 };

  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  // 동시성 제한: BATCH_CONCURRENCY명씩 처리
  for (let i = 0; i < userIds.length; i += BATCH_CONCURRENCY) {
    const batch = userIds.slice(i, i + BATCH_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map((userId) => sendPushToUser(userId, payload))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        totalSent += result.value.sent;
        totalFailed += result.value.failed;
        if (result.value.sent === 0 && result.value.failed === 0) {
          totalSkipped++;
        }
      } else {
        totalFailed++;
      }
    }
  }

  return { sent: totalSent, failed: totalFailed, skipped: totalSkipped };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
