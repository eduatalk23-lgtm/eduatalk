import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScoreTypeTabs } from "../../_components/ScoreTypeTabs";
import { DashboardSubTabs } from "../_components/DashboardSubTabs";
import { fetchMockScores } from "../_utils/scoreQueries";
import { Card } from "@/components/ui/Card";
import { MockExamTrendSection } from "../_components/MockExamTrendSection";
import { MockSummarySection } from "./_components/MockSummarySection";
import { MockWeakSubjectSection } from "./_components/MockWeakSubjectSection";
import { MockInsightPanel } from "./_components/MockInsightPanel";
import { MockDetailedMetrics } from "./_components/MockDetailedMetrics";
import { MockExamTypeComparisonChart } from "./_components/MockExamTypeComparisonChart";
import { MockPercentileDistributionChart } from "./_components/MockPercentileDistributionChart";

export default async function MockScoresDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 모의고사 성적 조회
  const mockScores = await fetchMockScores(user.id);

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">모의고사 성적 대시보드</h1>
        <p className="text-sm text-gray-600">
          모의고사 성적을 시험 유형·회차별로 분석하고 시각화합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 flex flex-col gap-4">
        <ScoreTypeTabs />
        <DashboardSubTabs />
      </div>

      {mockScores.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-6xl">📊</div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                등록된 모의고사 성적이 없습니다
              </h3>
              <p className="text-sm text-gray-600">
                모의고사 성적을 등록하면 대시보드가 표시됩니다.
              </p>
            </div>
            <Link
              href="/scores/mock/1/3/평가원"
              className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
            >
              모의고사 성적 입력
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 모의고사 성적 요약 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">모의고사 성적 요약</h2>
            <MockSummarySection mockScores={mockScores} />
          </div>

          {/* 모의고사 성적 트렌드 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">모의고사 성적 트렌드</h2>
            <Card>
              <MockExamTrendSection mockScores={mockScores} />
            </Card>
          </div>

          {/* 상세 지표 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">상세 지표</h2>
            <MockDetailedMetrics mockScores={mockScores} />
          </div>

          {/* 시험 유형별 비교 및 분포 차트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">시험 유형별 비교 및 분포 분석</h2>
            <Card>
              <MockExamTypeComparisonChart mockScores={mockScores} />
            </Card>
            <Card>
              <MockPercentileDistributionChart mockScores={mockScores} />
            </Card>
          </div>

          {/* 취약 과목 분석 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">취약 과목 분석</h2>
            <MockWeakSubjectSection mockScores={mockScores} />
          </div>

          {/* 학습 인사이트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">학습 인사이트</h2>
            <MockInsightPanel mockScores={mockScores} />
          </div>
        </div>
      )}
    </section>
  );
}

