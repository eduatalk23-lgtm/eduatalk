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
    maxPages: 5, // 메모리 최적화: 최대 5페이지(250 메시지)만 캐시에 유지
    staleTime: 60 * 1000, // 1분 (Realtime이 업데이트 담당, 재방문 시 불필요한 refetch 방지)
    gcTime: 5 * 60 * 1000, // 채팅방 이탈 후 5분 뒤 캐시 GC
    refetchOnWindowFocus: false, // Realtime이 freshness 관리
  });
}
