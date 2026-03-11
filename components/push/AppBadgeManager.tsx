"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useAppBadge } from "@/lib/domains/push/hooks/useAppBadge";

/**
 * 앱 아이콘 뱃지를 통합 관리하는 래퍼.
 * 채팅 + 알림 미읽은 수를 합산하여 navigator.setAppBadge()로 반영.
 * UI를 렌더링하지 않음. 레이아웃에 한 번만 마운트.
 */
export function AppBadgeManager() {
  const { user } = useAuth();
  useAppBadge(user?.userId ?? null);
  return null;
}
