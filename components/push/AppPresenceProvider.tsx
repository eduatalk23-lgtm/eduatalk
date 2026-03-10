"use client";

import { useAppPresence } from "@/lib/realtime/useAppPresence";
import { useAuth } from "@/lib/contexts/AuthContext";

/**
 * 사용자 Presence를 추적하는 레이아웃 래퍼.
 * UI 렌더링 없음. 레이아웃에 한 번만 마운트.
 *
 * AuthContext에서 userId를 가져와 별도 supabase.auth.getUser() 호출 제거.
 */
export function AppPresenceProvider() {
  const { user } = useAuth();
  useAppPresence(user?.userId ?? null);
  return null;
}
