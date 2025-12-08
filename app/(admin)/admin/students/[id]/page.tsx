import { redirect, notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentDetailWrapper } from "./_components/StudentDetailWrapper";
import { StudentDetailTabs } from "./_components/StudentDetailTabs";
import { TabContent } from "./_components/TabContent";
import { BasicInfoSection } from "./_components/BasicInfoSection";
import { PlanListSection } from "./_components/PlanListSection";
import { ContentListSection } from "./_components/ContentListSection";
import { ScoreTrendSection } from "./_components/ScoreTrendSection";
import { SessionListSection } from "./_components/SessionListSection";
import { AnalysisReportSection } from "./_components/AnalysisReportSection";
import { ConsultingNotesSection } from "./_components/ConsultingNotesSection";
import { AttendanceSection } from "./_components/AttendanceSection";
import { RiskCard } from "./_components/RiskCard";
import { RecommendationPanel } from "./_components/RecommendationPanel";
import { PlanListSectionSkeleton } from "./_components/PlanListSectionSkeleton";
import { ContentListSectionSkeleton } from "./_components/ContentListSectionSkeleton";
import { ScoreTrendSectionSkeleton } from "./_components/ScoreTrendSectionSkeleton";
import { SessionListSectionSkeleton } from "./_components/SessionListSectionSkeleton";
import { AnalysisReportSectionSkeleton } from "./_components/AnalysisReportSectionSkeleton";
import { ConsultingNotesSectionSkeleton } from "./_components/ConsultingNotesSectionSkeleton";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

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
  const defaultTab = (paramsObj.tab as any) || "basic";

  const supabase = await createSupabaseServerClient();

  // 학생 정보 조회
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id,name,grade,class,birth_date,is_active")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError || !student) {
    notFound();
  }

  return (
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="text-h1 text-gray-900">
          {student.name ?? "이름 없음"} 학생 상세
        </h1>
      </div>

      {/* 위험 분석 및 추천 (항상 표시) */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <RiskCard studentId={studentId} />
        <RecommendationPanel studentId={studentId} />
      </div>

      {/* 탭 구조 */}
      <StudentDetailTabs defaultTab={defaultTab}>
        {/* 기본정보 탭 */}
        <TabContent tab="basic">
          <BasicInfoSection student={student} isAdmin={role === "admin"} />
        </TabContent>

        {/* 학습계획 탭 */}
        <TabContent tab="plan">
          <Suspense fallback={<PlanListSectionSkeleton />}>
            <PlanListSection studentId={studentId} />
          </Suspense>
        </TabContent>

        {/* 콘텐츠 탭 */}
        <TabContent tab="content">
          <Suspense fallback={<ContentListSectionSkeleton />}>
            <ContentListSection studentId={studentId} />
          </Suspense>
        </TabContent>

        {/* 성적 탭 */}
        <TabContent tab="score">
          <Suspense fallback={<ScoreTrendSectionSkeleton />}>
            <ScoreTrendSection studentId={studentId} />
          </Suspense>
        </TabContent>

        {/* 학습기록 탭 */}
        <TabContent tab="session">
          <Suspense fallback={<SessionListSectionSkeleton />}>
            <SessionListSection studentId={studentId} />
          </Suspense>
        </TabContent>

        {/* 분석 리포트 탭 */}
        <TabContent tab="analysis">
          <Suspense fallback={<AnalysisReportSectionSkeleton />}>
            <AnalysisReportSection studentId={studentId} />
          </Suspense>
        </TabContent>

        {/* 상담노트 탭 */}
        <TabContent tab="consulting">
          <Suspense fallback={<ConsultingNotesSectionSkeleton />}>
            <ConsultingNotesSection studentId={studentId} consultantId={userId} />
          </Suspense>
        </TabContent>

        {/* 출석 탭 */}
        <TabContent tab="attendance">
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
        </TabContent>
      </StudentDetailTabs>
      </div>
    </StudentDetailWrapper>
  );
}

