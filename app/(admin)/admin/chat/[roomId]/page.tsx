/**
 * 관리자 채팅방 페이지
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
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

  return <AdminChatRoomPage roomId={roomId} userId={user.userId} />;
}
