import { infiniteQueryOptions } from "@tanstack/react-query";
import {
  getMessagesWithReadStatusAction,
  getMessagesAroundAction,
} from "@/lib/domains/chat/actions";
import { chatKeys } from "@/lib/domains/chat/queryKeys";

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
 * 채팅 메시지 infiniteQuery 옵션
 *
 * 서버 컴포넌트에서 prefetchInfiniteQuery로 프리패칭하고,
 * 클라이언트 컴포넌트에서 useInfiniteQuery로 사용합니다.
 *
 * @param roomId 채팅방 ID
 * @param lastReadAt unread divider 기준 타임스탬프 (양방향 모드 활성화)
 */
export function chatMessagesQueryOptions(roomId: string, lastReadAt?: string) {
  return infiniteQueryOptions({
    queryKey: chatKeys.messages(roomId),
    queryFn: async ({ pageParam }: { pageParam: ChatPageParam }) => {
      let result;

      if (pageParam && "around" in pageParam) {
        // 양방향 초기 로드: unread divider 기준
        result = await getMessagesAroundAction(roomId, pageParam.around, PAGE_SIZE);
      } else if (pageParam && "after" in pageParam) {
        // 순방향: 더 새로운 메시지
        result = await getMessagesWithReadStatusAction(roomId, {
          limit: PAGE_SIZE,
          after: pageParam.after,
        });
      } else {
        // 역방향: 더 오래된 메시지 (기본)
        result = await getMessagesWithReadStatusAction(roomId, {
          limit: PAGE_SIZE,
          before: pageParam && "before" in pageParam ? pageParam.before : undefined,
        });
      }

      if (!result.success) {
        const errorMessage = result.error ?? "메시지 조회 실패";
        if (process.env.NODE_ENV === "development") {
          console.error(
            `[chatMessagesQueryOptions] Query failed - roomId: ${roomId}, pageParam:`,
            pageParam,
            `error: ${errorMessage}`
          );
        }
        throw new Error(errorMessage);
      }
      return result.data;
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
    getPreviousPageParam: (firstPage) => {
      if (!firstPage?.hasNewer || !firstPage?.messages?.length) return undefined;
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
