
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { StudentSelector } from "../_components/StudentSelector";
import { ParentDashboardContent } from "../_components/ParentDashboardContent";
import { getContainerClass } from "@/lib/constants/layout";
import { PageHeader } from "@/components/layout/PageHeader";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCurrentUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-yellow-900">
              연결된 자녀가 없습니다
            </h2>
            <p className="text-sm text-yellow-700">
              관리자에게 자녀 연결을 요청해주세요.
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID (쿼리 파라미터 또는 첫 번째 학생)
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/dashboard");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-red-900">
              접근 권한이 없습니다
            </h2>
            <p className="text-sm text-red-700">
              이 학생의 정보를 조회할 권한이 없습니다.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="학부모 대시보드"
          description="자녀의 학습 현황을 실시간으로 확인하세요"
        />

        {/* 학생 선택 드롭다운 */}
        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />

        {/* 대시보드 콘텐츠 */}
        <ParentDashboardContent studentId={selectedStudentId} />
      </div>
    </section>
  );
}

