/**
 * 학부모 채팅 목록 페이지
 *
 * 모바일: 채팅방 목록 표시
 * 데스크톱: split layout의 사이드바에 목록이 이미 있으므로 빈 상태 (layout이 처리)
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { ParentChatListPage } from "./_components/ParentChatListPage";

export const metadata = {
  title: "채팅 | 학부모 - TimeLevelUp",
};

export default async function ParentChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(chatRoomsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* 모바일에서만 표시 (데스크톱은 layout 사이드바가 목록 담당) */}
      <div className="h-full md:hidden">
        <ParentChatListPage userId={user.userId} basePath="/parent/chat" />
      </div>
    </HydrationBoundary>
  );
}
