import { queryOptions } from "@tanstack/react-query";
import { getChatRoomsAction } from "@/lib/domains/chat/actions";

/**
 * 채팅방 목록 query 옵션
 *
 * 서버 컴포넌트에서 prefetchQuery로 프리패칭하고,
 * 클라이언트 컴포넌트에서 useQuery로 사용합니다.
 * 쿼리 키와 옵션이 동일하므로 hydration이 올바르게 작동합니다.
 */
export function chatRoomsQueryOptions() {
  return queryOptions({
    queryKey: ["chat-rooms"] as const,
    queryFn: async () => {
      const result = await getChatRoomsAction();
      if (!result.success) {
        const errorMessage = result.error ?? "채팅방 목록 조회 실패";
        if (process.env.NODE_ENV === "development") {
          console.error(`[chatRoomsQueryOptions] Query failed: ${errorMessage}`);
        }
        throw new Error(errorMessage);
      }
      return result.data;
    },
    staleTime: 30 * 1000, // 30초 (Realtime이 업데이트 담당)
  });
}
