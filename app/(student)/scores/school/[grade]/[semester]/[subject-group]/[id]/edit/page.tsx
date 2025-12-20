import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { SchoolScoreEditForm } from "./_components/SchoolScoreEditForm";
import { getInternalScores } from "@/lib/data/studentScores";
import type { InternalScore } from "@/lib/data/studentScores";

type PageProps = {
  params: Promise<{
    grade: string;
    semester: string;
    "subject-group": string;
    id: string;
  }>;
};

const validGrades = ["1", "2", "3"];
const validSemesters = ["1", "2"];
const validSubjects = ["국어", "수학", "영어", "사회", "과학"];

type SchoolScoreRow = {
  id: string;
  grade: number;
  semester: number;
  subject_group: string;
  subject_type: string | null;
  subject_name: string | null;
  raw_score: number | null;
  grade_score: number | null;
  class_rank: number | null;
  test_date: string | null;
};

export default async function EditSchoolScorePage({ params }: PageProps) {
  const { grade, semester, "subject-group": subjectGroupRaw, id } = await params;
  const subjectGroup = decodeURIComponent(subjectGroupRaw);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 유효성 검증
  if (
    !validGrades.includes(grade) ||
    !validSemesters.includes(semester) ||
    !validSubjects.includes(subjectGroup)
  ) {
    redirect("/scores/school/1/1/국어");
  }

  // Tenant 정보 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext?.tenantId) {
    redirect("/login");
  }

  // 신규 테이블에서 데이터 조회
  const internalScores = await getInternalScores(user.id, tenantContext.tenantId);
  const score = internalScores.find((s) => s.id === id);

  if (!score) {
    redirect(`/scores/school/${grade}/${semester}/${encodeURIComponent(subjectGroup)}`);
  }

  // InternalScore를 SchoolScoreRow로 변환
  // 과목 정보는 별도로 조회해야 하지만, 일단 기본 필드만 매핑
  const scoreData: SchoolScoreRow = {
    id: score.id,
    grade: score.grade,
    semester: score.semester,
    subject_group: subjectGroup, // URL 파라미터에서 가져온 값 사용
    subject_type: null, // 나중에 subject_type_id로 조회 필요
    subject_name: null, // 나중에 subject_id로 조회 필요
    raw_score: score.raw_score,
    grade_score: score.rank_grade, // rank_grade -> grade_score
    class_rank: null, // InternalScore에는 class_rank가 없음
    test_date: null, // InternalScore에는 test_date가 없음
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold text-gray-900">내신 성적 수정</h1>
          <p className="text-sm text-gray-500">
            {grade}학년 {semester}학기 {subjectGroup} 내신 성적을 수정하세요.
          </p>
        </div>
        <Link
          href={`/scores/school/${grade}/${semester}/${encodeURIComponent(subjectGroup)}`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          목록으로
        </Link>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <SchoolScoreEditForm
          id={id}
          grade={grade}
          semester={semester}
          subjectGroup={subjectGroup}
          defaultValue={scoreData}
          tenantId={tenantContext.tenantId}
        />
      </div>
    </section>
  );
}

