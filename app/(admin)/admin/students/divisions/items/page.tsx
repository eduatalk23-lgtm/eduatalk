import { redirect } from "next/navigation";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { StudentDivisionsManager } from "./_components/StudentDivisionsManager";

export default async function StudentDivisionsItemsPage() {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <PageContainer widthType="LIST">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="학생 구분 항목 관리"
          description="학생 구분 항목(고등부, 중등부, 기타 등)을 관리합니다. 구분 항목을 추가, 수정, 삭제할 수 있습니다."
        />

        <StudentDivisionsManager />
      </div>
    </PageContainer>
  );
}

