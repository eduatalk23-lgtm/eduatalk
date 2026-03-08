import { queryOptions } from "@tanstack/react-query";
import {
  getChatRoomDetailAction,
  getPinnedMessagesAction,
  getAnnouncementAction,
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
  });
}
