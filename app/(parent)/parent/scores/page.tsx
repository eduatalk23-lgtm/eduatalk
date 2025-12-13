export const dynamic = 'force-dynamic';

/**
 * 학부모 영역 성적 페이지
 * 
 * 새로운 통합 대시보드 API(/api/students/[id]/score-dashboard)를 사용합니다.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../_utils";
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { StudentSelector } from "../_components/StudentSelector";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentScoresPage({ searchParams }: PageProps) {
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
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">
            연결된 자녀가 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/scores");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 학생 정보 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, name, grade, class, tenant_id")
    .eq("id", selectedStudentId)
    .maybeSingle();

  if (!student) {
    return (
      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            학생 정보를 찾을 수 없습니다
          </h2>
        </div>
      </section>
    );
  }

  // 새로운 통합 대시보드 API 사용
  let dashboardData = null;
  try {
    if (student.tenant_id) {
      dashboardData = await fetchScoreDashboard({
        studentId: selectedStudentId,
        tenantId: student.tenant_id,
      });
    }
  } catch (error) {
    console.error("[parent/scores] 성적 대시보드 API 호출 실패", error);
  }

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold text-gray-900">성적 현황</h1>
          <p className="text-sm text-gray-500">
            자녀의 내신 및 모의고사 성적을 확인하세요
          </p>
        </div>
        <Link
          href="/parent/dashboard"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          대시보드로 돌아가기
        </Link>
      </div>

      {/* 학생 선택 */}
      <div>
        <StudentSelector
          students={linkedStudents}
          selectedStudentId={selectedStudentId}
        />
      </div>

      {!dashboardData ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">등록된 성적이 없습니다.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* 내신 분석 */}
          {dashboardData.internalAnalysis.totalGpa !== null && (
            <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">내신 분석</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-lg bg-indigo-50 p-4">
                  <div className="text-sm text-indigo-600">전체 GPA</div>
                  <div className="text-2xl font-bold text-indigo-700">
                    {dashboardData.internalAnalysis.totalGpa.toFixed(2)}
                  </div>
                </div>
                {dashboardData.internalAnalysis.zIndex !== null && (
                  <div className="flex flex-col gap-1 rounded-lg bg-blue-50 p-4">
                    <div className="text-sm text-blue-600">Z-Index</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {dashboardData.internalAnalysis.zIndex.toFixed(2)}
                    </div>
                  </div>
                )}
                {Object.keys(dashboardData.internalAnalysis.subjectStrength).length > 0 && (
                  <div className="flex flex-col gap-1 rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">교과군 수</div>
                    <div className="text-2xl font-bold text-purple-700">
                      {Object.keys(dashboardData.internalAnalysis.subjectStrength).length}개
                    </div>
                  </div>
                )}
              </div>
              {Object.keys(dashboardData.internalAnalysis.subjectStrength).length > 0 && (
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-medium text-gray-700">교과군별 평점</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(dashboardData.internalAnalysis.subjectStrength).map(([subject, gpa]) => (
                      <div key={subject} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2">
                        <span className="text-sm text-gray-700">{subject}</span>
                        <span className="text-sm font-semibold text-gray-900">{gpa.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 모의고사 분석 */}
          {dashboardData.mockAnalysis.recentExam !== null && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">모의고사 분석</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {dashboardData.mockAnalysis.recentExam && (
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">최근 시험</div>
                    <div className="mt-1 text-lg font-bold text-purple-700">
                      {dashboardData.mockAnalysis.recentExam.examTitle}
                    </div>
                    <div className="mt-1 text-xs text-purple-500">
                      {new Date(dashboardData.mockAnalysis.recentExam.examDate).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                )}
                {dashboardData.mockAnalysis.avgPercentile !== null && (
                  <div className="rounded-lg bg-indigo-50 p-4">
                    <div className="text-sm text-indigo-600">평균 백분위</div>
                    <div className="mt-1 text-2xl font-bold text-indigo-700">
                      {dashboardData.mockAnalysis.avgPercentile.toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
              {dashboardData.mockAnalysis.best3GradeSum !== null && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <div className="text-sm text-gray-600">상위 3개 등급 합</div>
                  <div className="mt-1 text-xl font-bold text-gray-900">
                    {dashboardData.mockAnalysis.best3GradeSum}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 입시 전략 */}
          {dashboardData.strategyResult && (
            <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-6">
              <h3 className="text-base font-semibold text-blue-900">입시 전략</h3>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-sm font-medium ${
                  dashboardData.strategyResult.type === "BALANCED" ? "bg-blue-100 text-blue-800" :
                  dashboardData.strategyResult.type === "MOCK_ADVANTAGE" ? "bg-purple-100 text-purple-800" :
                  "bg-indigo-100 text-indigo-800"
                }`}>
                  {dashboardData.strategyResult.type === "BALANCED" ? "균형형" :
                   dashboardData.strategyResult.type === "MOCK_ADVANTAGE" ? "모의고사 우위" :
                   "내신 우위"}
                </span>
              </div>
              <p className="text-sm text-blue-700">{dashboardData.strategyResult.message}</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

