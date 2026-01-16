/**
 * 학생 채팅방 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatMessagesQueryOptions } from "@/lib/query-options/chatMessages";
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

  // SSR 프리패칭 (실패해도 클라이언트에서 재시도)
  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchInfiniteQuery(chatMessagesQueryOptions(roomId));
  } catch (error) {
    // 프리패칭 실패 시 로그만 남기고 계속 진행 (graceful degradation)
    // Supabase 에러는 일반 객체이므로 JSON.stringify로 직렬화
    console.error("[StudentChatRoomPage] Prefetch failed:", {
      message: error instanceof Error ? error.message : (error as { message?: string })?.message,
      code: (error as { code?: string })?.code,
      roomId,
      raw: JSON.stringify(error),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatRoomPage roomId={roomId} userId={user.userId} basePath="/chat" />
    </HydrationBoundary>
  );
}
