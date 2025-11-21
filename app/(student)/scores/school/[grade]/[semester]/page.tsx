import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { ScoreTypeTabs } from "../../../_components/ScoreTypeTabs";
import { GradeTabs } from "../../../_components/GradeTabs";
import { SemesterTabs } from "../../../_components/SemesterTabs";
import { getSchoolScores } from "@/lib/data/studentScores";
import { getSubjectGroupsWithSubjects } from "@/lib/data/subjects";
import SchoolScoresTable from "./_components/SchoolScoresTable";

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

  // 기존 성적 데이터 조회
  const scores = await getSchoolScores(user.id, tenantContext.tenantId, {
    grade: parseInt(grade),
    semester: parseInt(semester),
  });

  // 교과/과목 데이터 조회
  const subjectGroupsWithSubjects = await getSubjectGroupsWithSubjects(
    tenantContext.tenantId
  );

  const successMessage = paramsQuery.success;

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">내신 성적</h1>
        <p className="text-sm text-gray-600">
          {grade}학년 {semester}학기 내신 성적을 입력하고 관리하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 flex flex-col gap-4">
        <ScoreTypeTabs />
        <GradeTabs
          basePath="/scores/school"
          currentGrade={grade}
          additionalParams={[semester]}
        />
        <SemesterTabs
          basePath={`/scores/school/${grade}`}
          currentSemester={semester}
        />
      </div>

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {successMessage === "created" && "성적이 성공적으로 등록되었습니다."}
          {successMessage === "updated" && "성적이 성공적으로 수정되었습니다."}
          {successMessage === "deleted" && "성적이 성공적으로 삭제되었습니다."}
        </div>
      )}

      {/* 성적 입력 테이블 */}
      <SchoolScoresTable
        grade={parseInt(grade)}
        semester={parseInt(semester)}
        initialScores={scores}
        subjectGroups={subjectGroupsWithSubjects}
      />
    </section>
  );
}

