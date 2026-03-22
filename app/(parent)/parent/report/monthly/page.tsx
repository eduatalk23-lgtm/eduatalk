
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { getLinkedStudents, canAccessStudent } from "../../../_utils";
import { getMonthlyReportData } from "@/lib/reports/monthly";
import { MonthlySummaryHeader } from "@/app/(student)/report/monthly/_components/MonthlySummaryHeader";
import { MonthlyCharts } from "@/app/(student)/report/monthly/_components/MonthlyCharts";
import { SubjectAnalysisSection } from "@/app/(student)/report/monthly/_components/SubjectAnalysisSection";
import { GoalProgressSection } from "@/app/(student)/report/monthly/_components/GoalProgressSection";
import { ContentProgressSection } from "@/app/(student)/report/monthly/_components/ContentProgressSection";
import { MonthlyHistorySection } from "@/app/(student)/report/monthly/_components/MonthlyHistorySection";
import { MonthNavigation } from "@/app/(student)/report/monthly/_components/MonthNavigation";
import { StudentSelector } from "../../_components/StudentSelector";
import Link from "next/link";
import { EmptyState } from "@/components/molecules/EmptyState";
import { getContainerClass } from "@/lib/constants/layout";
import { fetchParentRecordProgress } from "@/lib/domains/student-record/actions/parentRecord";
import { StudentRecordProgressSection } from "./_components/StudentRecordProgressSection";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ParentMonthlyReportPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { userId, role } = await getCachedUserRole();

  if (!userId || role !== "parent") {
    redirect("/login");
  }

  // 연결된 학생 목록 조회
  const linkedStudents = await getLinkedStudents(supabase, userId);

  if (linkedStudents.length === 0) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-2 rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-yellow-900">
            연결된 자녀가 없습니다
          </h2>
          <p className="text-sm text-yellow-700">
            관리자에게 자녀 연결을 요청해주세요.
          </p>
        </div>
      </section>
    );
  }

  // 선택된 학생 ID
  const selectedStudentId =
    params.studentId || linkedStudents[0]?.id || null;

  if (!selectedStudentId) {
    redirect("/parent/report/monthly");
  }

  // 접근 권한 확인
  const hasAccess = await canAccessStudent(
    supabase,
    userId,
    selectedStudentId
  );

  if (!hasAccess) {
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-xl font-semibold text-red-900">
            접근 권한이 없습니다
          </h2>
        </div>
      </section>
    );
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
    const [reportData, recordProgressRes] = await Promise.all([
      getMonthlyReportData(supabase, selectedStudentId, monthDate),
      fetchParentRecordProgress(selectedStudentId),
    ]);

    const recordProgress = recordProgressRes.success ? recordProgressRes.data : null;

    const hasData =
      reportData.totals.studyMinutes > 0 ||
      reportData.totals.completionRate > 0 ||
      reportData.goals.totalGoals > 0;

    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-semibold text-gray-900">월간 학습 리포트</h1>
              <p className="text-sm text-gray-500">{reportData.period.monthLabel}</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/parent/dashboard"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                대시보드로 돌아가기
              </Link>
            </div>
          </div>

          {/* 학생 선택 */}
          <div>
            <StudentSelector
              students={linkedStudents}
              selectedStudentId={selectedStudentId}
            />
          </div>

          {hasData && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
              자녀의 월간 학습 리포트입니다. 상담이나 공유용으로 활용해 보세요.
            </div>
          )}

          {/* 월 네비게이션 */}
          <div>
            <MonthNavigation currentMonth={monthDate} />
          </div>

          {!hasData ? (
            <div className="flex flex-col gap-8">
              <EmptyState
                title="이번 달 아직 학습 기록이 없습니다"
                description="학습을 시작하면 월간 리포트가 자동으로 생성됩니다."
                actionLabel="대시보드로 돌아가기"
                actionHref="/parent/dashboard"
                icon="📊"
              />
              {/* 학습 데이터 없어도 생기부 진행률은 표시 */}
              {recordProgress && (
                <StudentRecordProgressSection progress={recordProgress} />
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-8">
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
              <div>
                <MonthlyCharts reportData={reportData} />
              </div>

              {/* 과목 분석 */}
              {(reportData.subjects.strong.length > 0 || reportData.subjects.weak.length > 0) && (
                <div>
                  <SubjectAnalysisSection
                    strongSubjects={reportData.subjects.strong}
                    weakSubjects={reportData.subjects.weak}
                  />
                </div>
              )}

              {/* 목표 진행률 */}
              {reportData.goals.goals.length > 0 && (
                <div>
                  <GoalProgressSection goals={reportData.goals.goals} />
                </div>
              )}

              {/* 콘텐츠 진행률 */}
              {reportData.content.progressList.length > 0 && (
                <div>
                  <ContentProgressSection progressList={reportData.content.progressList} />
                </div>
              )}

              {/* G2-7: 생기부 진행 현황 */}
              {recordProgress && (
                <div>
                  <StudentRecordProgressSection progress={recordProgress} />
                </div>
              )}

              {/* 히스토리 */}
              {reportData.history.events.length > 0 && (
                <div>
                  <MonthlyHistorySection events={reportData.history.events} />
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  } catch (error) {
    console.error("[parent/report/monthly] 페이지 로드 실패", error);
    return (
      <section className={getContainerClass("DASHBOARD", "md")}>
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-lg font-semibold text-red-900">오류가 발생했습니다</h2>
          <p className="text-sm text-red-700">
            데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          <Link
            href="/parent/report/monthly"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            새로고침
          </Link>
        </div>
      </section>
    );
  }
}

