/**
 * 학생 채팅 목록 페이지
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { ChatListPage } from "./_components/ChatListPage";

export const metadata = {
  title: "채팅 | TimeLevelUp",
};

export default async function StudentChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ChatListPage userId={user.userId} basePath="/chat" />;
}
