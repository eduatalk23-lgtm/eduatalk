/**
 * 관리자 채팅 신고 관리 페이지
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { ReportListPage } from "./_components/ReportListPage";

export const metadata = {
  title: "신고 관리 | 관리자 - TimeLevelUp",
};

export default async function AdminChatReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ReportListPage />;
}
