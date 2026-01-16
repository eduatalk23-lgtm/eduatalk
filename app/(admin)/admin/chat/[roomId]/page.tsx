/**
 * 관리자 채팅방 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
import { AdminChatRoomPage } from "./_components/AdminChatRoomPage";

export const metadata = {
  title: "채팅 | 관리자 - TimeLevelUp",
};

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function AdminChatRoomPageRoute({ params }: PageProps) {
  const { roomId } = await params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭 (실패해도 클라이언트에서 재시도)
  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(roomId));
  } catch (error) {
    console.error("[AdminChatRoomPage] Prefetch failed:", {
      message: error instanceof Error ? error.message : (error as { message?: string })?.message,
      code: (error as { code?: string })?.code,
      roomId,
      raw: JSON.stringify(error),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminChatRoomPage roomId={roomId} userId={user.userId} basePath="/admin/chat" />
    </HydrationBoundary>
  );
}
