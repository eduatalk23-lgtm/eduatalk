import { infiniteQueryOptions } from "@tanstack/react-query";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MessagesWithReadStatusResult } from "@/lib/domains/chat/types";

/**
 * 양방향 페이지네이션 파라미터
 *
 * - undefined: 최신 메시지 로드 (기본 모드)
 * - { before }: 과거 메시지 로드 (스크롤 위로)
 * - { after }:  최신 메시지 로드 (스크롤 아래로, 양방향 모드)
 * - { around }: 특정 시점 기준 양방향 로드 (unread divider 모드)
 */
type ChatPageParam =
  | undefined
  | { before: string }
  | { after: string }
  | { around: string };

const PAGE_SIZE = 50;

/**
 * 채팅 메시지 infiniteQuery 옵션 (클라이언트 전용)
 *
 * 브라우저 클라이언트에서 RPC를 직접 호출합니다.
 * Server Action + getUser() 호출 없이 JWT 쿠키로 인증.
 *
 * 서버 prefetch는 각 page.tsx에서 Server Action을 사용합니다.
 * queryKey가 동일하므로 hydration이 올바르게 작동합니다.
 *
 * @param roomId 채팅방 ID
 * @param lastReadAt unread divider 기준 타임스탬프 (양방향 모드 활성화)
 */
export function chatMessagesQueryOptions(roomId: string, lastReadAt?: string) {
  return infiniteQueryOptions({
    queryKey: chatKeys.messages(roomId),
    queryFn: async ({ pageParam }: { pageParam: ChatPageParam }) => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase.rpc("get_chat_messages_page", {
        p_room_id: roomId,
        p_limit: PAGE_SIZE,
        p_before: pageParam && "before" in pageParam ? pageParam.before : null,
        p_after: pageParam && "after" in pageParam ? pageParam.after : null,
        p_around: pageParam && "around" in pageParam ? pageParam.around : null,
      });

      if (error) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[chatMessagesQueryOptions] RPC failed - roomId: ${roomId}, pageParam:`,
            pageParam,
            `error: ${error.message}`
          );
        }
        throw new Error(error.message);
      }

      return (data ?? {
        messages: [],
        readCounts: {},
        hasMore: false,
        hasNewer: false,
      }) as MessagesWithReadStatusResult;
    },
    // 양방향 모드: lastReadAt가 있으면 around로 시작
    initialPageParam: (lastReadAt
      ? { around: lastReadAt }
      : undefined) as ChatPageParam,
    // 역방향 (과거): 마지막 페이지의 가장 오래된 메시지 기준
    getNextPageParam: (lastPage) => {
      if (!lastPage?.hasMore || !lastPage?.messages?.length) return undefined;
      return { before: lastPage.messages[0].created_at } as ChatPageParam;
    },
    // 순방향 (미래): 첫 페이지의 가장 최신 메시지 기준
    // hasNewer가 명시적이거나, 다중 페이지 존재 시(maxPages로 최신 페이지 제거된 경우) 순방향 가능
    getPreviousPageParam: (firstPage, allPages) => {
      const hasNewer = firstPage?.hasNewer || allPages.length > 1;
      if (!hasNewer || !firstPage?.messages?.length) return undefined;
      return {
        after: firstPage.messages[firstPage.messages.length - 1].created_at,
      } as ChatPageParam;
    },
    maxPages: 10,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
