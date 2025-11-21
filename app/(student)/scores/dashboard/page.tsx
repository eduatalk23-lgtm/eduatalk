import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScoreTypeTabs } from "../_components/ScoreTypeTabs";
import { DashboardSubTabs } from "./_components/DashboardSubTabs";
import { fetchSchoolScores, fetchMockScores } from "./_utils/scoreQueries";
import { SummarySection } from "./_components/SummarySection";
import { SemesterChartsSection } from "./_components/SemesterChartsSection";
import { SubjectTrendSection } from "./_components/SubjectTrendSection";
import { MockExamTrendSection } from "./_components/MockExamTrendSection";
import { CompareSection } from "./_components/CompareSection";
import { WeakSubjectSection } from "./_components/WeakSubjectSection";
import { InsightPanel } from "./_components/InsightPanel";
import { Card } from "@/components/ui/Card";
import { IntegratedComparisonChart } from "./_components/IntegratedComparisonChart";
import { ScoreConsistencyAnalysis } from "./_components/ScoreConsistencyAnalysis";

export default async function ScoresDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 내신 및 모의고사 성적 조회
  const [schoolScores, mockScores] = await Promise.all([
    fetchSchoolScores(user.id),
    fetchMockScores(user.id),
  ]);

  const hasData = schoolScores.length > 0 || mockScores.length > 0;

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">성적 대시보드</h1>
        <p className="text-sm text-gray-600">
          내신 및 모의고사 성적을 통합 분석하고 시각화합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 flex flex-col gap-4">
        <ScoreTypeTabs />
        <DashboardSubTabs />
      </div>

      {!hasData ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-6xl">📊</div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                등록된 성적이 없습니다
              </h3>
              <p className="text-sm text-gray-600">
                내신 또는 모의고사 성적을 등록하면 대시보드가 표시됩니다.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/scores/school/1/1"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
              >
                내신 성적 입력
              </Link>
              <Link
                href="/scores/mock/1/3/평가원"
                className="inline-flex items-center justify-center rounded-lg bg-purple-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-purple-700"
              >
                모의고사 성적 입력
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 성적 요약 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">성적 요약</h2>
            <SummarySection
              schoolScores={schoolScores}
              mockScores={mockScores}
            />
          </div>

          {/* 내신 학기별 변화 */}
          {schoolScores.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-900">내신 학기별 변화</h2>
              <Card>
                <SemesterChartsSection schoolScores={schoolScores} />
              </Card>
            </div>
          )}

          {/* 교과별 성적 트렌드 */}
          {schoolScores.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-900">교과별 성적 변화</h2>
              <Card>
                <SubjectTrendSection schoolScores={schoolScores} />
              </Card>
            </div>
          )}

          {/* 모의고사 성적 트렌드 */}
          {mockScores.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-900">모의고사 성적 트렌드</h2>
              <Card>
                <MockExamTrendSection mockScores={mockScores} />
              </Card>
            </div>
          )}

          {/* 내신 vs 모의고사 비교 */}
          {schoolScores.length > 0 && mockScores.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-900">내신 vs 모의고사 비교</h2>
              <Card>
                <CompareSection
                  schoolScores={schoolScores}
                  mockScores={mockScores}
                />
              </Card>
            </div>
          )}

          {/* 통합 비교 분석 */}
          {schoolScores.length > 0 && mockScores.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold text-gray-900">통합 비교 분석</h2>
              <Card>
                <IntegratedComparisonChart
                  schoolScores={schoolScores}
                  mockScores={mockScores}
                />
              </Card>
            </div>
          )}

          {/* 성적 일관성 분석 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">성적 일관성 분석</h2>
            <ScoreConsistencyAnalysis
              schoolScores={schoolScores}
              mockScores={mockScores}
            />
          </div>

          {/* 취약 과목 분석 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">취약 과목 분석</h2>
            <WeakSubjectSection
              schoolScores={schoolScores}
              mockScores={mockScores}
            />
          </div>

          {/* 학습 인사이트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">학습 인사이트</h2>
            <InsightPanel
              schoolScores={schoolScores}
              mockScores={mockScores}
            />
          </div>
        </div>
      )}
    </section>
  );
}
