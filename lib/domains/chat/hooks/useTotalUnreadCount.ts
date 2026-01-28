"use client";

/**
 * useTotalUnreadCount - 전체 읽지 않은 메시지 수 훅
 *
 * chatRoomsQueryOptions 캐시에서 전체 unread count를 합산합니다.
 * 별도 API 호출 없이 기존 캐시를 재사용합니다.
 */

import { useQuery } from "@tanstack/react-query";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";

export function useTotalUnreadCount(): number {
  const { data: rooms } = useQuery(chatRoomsQueryOptions());

  if (!rooms || rooms.length === 0) return 0;

  return rooms.reduce((total, room) => total + (room.unreadCount ?? 0), 0);
}
