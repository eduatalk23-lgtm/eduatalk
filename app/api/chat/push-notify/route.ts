/**
 * Chat Push Notification Webhook
 *
 * Called by DB trigger (pg_net) after chat_messages INSERT.
 * Handles push notification routing for new messages.
 * Auth: CRON_SECRET Bearer token (same as scheduled messages).
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { routeNotification } from "@/lib/domains/notification/router";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PushNotifyPayload {
  message_id: string;
  room_id: string;
  sender_id: string;
  sender_name: string | null;
  content: string;
  message_type: string;
  created_at: string;
  metadata: { mentions?: Array<{ userId: string }> } | null;
}

function validateApiKey(request: NextRequest): boolean {
  const apiKey = request.headers.get("authorization")?.replace("Bearer ", "");
  const expectedApiKey = process.env.CRON_SECRET;

  if (!expectedApiKey || !apiKey) return false;

  try {
    const bufA = Buffer.from(apiKey);
    const bufB = Buffer.from(expectedApiKey);
    if (bufA.length !== bufB.length) {
      const randomBuf = randomBytes(bufA.length);
      timingSafeEqual(bufA, randomBuf);
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!validateApiKey(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as PushNotifyPayload;
    const { message_id, room_id, sender_id, sender_name, content, created_at, metadata } = payload;

    if (!room_id || !sender_id) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: "Admin client unavailable" }, { status: 500 });
    }

    // 1. Get room info (type, name)
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("type, name")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ ok: true, skipped: "room_not_found" });
    }

    // 2. Get active members (excluding sender, not left)
    const { data: members } = await supabase
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", room_id)
      .neq("user_id", sender_id)
      .is("left_at", null);

    const recipientIds = members?.map((m) => m.user_id) ?? [];
    if (recipientIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no_recipients" });
    }

    // 3. Build notification content
    const isDirect = room.type === "direct";
    const senderDisplay = sender_name ?? "새 메시지";
    const title = isDirect ? senderDisplay : (room.name ?? "그룹 채팅");
    const body = isDirect
      ? content.slice(0, 100)
      : `${senderDisplay}: ${content.slice(0, 100)}`;

    // 4. Separate mentioned users (bypass mute)
    const mentionedUserIds = new Set(
      (metadata?.mentions ?? [])
        .map((m) => m.userId)
        .filter((id) => id !== sender_id && recipientIds.includes(id))
    );

    const normalRecipientIds = recipientIds.filter((id) => !mentionedUserIds.has(id));

    // 5. Send normal notifications
    if (normalRecipientIds.length > 0) {
      await routeNotification({
        type: isDirect ? "chat_message" : "chat_group_message",
        recipientIds: normalRecipientIds,
        payload: {
          title,
          body,
          url: `/chat/${room_id}`,
          tag: `chat-${room_id}`,
        },
        priority: "normal",
        source: "db_trigger",
        referenceId: `${room_id}:${message_id}`,
        messageCreatedAt: created_at,
      });
    }

    // 6. Send mention notifications (bypass mute, high priority)
    if (mentionedUserIds.size > 0) {
      await routeNotification({
        type: "chat_mention",
        recipientIds: Array.from(mentionedUserIds),
        payload: {
          title: isDirect ? senderDisplay : (room.name ?? "그룹 채팅"),
          body: `${senderDisplay}님이 회원님을 언급했습니다: ${content.slice(0, 80)}`,
          url: `/chat/${room_id}`,
          tag: `chat-mention-${room_id}`,
        },
        priority: "high",
        source: "db_trigger",
        referenceId: `${room_id}:${message_id}:mention`,
        messageCreatedAt: created_at,
      });
    }

    return NextResponse.json({ ok: true, recipients: recipientIds.length });
  } catch (error) {
    console.error("[push-notify] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
