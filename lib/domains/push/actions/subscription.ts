"use server";

import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export type PushSubscriptionData = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * Push 구독을 서버에 저장합니다.
 * 동일 endpoint가 있으면 갱신 (UPSERT).
 */
export async function subscribePush(
  subscription: PushSubscriptionData,
  deviceLabel?: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "로그인이 필요합니다." };

  // endpoint 기본 검증
  if (
    !subscription.endpoint ||
    !subscription.endpoint.startsWith("https://") ||
    !subscription.keys.p256dh ||
    !subscription.keys.auth
  ) {
    return { success: false, error: "유효하지 않은 구독 데이터입니다." };
  }

  const label = deviceLabel ?? (await detectDeviceLabel());
  const supabase = await createSupabaseServerClient();

  const now = new Date().toISOString();

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.userId,
      endpoint: subscription.endpoint,
      keys_p256dh: subscription.keys.p256dh,
      keys_auth: subscription.keys.auth,
      subscription: subscription as unknown as Record<string, unknown>,
      device_label: label,
      is_active: true,
      updated_at: now,
    },
    { onConflict: "user_id,endpoint" }
  );

  if (error) {
    console.error("[Push] Subscribe failed:", error);
    return { success: false, error: "구독 저장에 실패했습니다." };
  }

  // 같은 유저+디바이스의 이전 구독 비활성화 (SW 재등록 시 endpoint 변경 대응)
  await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: now })
    .eq("user_id", user.userId)
    .eq("device_label", label)
    .eq("is_active", true)
    .neq("endpoint", subscription.endpoint);

  return { success: true };
}

/**
 * Push 구독을 비활성화합니다.
 */
export async function unsubscribePush(
  endpoint: string
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("user_id", user.userId)
    .eq("endpoint", endpoint);

  return { success: true };
}

// ============================================
// 디바이스 관리 (설정 UI용)
// ============================================

export type PushDevice = {
  id: string;
  device_label: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 사용자의 활성 Push 구독 디바이스 목록을 조회합니다.
 */
export async function getPushDevices(): Promise<{
  success: boolean;
  devices: PushDevice[];
}> {
  const user = await getCurrentUser();
  if (!user) return { success: false, devices: [] };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, device_label, created_at, updated_at")
    .eq("user_id", user.userId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Push] getPushDevices failed:", error);
    return { success: false, devices: [] };
  }

  return { success: true, devices: data ?? [] };
}

/**
 * Push 구독 디바이스를 비활성화합니다 (설정 UI에서 삭제).
 */
export async function deletePushDevice(
  deviceId: string
): Promise<{ success: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", deviceId)
    .eq("user_id", user.userId); // 본인 디바이스만 삭제 가능

  if (error) {
    console.error("[Push] deletePushDevice failed:", error);
    return { success: false };
  }

  return { success: true };
}

async function detectDeviceLabel(): Promise<string> {
  try {
    const headersList = await headers();
    const ua = headersList.get("user-agent") ?? "";
    if (/iPhone|iPad/.test(ua)) return "iOS Safari";
    if (/Android/.test(ua)) return "Android Chrome";
    if (/Mac/.test(ua)) return "macOS Desktop";
    if (/Windows/.test(ua)) return "Windows Desktop";
    if (/Linux/.test(ua)) return "Linux Desktop";
  } catch {
    // headers() 사용 불가 환경
  }
  return "Unknown Device";
}
