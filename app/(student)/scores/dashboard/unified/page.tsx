import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchScoreDashboard } from "@/lib/api/scoreDashboard";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { StudentProfileCard } from "./_components/StudentProfileCard";
import { InternalAnalysisCard } from "./_components/InternalAnalysisCard";
import { MockAnalysisCard } from "./_components/MockAnalysisCard";
import { StrategyCard } from "./_components/StrategyCard";
import { Card } from "@/components/molecules/Card";
import { PageHeader } from "@/components/layout/PageHeader";
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

  const tenantId = tenantContext.tenantId;

  // tenantId가 없으면 에러 반환
  if (!tenantId) {
    return (
      <section className="mx-auto max-w-6xl p-6 md:p-8">
        <Card>
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="text-lg font-semibold text-red-600">
              테넌트 정보를 찾을 수 없습니다
            </div>
            <p className="text-sm text-gray-600">
              다시 로그인해주세요.
            </p>
          </div>
        </Card>
      </section>
    );
  }

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
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
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
        <div className="flex flex-col gap-6">
          <PageHeader
            title="성적 대시보드"
            description="내신 및 모의고사 성적을 통합 분석하고 입시 전략을 제시합니다."
          />

          <Card>
            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <div className="text-lg font-semibold text-red-600">
                데이터를 불러오는 중 오류가 발생했습니다
              </div>
              <p className="text-sm text-gray-600">{error}</p>
              <Link
                href="/scores"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                성적 관리로 이동
              </Link>
            </div>
          </Card>
        </div>
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
      <div className="flex flex-col gap-6">
        <PageHeader
          title="성적 대시보드"
          description="내신 및 모의고사 성적을 통합 분석하고 입시 전략을 제시합니다."
        />

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
        <div className="flex flex-wrap gap-4">
          <Link
            href="/scores/input"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-transparent bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            성적 입력하기
          </Link>
          <Link
            href="/scores/analysis"
            className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            상세 분석 보기
          </Link>
        </div>
      </div>
    </section>
  );
}

