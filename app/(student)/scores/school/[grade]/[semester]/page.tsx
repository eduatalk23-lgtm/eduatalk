import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { ScoreTypeTabs } from "../../../_components/ScoreTypeTabs";
import { getSchoolScores } from "@/lib/data/studentScores";
import { getSubjectHierarchyOptimized, getActiveCurriculumRevision } from "@/lib/data/subjects";
import { SchoolScoresView } from "./_components/SchoolScoresView";
import { getContainerClass } from "@/lib/constants/layout";

type PageProps = {
  params: Promise<{
    grade: string;
    semester: string;
  }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const validGrades = ["1", "2", "3"];
const validSemesters = ["1", "2"];

export default async function SchoolScoresPage({
  params,
  searchParams,
}: PageProps) {
  const { grade, semester } = await params;
  const paramsQuery = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 유효성 검증
  if (!validGrades.includes(grade) || !validSemesters.includes(semester)) {
    redirect("/scores/school/1/1");
  }

  // Tenant 정보 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 모든 성적 데이터 조회 (필터는 클라이언트에서 처리)
  // ⚠️ getSchoolScores는 deprecated입니다. getInternalScores를 사용하거나 통합 대시보드 API를 사용하세요.
  const scores = await getSchoolScores(user.id, tenantContext.tenantId);

  // 활성화된 개정교육과정 조회
  const activeCurriculum = await getActiveCurriculumRevision();
  if (!activeCurriculum) {
    throw new Error("활성화된 개정교육과정을 찾을 수 없습니다.");
  }

  // 교과/과목/과목구분 데이터 조회 (개정교육과정별)
  const subjectHierarchy = await getSubjectHierarchyOptimized(activeCurriculum.id);
  const subjectGroupsWithSubjects = subjectHierarchy.subjectGroups;
  const subjectTypes = subjectHierarchy.subjectTypes;

  const successMessage = paramsQuery.success;

  return (
    <section className={getContainerClass("DASHBOARD", "md")}>
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">내신 성적</h1>
        <p className="text-sm text-gray-600">
          내신 성적을 입력하고 관리하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <ScoreTypeTabs />
      </div>

      {/* 성적 카드 그리드 */}
      <SchoolScoresView
        initialGrade={parseInt(grade)}
        initialSemester={parseInt(semester)}
        scores={scores}
        subjectGroups={subjectGroupsWithSubjects}
        subjectTypes={subjectTypes}
      />
    </section>
  );
}

