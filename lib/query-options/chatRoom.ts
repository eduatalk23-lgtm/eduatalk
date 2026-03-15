import { queryOptions } from "@tanstack/react-query";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  ChatRoom,
  ChatRoomMemberWithUser,
  PinnedMessageWithContent,
  AnnouncementInfo,
} from "@/lib/domains/chat/types";

/**
 * 채팅방 상세 정보 query 옵션 (클라이언트 전용)
 *
 * 브라우저 클라이언트에서 RPC를 직접 호출합니다.
 * Server Action + getUser() 호출 없이 JWT 쿠키로 인증.
 *
 * 서버 prefetch는 각 page.tsx에서 getChatRoomDetailAction()을 사용합니다.
 * queryKey가 동일하므로 hydration이 올바르게 작동합니다.
 */
export function chatRoomDetailQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.room(roomId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_chat_room_detail", {
        p_room_id: roomId,
      });
      if (error) throw new Error(error.message);
      if (!data) throw new Error("채팅방 정보가 없습니다");
      return data as { room: ChatRoom; members: ChatRoomMemberWithUser[]; otherMemberLeft: boolean };
    },
    staleTime: 5 * 60 * 1000, // 5분 (Realtime이 변경사항 관리, 기존 1분 → 5분)
  });
}

/**
 * 고정 메시지 목록 query 옵션 (Browser RPC)
 */
export function chatPinnedQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.pinned(roomId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_pinned_messages", {
        p_room_id: roomId,
      });
      if (error) return [];
      return (data ?? []) as PinnedMessageWithContent[];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 공지 query 옵션 (Browser RPC)
 */
export function chatAnnouncementQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.announcement(roomId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_chat_announcement", {
        p_room_id: roomId,
      });
      if (error) return null;
      return data as AnnouncementInfo | null;
    },
    staleTime: 60 * 1000,
  });
}

/**
 * 고정/공지 권한 query 옵션 (Browser RPC — 1 call로 canPin + canSetAnnouncement)
 * 세션 내 권한은 거의 변경되지 않으므로 staleTime 5분
 */
export function chatPermissionsQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: ["chat-permissions", roomId] as const,
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("check_chat_permissions", {
        p_room_id: roomId,
      });
      if (error) return { canPin: false, canSetAnnouncement: false };
      return (data ?? { canPin: false, canSetAnnouncement: false }) as {
        canPin: boolean;
        canSetAnnouncement: boolean;
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * @deprecated canPin + canSetAnnouncement은 chatPermissionsQueryOptions로 통합됨.
 * 기존 코드 호환을 위해 유지하나, chatPermissionsQueryOptions 사용 권장.
 */
export function chatCanPinQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.canPin(roomId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("check_chat_permissions", {
        p_room_id: roomId,
      });
      if (error) return { canPin: false };
      return { canPin: (data as { canPin: boolean })?.canPin ?? false };
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * @deprecated canPin + canSetAnnouncement은 chatPermissionsQueryOptions로 통합됨.
 * 기존 코드 호환을 위해 유지하나, chatPermissionsQueryOptions 사용 권장.
 */
export function chatCanSetAnnouncementQueryOptions(roomId: string) {
  return queryOptions({
    queryKey: chatKeys.canSetAnnouncement(roomId),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("check_chat_permissions", {
        p_room_id: roomId,
      });
      if (error) return { canSet: false };
      return { canSet: (data as { canSetAnnouncement: boolean })?.canSetAnnouncement ?? false };
    },
    staleTime: 5 * 60 * 1000,
  });
}
