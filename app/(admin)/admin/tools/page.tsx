
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { PageHeader } from "@/components/layout/PageHeader";
import { ToolCard } from "./_components/ToolCard";

export default async function AdminToolsPage() {
  const { userId, role } = await getCachedUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-6">
        <PageHeader
          title="관리 도구"
          description="학생 관리와 데이터 처리를 위한 도구를 사용하세요"
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            icon="📋"
            title="플랜 대량 생성"
            description="여러 학생에게 동일한 플랜을 일괄 생성합니다."
            buttonText="준비 중"
            buttonDisabled={true}
          />

          <ToolCard
            icon="📊"
            title="성적 일괄 입력"
            description="엑셀 파일을 업로드하여 여러 학생의 성적을 한 번에 입력합니다."
            buttonText="준비 중"
            buttonDisabled={true}
          />

          <ToolCard
            icon="🎯"
            title="목표 관리 도우미"
            description="학생별 목표를 효율적으로 생성하고 관리합니다."
            buttonText="준비 중"
            buttonDisabled={true}
          />
        </div>
      </div>
    </div>
  );
}

