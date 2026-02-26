/**
 * 학부모 채팅방 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import { chatRoomDetailQueryOptions, chatPinnedQueryOptions, chatAnnouncementQueryOptions } from "@/lib/query-options/chatRoom";
import { ParentChatRoomPage } from "./_components/ParentChatRoomPage";

export const metadata = {
  title: "채팅 | 학부모 - TimeLevelUp",
};

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function ParentChatRoomPageRoute({ params }: PageProps) {
  const { roomId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭
  const queryClient = getQueryClient();
  void queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(roomId));
  void queryClient.prefetchQuery(chatRoomDetailQueryOptions(roomId));
  void queryClient.prefetchQuery(chatPinnedQueryOptions(roomId));
  void queryClient.prefetchQuery(chatAnnouncementQueryOptions(roomId));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ParentChatRoomPage roomId={roomId} userId={user.userId} basePath="/parent/chat" />
    </HydrationBoundary>
  );
}
