/**
 * 학생 채팅방 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import {
  getMessagesWithReadStatusAction,
  getChatRoomDetailAction,
} from "@/lib/domains/chat/actions";
import { chatPinnedQueryOptions, chatAnnouncementQueryOptions, chatPermissionsQueryOptions } from "@/lib/query-options/chatRoom";
import { ChatRoomPage } from "./_components/ChatRoomPage";

export const metadata = {
  title: "채팅 | TimeLevelUp",
};

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function StudentChatRoomPage({ params }: PageProps) {
  const { roomId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭 (non-blocking: HTML 스트리밍과 병렬, 실패 시 클라이언트에서 재시도)
  // 메시지/방 상세는 Server Action으로 프리패칭 (클라이언트는 RPC queryFn 사용, queryKey 동일 → hydration 정상)
  const queryClient = getQueryClient();
  queryClient.prefetchInfiniteQuery({
    queryKey: chatKeys.messages(roomId),
    queryFn: async () => {
      const result = await getMessagesWithReadStatusAction(roomId, { limit: 50 });
      if (!result.success) throw new Error(result.error ?? "메시지 조회 실패");
      return result.data;
    },
    initialPageParam: undefined,
  }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[SSR prefetch] messages failed:", err);
    }
  });
  queryClient.prefetchQuery({
    queryKey: chatKeys.room(roomId),
    queryFn: async () => {
      const result = await getChatRoomDetailAction(roomId);
      if (!result.success) throw new Error(result.error ?? "채팅방 정보 조회 실패");
      return result.data;
    },
  }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.error("[SSR prefetch] room detail failed:", err);
    }
  });
  void queryClient.prefetchQuery(chatPinnedQueryOptions(roomId));
  void queryClient.prefetchQuery(chatAnnouncementQueryOptions(roomId));
  void queryClient.prefetchQuery(chatPermissionsQueryOptions(roomId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatRoomPage roomId={roomId} userId={user.userId} basePath="/chat" />
    </HydrationBoundary>
  );
}
