import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import { MonthlySummaryHeader } from "./_components/MonthlySummaryHeader";
import { MonthlyCharts } from "./_components/MonthlyCharts";
import { SubjectAnalysisSection } from "./_components/SubjectAnalysisSection";
import { GoalProgressSection } from "./_components/GoalProgressSection";
import { ContentProgressSection } from "./_components/ContentProgressSection";
import { MonthlyHistorySection } from "./_components/MonthlyHistorySection";
import { MonthNavigation } from "./_components/MonthNavigation";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { getContainerClass } from "@/lib/constants/layout";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function MonthlyReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 월 파라미터 파싱 (YYYY-MM 형식)
  let monthDate: Date;
  if (params.month) {
    const [year, month] = params.month.split("-").map(Number);
    if (year && month && month >= 1 && month <= 12) {
      monthDate = new Date(year, month - 1, 1);
    } else {
      monthDate = new Date();
    }
  } else {
    monthDate = new Date();
  }

  // 미래 날짜는 현재 달로 제한
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if (monthDate > currentMonth) {
    monthDate = currentMonth;
  }

  try {
    const reportData = await getMonthlyReportData(supabase, user.id, monthDate);

    const hasData =
      reportData.totals.studyMinutes > 0 ||
      reportData.totals.completionRate > 0 ||
      reportData.goals.totalGoals > 0;

    return (
      <section className={getContainerClass("DASHBOARD", "lg")}>
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">월간 학습 리포트</h1>
            <p className="mt-1 text-sm text-gray-500">{reportData.period.monthLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              대시보드로 돌아가기
            </Link>
          </div>
        </div>

        {/* 월 네비게이션 */}
        <div className="mb-6">
          <MonthNavigation currentMonth={monthDate} />
        </div>

        {!hasData ? (
          <EmptyState
            title="이번 달 아직 학습 기록이 없습니다"
            description="학습을 시작하면 월간 리포트가 자동으로 생성됩니다."
            actionLabel="오늘부터 학습 시작하기"
            actionHref="/today"
            icon="📊"
          />
        ) : (
          <>
            {/* 요약 헤더 */}
            <MonthlySummaryHeader
              monthLabel={reportData.period.monthLabel}
              totalStudyMinutes={reportData.totals.studyMinutes}
              completionRate={reportData.totals.completionRate}
              goalRate={reportData.totals.goalRate}
              studyTimeChange={reportData.comparison.studyTimeChange}
              completionRateChange={reportData.comparison.completionRateChange}
              goalRateChange={reportData.comparison.goalRateChange}
            />

            {/* 그래프 섹션 */}
            <div className="mb-8">
              <MonthlyCharts reportData={reportData} />
            </div>

            {/* 과목 분석 */}
            {(reportData.subjects.strong.length > 0 || reportData.subjects.weak.length > 0) && (
              <div className="mb-8">
                <SubjectAnalysisSection
                  strongSubjects={reportData.subjects.strong}
                  weakSubjects={reportData.subjects.weak}
                />
              </div>
            )}

            {/* 목표 진행률 */}
            {reportData.goals.goals.length > 0 && (
              <div className="mb-8">
                <GoalProgressSection goals={reportData.goals.goals} />
              </div>
            )}

            {/* 콘텐츠 진행률 */}
            {reportData.content.progressList.length > 0 && (
              <div className="mb-8">
                <ContentProgressSection progressList={reportData.content.progressList} />
              </div>
            )}

            {/* 히스토리 */}
            {reportData.history.events.length > 0 && (
              <div className="mb-8">
                <MonthlyHistorySection events={reportData.history.events} />
              </div>
            )}
          </>
        )}
      </section>
    );
  } catch (error) {
    console.error("[report/monthly] 페이지 로드 실패", error);
    return (
      <section className={getContainerClass("DASHBOARD", "lg")}>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">오류가 발생했습니다</h2>
          <p className="text-sm text-red-700 mb-4">
            데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          <Link
            href="/report/monthly"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            새로고침
          </Link>
        </div>
      </section>
    );
  }
}

