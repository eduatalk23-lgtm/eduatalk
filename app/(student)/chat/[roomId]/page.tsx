/**
 * 학생 채팅방 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import { chatRoomDetailQueryOptions, chatPinnedQueryOptions, chatAnnouncementQueryOptions } from "@/lib/query-options/chatRoom";
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
  const queryClient = getQueryClient();
  void queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(roomId));
  void queryClient.prefetchQuery(chatRoomDetailQueryOptions(roomId));
  void queryClient.prefetchQuery(chatPinnedQueryOptions(roomId));
  void queryClient.prefetchQuery(chatAnnouncementQueryOptions(roomId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatRoomPage roomId={roomId} userId={user.userId} basePath="/chat" />
    </HydrationBoundary>
  );
}
