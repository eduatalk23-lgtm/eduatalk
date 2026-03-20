/**
 * 학생 탐구 가이드 페이지
 * 배정된 가이드 목록 + 이행률 + 상태 변경
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { StudentGuideList } from "./_components/StudentGuideList";

export const metadata = {
  title: "탐구 가이드 | TimeLevelUp",
};

export default async function StudentGuidesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") redirect("/login");

  return <StudentGuideList />;
}
