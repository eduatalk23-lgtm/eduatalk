/**
 * 학생 채팅방 페이지
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
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

  return <ChatRoomPage roomId={roomId} userId={user.userId} basePath="/chat" />;
}
