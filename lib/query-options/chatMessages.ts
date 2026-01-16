import { infiniteQueryOptions } from "@tanstack/react-query";
import { getMessagesWithReadStatusAction } from "@/lib/domains/chat/actions";

/**
 * 채팅 메시지 infiniteQuery 옵션
 *
 * 서버 컴포넌트에서 prefetchInfiniteQuery로 프리패칭하고,
 * 클라이언트 컴포넌트에서 useInfiniteQuery로 사용합니다.
 * 쿼리 키와 옵션이 동일하므로 hydration이 올바르게 작동합니다.
 */
export function chatMessagesQueryOptions(roomId: string) {
  return infiniteQueryOptions({
    queryKey: ["chat-messages", roomId] as const,
    queryFn: async ({ pageParam }) => {
      const result = await getMessagesWithReadStatusAction(roomId, {
        limit: 50,
        before: pageParam,
      });
      if (!result.success) {
        const errorMessage = result.error ?? "메시지 조회 실패";
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[chatMessagesQueryOptions] Query failed - roomId: ${roomId}, pageParam: ${pageParam}, error: ${errorMessage}`
          );
          console.error("[chatMessagesQueryOptions] Full result:", JSON.stringify(result, null, 2));
        }
        throw new Error(errorMessage);
      }
      return result.data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage?.hasMore || !lastPage?.messages?.length) return undefined;
      return lastPage.messages[0].id; // 가장 오래된 메시지 ID
    },
    staleTime: 30 * 1000, // 30초 (Realtime이 업데이트 담당)
  });
}
