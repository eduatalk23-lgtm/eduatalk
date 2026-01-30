"use client";

/**
 * useTotalUnreadCount - 전체 읽지 않은 메시지 수 훅
 *
 * chatRoomsQueryOptions 캐시에서 전체 unread count를 합산합니다.
 * 별도 API 호출 없이 기존 캐시를 재사용합니다.
 */

import { useQuery } from "@tanstack/react-query";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";

interface UseTotalUnreadCountOptions {
  /** 인증된 상태에서만 쿼리 실행 (기본값: true) */
  enabled?: boolean;
}

export function useTotalUnreadCount(
  options: UseTotalUnreadCountOptions = {}
): number {
  const { enabled = true } = options;

  const { data: rooms } = useQuery({
    ...chatRoomsQueryOptions(),
    enabled,
  });

  if (!rooms || rooms.length === 0) return 0;

  return rooms.reduce((total, room) => total + (room.unreadCount ?? 0), 0);
}
