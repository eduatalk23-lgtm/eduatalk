import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { ScoreTypeTabs } from "../../../../_components/ScoreTypeTabs";
import { GradeTabs } from "../../../../_components/GradeTabs";
import { MockMonthTabs } from "../../../../_components/MockMonthTabs";
import { MockExamTypeTabs } from "../../../../_components/MockExamTypeTabs";
import { getMockScores } from "@/lib/data/studentScores";
import { getSubjectGroupsWithSubjects } from "@/lib/data/subjects";
import MockScoresTable from "./_components/MockScoresTable";

type PageProps = {
  params: Promise<{
    grade: string;
    month: string;
    "exam-type": string;
  }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

const validGrades = ["1", "2", "3"];
const validMonths = ["3", "4", "5", "6", "7", "8", "9", "10", "11"];
const validExamTypes = ["평가원", "교육청", "사설"];

export default async function MockScoresPage({
  params,
  searchParams,
}: PageProps) {
  const { grade, month, "exam-type": examTypeRaw } = await params;
  const paramsQuery = await searchParams;
  const examType = decodeURIComponent(examTypeRaw);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 유효성 검증
  if (
    !validGrades.includes(grade) ||
    !validMonths.includes(month) ||
    !validExamTypes.includes(examType)
  ) {
    redirect("/scores/mock/1/3/평가원");
  }

  // Tenant 정보 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 기존 성적 데이터 조회 (해당 월의 exam_round로 필터링)
  const allScores = await getMockScores(user.id, tenantContext.tenantId, {
    grade: parseInt(grade),
    examType: examType,
  });

  // 해당 월(회차)의 성적만 필터링
  const scores = allScores.filter((score) => score.exam_round === month);

  // 교과/과목 데이터 조회
  const subjectGroupsWithSubjects = await getSubjectGroupsWithSubjects(
    tenantContext.tenantId
  );

  const successMessage = paramsQuery.success;

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">모의고사 성적</h1>
        <p className="text-sm text-gray-600">
          {grade}학년 {month}월 {examType} 모의고사 성적을 입력하고 관리하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 flex flex-col gap-4">
        <ScoreTypeTabs />
        <GradeTabs
          basePath="/scores/mock"
          currentGrade={grade}
          additionalParams={[month, examType]}
        />
        <MockMonthTabs
          basePath={`/scores/mock/${grade}`}
          currentMonth={month}
          additionalParams={[examType]}
        />
        <MockExamTypeTabs
          basePath={`/scores/mock/${grade}/${month}`}
          currentExamType={examType}
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
      <MockScoresTable
        grade={parseInt(grade)}
        examType={examType}
        month={month}
        initialScores={scores}
        subjectGroups={subjectGroupsWithSubjects}
      />
    </section>
  );
}

