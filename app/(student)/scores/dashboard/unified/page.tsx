import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { StudentProfileCard } from "./_components/StudentProfileCard";
import { InternalAnalysisCard } from "./_components/InternalAnalysisCard";
import { MockAnalysisCard } from "./_components/MockAnalysisCard";
import { StrategyCard } from "./_components/StrategyCard";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

/**
 * 통합 성적 대시보드 페이지
 * 
 * /api/students/[id]/score-dashboard 를 기반으로 구현
 * 
 * 구성:
 * - 학생 프로필 카드
 * - 내신 분석 카드
 * - 모의고사 분석 카드
 * - 수시/정시 전략 카드
 */
export default async function UnifiedScoreDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Tenant 정보 조회
  const tenantContext = await getTenantContext();
  if (!tenantContext) {
    return (
      <section className="mx-auto max-w-6xl p-6 md:p-8">
        <Card>
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="text-lg font-semibold text-red-600">
              테넌트 정보를 찾을 수 없습니다
            </div>
            <p className="text-sm text-gray-600">
              학생 정보를 불러올 수 없습니다. 관리자에게 문의하세요.
            </p>
          </div>
        </Card>
      </section>
    );
  }

  const tenantId = tenantContext.id;

  // 학생 ID 조회
  const { data: student } = await supabase
    .from("students")
    .select("id, grade")
    .eq("id", user.id)
    .maybeSingle();

  if (!student) {
    return (
      <section className="mx-auto max-w-6xl p-6 md:p-8">
        <Card>
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="text-lg font-semibold text-red-600">
              학생 정보를 찾을 수 없습니다
            </div>
            <p className="text-sm text-gray-600">
              학생 설정을 완료해주세요.
            </p>
            <Link
              href="/settings"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              학생 설정하기
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  // 성적 대시보드 데이터 가져오기
  let dashboardData;
  let error: string | null = null;

  try {
    dashboardData = await fetchScoreDashboard({
      studentId: student.id,
      tenantId,
      grade: student.grade || undefined,
      semester: 1, // 기본값: 1학기
    });
  } catch (err) {
    console.error("[unified-dashboard] 성적 대시보드 조회 실패", err);
    error = err instanceof Error ? err.message : "알 수 없는 오류";
  }

  // 에러 처리
  if (error || !dashboardData) {
    return (
      <section className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-900">성적 대시보드</h1>
          <p className="text-sm text-gray-600">
            내신 및 모의고사 성적을 통합 분석하고 입시 전략을 제시합니다.
          </p>
        </div>

        <Card>
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="text-lg font-semibold text-red-600">
              데이터를 불러오는 중 오류가 발생했습니다
            </div>
            <p className="text-sm text-gray-600">{error}</p>
            <Link
              href="/scores"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              성적 관리로 이동
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  const {
    studentProfile,
    internalAnalysis,
    mockAnalysis,
    strategyResult,
  } = dashboardData;

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      {/* 헤더 */}
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">성적 대시보드</h1>
        <p className="text-sm text-gray-600">
          내신 및 모의고사 성적을 통합 분석하고 입시 전략을 제시합니다.
        </p>
      </div>

      {/* 대시보드 카드 섹션 */}
      <div className="flex flex-col gap-6">
        {/* 학생 프로필 */}
        <StudentProfileCard profile={studentProfile} />

        {/* 2열 레이아웃: 내신 + 모의고사 */}
        <div className="grid gap-6 md:grid-cols-2">
          <InternalAnalysisCard analysis={internalAnalysis} />
          <MockAnalysisCard analysis={mockAnalysis} />
        </div>

        {/* 수시/정시 전략 */}
        <StrategyCard strategy={strategyResult} />
      </div>

      {/* 추가 액션 */}
      <div className="mt-8 flex flex-wrap gap-4">
        <Link
          href="/scores"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          성적 입력하기
        </Link>
        <Link
          href="/scores/dashboard"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          상세 분석 보기
        </Link>
      </div>
    </section>
  );
}

