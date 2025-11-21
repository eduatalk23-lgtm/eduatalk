import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { getSubjectGroupsWithSubjects } from "@/lib/data/subjects";
import { SubjectGroupManagement } from "./_components/SubjectGroupManagement";

export default async function SubjectsPage() {
  const tenantContext = await getTenantContext();

  if (!tenantContext?.tenantId) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          기관 정보를 찾을 수 없습니다.
        </div>
      </section>
    );
  }

  const subjectGroupsWithSubjects = await getSubjectGroupsWithSubjects(
    tenantContext.tenantId
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-500">서비스 관리</p>
          <h1 className="text-3xl font-semibold text-gray-900">교과/과목 관리</h1>
          <p className="text-sm text-gray-500">
            내신 성적 입력에 사용할 교과와 과목을 관리하세요.
          </p>
        </div>

        {/* 교과/과목 관리 */}
        <SubjectGroupManagement
          initialData={subjectGroupsWithSubjects}
        />
      </div>
    </section>
  );
}

