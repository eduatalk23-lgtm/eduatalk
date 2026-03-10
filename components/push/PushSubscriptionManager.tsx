"use client";

import { usePushSubscription } from "@/lib/domains/push/hooks/usePushSubscription";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * 로그인 사용자의 Push 구독을 자동 관리하는 래퍼.
 * UI를 렌더링하지 않음. 레이아웃에 한 번만 마운트.
 *
 * AuthContext에서 userId를 가져와 별도 supabase.auth.getUser() 호출 제거.
 */
export function PushSubscriptionManager() {
  const { user } = useAuth();
  usePushSubscription(user?.userId ?? null);
  return null;
}
