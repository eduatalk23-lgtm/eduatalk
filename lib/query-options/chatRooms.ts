import { queryOptions } from "@tanstack/react-query";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ChatRoomListItem } from "@/lib/domains/chat/types";

/**
 * 채팅방 목록 query 옵션 (클라이언트 전용)
 *
 * 브라우저 클라이언트에서 RPC를 직접 호출합니다.
 * Server Action + getUser() 호출 없이 JWT 쿠키로 인증.
 *
 * 서버 prefetch는 각 page.tsx에서 getChatRoomsAction()을 사용합니다.
 * queryKey가 동일하므로 hydration이 올바르게 작동합니다.
 *
 * @param userId - 전달 시 auth 가드 적용 (!!userId일 때만 enabled)
 *                 미전달 시 기존 동작 유지 (항상 enabled)
 */
export function chatRoomsQueryOptions(userId?: string) {
  return queryOptions({
    queryKey: chatKeys.rooms(),
    queryFn: async (): Promise<ChatRoomListItem[]> => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_chat_rooms_for_user");
      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[chatRoomsQueryOptions] RPC failed:", error.message);
        }
        throw new Error(error.message);
      }
      return (data ?? []) as ChatRoomListItem[];
    },
    staleTime: 2 * 60 * 1000, // 2분 (Realtime이 업데이트 담당, 목록은 자주 변경되지 않음)
    refetchOnWindowFocus: false, // Realtime이 freshness 관리
    ...(userId !== undefined ? { enabled: !!userId } : {}),
  });
}
