import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentDetailWrapper } from "./_components/StudentDetailWrapper";
import { StudentDetailTabs } from "./_components/StudentDetailTabs";
import { ContentListSection } from "./_components/ContentListSection";
import { ScoreTrendSection } from "./_components/ScoreTrendSection";
import { SessionListSection } from "./_components/SessionListSection";
import { AnalysisReportSection } from "./_components/AnalysisReportSection";
import { AttendanceSection } from "./_components/AttendanceSection";
import { RiskCard } from "./_components/RiskCard";
import { RecommendationPanel } from "./_components/RecommendationPanel";
import { ContentListSectionSkeleton } from "./_components/ContentListSectionSkeleton";
import { ScoreTrendSectionSkeleton } from "./_components/ScoreTrendSectionSkeleton";
import { SessionListSectionSkeleton } from "./_components/SessionListSectionSkeleton";
import { AnalysisReportSectionSkeleton } from "./_components/AnalysisReportSectionSkeleton";
import { TimeManagementSection } from "./_components/time-management/TimeManagementSection";
import { TimeManagementSectionSkeleton } from "./_components/time-management/TimeManagementSectionSkeleton";
import { ScoreSubTabNav } from "./_components/ScoreSubTabNav";
import type { ScoreSubTab } from "./_components/ScoreSubTabNav";
import { AdminScoreInputSection } from "./_components/AdminScoreInputSection";
import { AdminScoreListSection } from "./_components/AdminScoreListSection";

type TabType = "content" | "score" | "session" | "analysis" | "attendance" | "time" | "risk";

export default async function AdminStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const { id: studentId } = await params;
  const paramsObj = await searchParams;
  const VALID_TABS: TabType[] = ["content", "score", "session", "analysis", "attendance", "time", "risk"];
  const rawTab = paramsObj.tab as TabType;
  const defaultTab: TabType = VALID_TABS.includes(rawTab) ? rawTab : "content";

  // 성적 탭 서브탭
  const rawScoreSubTab = paramsObj.scoreSubTab as ScoreSubTab;
  const VALID_SCORE_SUB_TABS: ScoreSubTab[] = ["analysis", "list", "input"];
  const scoreSubTab: ScoreSubTab = VALID_SCORE_SUB_TABS.includes(rawScoreSubTab) ? rawScoreSubTab : "analysis";

  // 학생 기본 정보 조회 (이름 등 헤더/탭에 필요한 최소 데이터)
  const supabase = await createSupabaseServerClient();
  const studentResult = await supabase
    .from("students")
    .select("id, name")
    .eq("id", studentId)
    .maybeSingle();

  if (studentResult.error || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data;

  return (
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <PageContainer widthType="LIST">
        <div className="flex flex-col gap-6 md:gap-8">
          <PageHeader
            title={`${student.name ?? "이름 없음"} 학생 상세`}
            backHref="/admin/students"
            backLabel="학생 목록으로"
          />

          {/* 탭 구조 */}
          <StudentDetailTabs defaultTab={defaultTab}>
            {/* 콘텐츠 탭 */}
            {defaultTab === "content" && (
              <Suspense fallback={<ContentListSectionSkeleton />}>
                <ContentListSection studentId={studentId} />
              </Suspense>
            )}

            {/* 성적 탭 (서브탭: 분석 / 입력) */}
            {defaultTab === "score" && (
              <div className="flex flex-col gap-6">
                <ScoreSubTabNav activeSubTab={scoreSubTab} />
                {scoreSubTab === "analysis" && (
                  <Suspense fallback={<ScoreTrendSectionSkeleton />}>
                    <ScoreTrendSection studentId={studentId} />
                  </Suspense>
                )}
                {scoreSubTab === "list" && (
                  <Suspense fallback={<ScoreTrendSectionSkeleton />}>
                    <AdminScoreListSection studentId={studentId} />
                  </Suspense>
                )}
                {scoreSubTab === "input" && (
                  <Suspense fallback={<ScoreTrendSectionSkeleton />}>
                    <AdminScoreInputSection studentId={studentId} />
                  </Suspense>
                )}
              </div>
            )}

            {/* 학습기록 탭 */}
            {defaultTab === "session" && (
              <Suspense fallback={<SessionListSectionSkeleton />}>
                <SessionListSection studentId={studentId} />
              </Suspense>
            )}

            {/* 분석 리포트 탭 */}
            {defaultTab === "analysis" && (
              <Suspense fallback={<AnalysisReportSectionSkeleton />}>
                <AnalysisReportSection studentId={studentId} />
              </Suspense>
            )}

            {/* 출석 탭 */}
            {defaultTab === "attendance" && (
              <Suspense
                fallback={
                  <div className="rounded-lg border border-gray-200 bg-white p-6">
                    <div className="text-sm text-gray-500">로딩 중...</div>
                  </div>
                }
              >
                <AttendanceSection
                  studentId={studentId}
                  studentName={student.name}
                />
              </Suspense>
            )}

            {/* 시간관리 탭 */}
            {defaultTab === "time" && (
              <Suspense fallback={<TimeManagementSectionSkeleton />}>
                <TimeManagementSection studentId={studentId} />
              </Suspense>
            )}

            {/* 위험도/추천 탭 */}
            {defaultTab === "risk" && (
              <Suspense
                fallback={
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <div className="space-y-3">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-6">
                      <div className="space-y-3">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-200" />
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                      </div>
                    </div>
                  </div>
                }
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <RiskCard studentId={studentId} />
                  <RecommendationPanel studentId={studentId} />
                </div>
              </Suspense>
            )}
          </StudentDetailTabs>
        </div>
      </PageContainer>
    </StudentDetailWrapper>
  );
}
