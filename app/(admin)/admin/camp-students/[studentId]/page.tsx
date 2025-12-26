import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { StudentCampProfileView } from "./_components/StudentCampProfileView";

export const metadata = {
  title: "학생 캠프 통합 프로필",
  description: "학생의 모든 캠프 참여 현황을 통합 조회합니다.",
};

export default async function StudentCampProfilePage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  const { studentId } = await params;

  return <StudentCampProfileView studentId={studentId} />;
}
