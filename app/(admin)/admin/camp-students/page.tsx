import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCampTemplates } from "@/lib/domains/camp/actions";
import { CampStudentsList } from "./_components/CampStudentsList";

export const metadata = {
  title: "캠프 학생 관리",
  description: "캠프에 참여 중인 학생들의 현황을 통합 관리합니다.",
};

export default async function CampStudentsPage() {
  const { role } = await getCurrentUserRole();
  if (role !== "admin" && role !== "consultant") {
    redirect("/login");
  }

  // 캠프 목록 조회 (활성 상태만 필터링)
  const result = await getCampTemplates();
  const camps = result.success
    ? result.templates.filter((t) => t.status === "active")
    : [];

  return <CampStudentsList initialCamps={camps} />;
}
