/**
 * 학생 채팅 목록 페이지
 * SSR 프리패칭으로 초기 로딩 시간 단축
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { ChatListPage } from "./_components/ChatListPage";

export const metadata = {
  title: "채팅 | TimeLevelUp",
};

export default async function StudentChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭 (실패해도 클라이언트에서 재시도)
  const queryClient = getQueryClient();
  try {
    await queryClient.prefetchQuery(chatRoomsQueryOptions());
  } catch (error) {
    console.error("[StudentChatPage] Prefetch failed:", {
      message: error instanceof Error ? error.message : (error as { message?: string })?.message,
      raw: JSON.stringify(error),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ChatListPage userId={user.userId} basePath="/chat" />
    </HydrationBoundary>
  );
}
