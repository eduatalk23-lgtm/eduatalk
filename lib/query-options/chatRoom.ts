import { queryOptions } from "@tanstack/react-query";
import {
  getChatRoomDetailAction,
  getPinnedMessagesAction,
  getAnnouncementAction,
  canPinMessagesAction,
  canSetAnnouncementAction,
} from "@/lib/domains/chat/actions";
import { chatKeys } from "@/lib/domains/chat/queryKeys";

/**
 * 채팅방 상세 정보 query 옵션
 *
 * 서버 컴포넌트에서 prefetchQuery로 프리패칭하고,
 * 클라이언트 컴포넌트에서 useQuery로 사용합니다.
 */
export function chatRoomDetailQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.room(roomId),
    queryFn: async () => {
      const result = await getChatRoomDetailAction(roomId);
      if (!result.success) throw new Error(result.error ?? "채팅방 정보 조회 실패");
      return result.data;
    },
    staleTime: 60 * 1000, // 방 정보는 자주 변경되지 않음
  });
}

/**
 * 고정 메시지 목록 query 옵션
 */
export function chatPinnedQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.pinned(roomId),
    queryFn: async () => {
      const result = await getPinnedMessagesAction(roomId);
      if (!result.success) return [];
      return result.data ?? [];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 공지 query 옵션
 */
export function chatAnnouncementQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.announcement(roomId),
    queryFn: async () => {
      const result = await getAnnouncementAction(roomId);
      if (!result.success) return null;
      return result.data;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 고정 권한 query 옵션
 * 세션 내 권한은 거의 변경되지 않으므로 staleTime 5분
 */
export function chatCanPinQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.canPin(roomId),
    queryFn: async () => {
      const result = await canPinMessagesAction(roomId);
      if (!result.success) return { canPin: false };
      return result.data ?? { canPin: false };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 공지 설정 권한 query 옵션
 * 세션 내 권한은 거의 변경되지 않으므로 staleTime 5분
 */
export function chatCanSetAnnouncementQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.canSetAnnouncement(roomId),
    queryFn: async () => {
      const result = await canSetAnnouncementAction(roomId);
      if (!result.success) return { canSet: false };
      return result.data ?? { canSet: false };
    },
    staleTime: 5 * 60 * 1000,
  });
}
