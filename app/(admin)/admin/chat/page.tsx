/**
 * 관리자 채팅 목록 페이지
 *
 * 모바일: 채팅방 목록 표시
 * 데스크톱: split layout의 사이드바에 목록이 이미 있으므로 빈 상태 (layout이 처리)
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/providers/getQueryClient";
import { chatRoomsQueryOptions } from "@/lib/query-options/chatRooms";
import { AdminChatListPage } from "./_components/AdminChatListPage";

export const metadata = {
  title: "채팅 | 관리자 - TimeLevelUp",
};

export default async function AdminChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // SSR 프리패칭 (non-blocking: HTML 스트리밍과 병렬, 실패 시 클라이언트에서 재시도)
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(chatRoomsQueryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* 모바일에서만 표시 (데스크톱은 layout 사이드바가 목록 담당) */}
      <div className="h-full md:hidden">
        <AdminChatListPage userId={user.userId} basePath="/admin/chat" />
      </div>
    </HydrationBoundary>
  );
}
