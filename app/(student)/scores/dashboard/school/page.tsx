import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ScoreTypeTabs } from "../../_components/ScoreTypeTabs";
import { DashboardSubTabs } from "../_components/DashboardSubTabs";
import { fetchSchoolScores } from "../_utils/scoreQueries";
import { SemesterChartsSection } from "../_components/SemesterChartsSection";
import { SubjectTrendSection } from "../_components/SubjectTrendSection";
import { Card } from "@/components/ui/Card";
import { SchoolSummarySection } from "./_components/SchoolSummarySection";
import { SchoolWeakSubjectSection } from "./_components/SchoolWeakSubjectSection";
import { SchoolInsightPanel } from "./_components/SchoolInsightPanel";
import { SchoolDetailedMetrics } from "./_components/SchoolDetailedMetrics";
import { SchoolHeatmapChart } from "./_components/SchoolHeatmapChart";
import { SchoolGradeDistributionChart } from "./_components/SchoolGradeDistributionChart";

export default async function SchoolScoresDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // 내신 성적 조회
  const schoolScores = await fetchSchoolScores(user.id);

  return (
    <section className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">내신 성적 대시보드</h1>
        <p className="text-sm text-gray-600">
          내신 성적을 학년·학기별로 분석하고 시각화합니다.
        </p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mb-6 flex flex-col gap-4">
        <ScoreTypeTabs />
        <DashboardSubTabs />
      </div>

      {schoolScores.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="text-6xl">📚</div>
            <div className="flex flex-col gap-2">
              <h3 className="text-xl font-semibold text-gray-900">
                등록된 내신 성적이 없습니다
              </h3>
              <p className="text-sm text-gray-600">
                내신 성적을 등록하면 대시보드가 표시됩니다.
              </p>
            </div>
            <Link
              href="/scores/school/1/1"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              내신 성적 입력
            </Link>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-8">
          {/* 내신 성적 요약 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">내신 성적 요약</h2>
            <SchoolSummarySection schoolScores={schoolScores} />
          </div>

          {/* 내신 학기별 변화 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">학기별 변화</h2>
            <Card>
              <SemesterChartsSection schoolScores={schoolScores} />
            </Card>
          </div>

          {/* 교과별 성적 트렌드 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">교과별 성적 변화</h2>
            <Card>
              <SubjectTrendSection schoolScores={schoolScores} />
            </Card>
          </div>

          {/* 상세 지표 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">상세 지표</h2>
            <SchoolDetailedMetrics schoolScores={schoolScores} />
          </div>

          {/* 히트맵 및 분포 차트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">히트맵 및 분포 분석</h2>
            <Card>
              <SchoolHeatmapChart schoolScores={schoolScores} />
            </Card>
            <Card>
              <SchoolGradeDistributionChart schoolScores={schoolScores} />
            </Card>
          </div>

          {/* 취약 과목 분석 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">취약 과목 분석</h2>
            <SchoolWeakSubjectSection schoolScores={schoolScores} />
          </div>

          {/* 학습 인사이트 */}
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold text-gray-900">학습 인사이트</h2>
            <SchoolInsightPanel schoolScores={schoolScores} />
          </div>
        </div>
      )}
    </section>
  );
}

