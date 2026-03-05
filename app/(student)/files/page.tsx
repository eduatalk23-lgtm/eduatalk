/**
 * 학생 내 파일 페이지
 * 드라이브 파일 + 워크플로우 요청 통합 뷰
 */

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { redirect } from "next/navigation";
import { FilesPageClient } from "./_components/FilesPageClient";

export const metadata = {
  title: "내 파일 | TimeLevelUp",
};

export default async function StudentFilesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // students.id = auth.uid() 패턴
  return <FilesPageClient studentId={user.userId} />;
}
