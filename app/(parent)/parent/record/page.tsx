import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { StudentSelector } from "../_components/StudentSelector";
import { PageHeader } from "@/components/layout/PageHeader";
import { getContainerClass } from "@/lib/constants/layout";
import { calculateSchoolYear } from "@/lib/utils/schoolYear";
import { ParentRecordClient } from "./ParentRecordClient";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentRecordPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCachedUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">연결된 자녀가 없습니다</h2>
          <p className="mt-2 text-sm text-yellow-700">관리자에게 자녀 연결을 요청해주세요.</p>
        </div>
      </section>
    );
  }

  const selectedStudentId = params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/record");
  }

  const hasAccess = await canAccessStudent(supabase, userId, selectedStudentId);

  if (!hasAccess) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">접근 권한이 없습니다</h2>
          <p className="mt-2 text-sm text-red-700">이 학생의 정보를 조회할 권한이 없습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="생기부 현황"
          description="자녀의 생활기록부 입력 현황을 확인하세요"
        />

        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />

        <ParentRecordClient
          studentId={selectedStudentId}
          initialSchoolYear={calculateSchoolYear()}
        />
      </div>
    </section>
  );
}
