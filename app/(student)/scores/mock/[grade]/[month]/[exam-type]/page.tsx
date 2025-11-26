import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { ScoreTypeTabs } from "../../../../_components/ScoreTypeTabs";
import { getMockScores } from "@/lib/data/studentScores";
import { getSubjectHierarchyOptimized, getActiveCurriculumRevision } from "@/lib/data/subjects";
import { MockScoresView } from "./_components/MockScoresView";

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

  // 모든 성적 데이터 조회 (필터는 클라이언트에서 처리)
  const scores = await getMockScores(user.id, tenantContext.tenantId);

  // 활성화된 개정교육과정 조회
  const activeCurriculum = await getActiveCurriculumRevision();
  if (!activeCurriculum) {
    throw new Error("활성화된 개정교육과정을 찾을 수 없습니다.");
  }

  // 교과/과목/과목구분 데이터 조회 (개정교육과정별)
  const subjectHierarchy = await getSubjectHierarchyOptimized(activeCurriculum.id);
  const subjectGroupsWithSubjects = subjectHierarchy.subjectGroups;
  const subjectTypes = subjectHierarchy.subjectTypes;

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">모의고사 성적</h1>
        <p className="text-sm text-gray-600">
          모의고사 성적을 입력하고 관리하세요.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6">
        <ScoreTypeTabs />
      </div>

      {/* 성적 카드 그리드 */}
      <MockScoresView
        initialGrade={parseInt(grade)}
        initialExamType={examType}
        initialMonth={month}
        scores={scores}
        subjectGroups={subjectGroupsWithSubjects}
        subjectTypes={subjectTypes}
      />
    </section>
  );
}

