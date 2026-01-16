/**
 * 관리자 채팅 목록 페이지
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { AdminChatListPage } from "./_components/AdminChatListPage";

export const metadata = {
  title: "채팅 | 관리자 - TimeLevelUp",
};

export default async function AdminChatPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <AdminChatListPage userId={user.userId} />;
}
