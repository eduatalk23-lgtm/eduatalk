/**
 * 학부모 채팅 레이아웃
 * 데스크톱: split-pane (목록 사이드바 + 채팅방)
 * 모바일: 기존 단일 컬럼
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { ParentChatLayout } from "./_components/ParentChatLayout";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ParentChatLayout userId={user.userId} basePath="/parent/chat">
      {children}
    </ParentChatLayout>
  );
}
