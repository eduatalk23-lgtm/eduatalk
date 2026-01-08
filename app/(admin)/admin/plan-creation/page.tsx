import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";

export const metadata = {
  title: "플랜 생성 관리 | TimeLevelUp",
  description: "학생들의 학습 플랜을 통합 생성하고 관리합니다",
};

interface PageProps {
  searchParams: Promise<{ studentIds?: string }>;
}

/**
 * 플랜 생성 페이지 - 학생 상세 페이지로 리다이렉트
 *
 * 기존 북마크/링크 호환성을 위해 유지하며,
 * 실제 플랜 생성은 학생 상세 페이지(/admin/students/[id]/plans)에서 진행
 */
export default async function PlanCreationPage({ searchParams }: PageProps) {
  const { userId, role } = await getCurrentUserRole();
  const params = await searchParams;

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  // URL 파라미터에서 학생 ID 파싱
  const studentIds = params.studentIds?.split(",").filter(Boolean) || [];

  if (studentIds.length === 0) {
    // 학생 ID가 없으면 학생 목록으로 이동
    redirect("/admin/students");
  }

  if (studentIds.length === 1) {
    // 단일 학생: 해당 학생의 플랜 탭으로 이동 (위저드 자동 오픈)
    redirect(`/admin/students/${studentIds[0]}/plans?openWizard=true`);
  }

  // 다중 학생: 첫 번째 학생 페이지로 이동 + 배치 모드
  redirect(
    `/admin/students/${studentIds[0]}/plans?batchStudentIds=${studentIds.join(",")}`
  );
}
