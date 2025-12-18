import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import PageContainer from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { DashboardSubTabs } from "@/app/(student)/scores/dashboard/_components/DashboardSubTabs";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StudentDetailWrapper } from "./_components/StudentDetailWrapper";
import { StudentDetailTabs } from "./_components/StudentDetailTabs";
import { TabContent } from "./_components/TabContent";
import StudentInfoEditForm from "./_components/StudentInfoEditForm";
import { getStudentById } from "@/lib/data/students";
import { getStudentProfileById } from "@/lib/data/studentProfiles";
import { getStudentCareerGoalById } from "@/lib/data/studentCareerGoals";
import type { StudentInfoData } from "./_types/studentFormTypes";
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
import { ParentLinksSection } from "./_components/ParentLinksSection";
import { ParentLinksSectionSkeleton } from "./_components/ParentLinksSectionSkeleton";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type TabType = "basic" | "plan" | "content" | "score" | "session" | "analysis" | "consulting" | "attendance";

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
  const defaultTab: TabType = (paramsObj.tab as TabType) || "basic";

  // 학생 정보 통합 조회 (3개 테이블)
  // 관리자는 memo와 is_active 필드도 조회해야 함
  const supabase = await createSupabaseServerClient();
  const [studentResult, profile, careerGoal] = await Promise.all([
    supabase
      .from("students")
      .select("id,name,grade,class,birth_date,school_id,school_type,division,memo,status,is_active,created_at,updated_at")
      .eq("id", studentId)
      .maybeSingle(),
    getStudentProfileById(studentId),
    getStudentCareerGoalById(studentId),
  ]);

  if (studentResult.error || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data;

  // 통합 데이터 구성
  const studentInfoData: StudentInfoData = {
    // students 테이블
    id: student.id,
    name: student.name,
    grade: student.grade,
    class: student.class,
    birth_date: student.birth_date,
    school_id: student.school_id,
    school_type: student.school_type as "MIDDLE" | "HIGH" | "UNIVERSITY" | null,
    division: student.division as "고등부" | "중등부" | "기타" | null,
    memo: student.memo ?? null,
    status: student.status as "enrolled" | "on_leave" | "graduated" | "transferred" | null,
    is_active: student.is_active ?? true,
    // student_profiles 테이블
    gender: profile?.gender,
    phone: profile?.phone,
    mother_phone: profile?.mother_phone,
    father_phone: profile?.father_phone,
    address: profile?.address,
    emergency_contact: profile?.emergency_contact,
    emergency_contact_phone: profile?.emergency_contact_phone,
    medical_info: profile?.medical_info,
    // student_career_goals 테이블
    exam_year: careerGoal?.exam_year,
    curriculum_revision: careerGoal?.curriculum_revision,
    desired_university_ids: careerGoal?.desired_university_ids,
    desired_career_field: careerGoal?.desired_career_field,
  };

  return (
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <PageContainer widthType="LIST">
        <div className="flex flex-col gap-6 md:gap-8">
          <PageHeader title={`${student.name ?? "이름 없음"} 학생 상세`} />

          {/* 위험 분석 및 추천 (항상 표시) */}
          <div className="grid gap-6 md:grid-cols-2">
            <RiskCard studentId={studentId} />
            <RecommendationPanel studentId={studentId} />
          </div>

          {/* 탭 구조 */}
          <StudentDetailTabs defaultTab={defaultTab}>
          {/* 기본정보 탭 */}
          <TabContent tab="basic">
            <div className="space-y-6">
              <StudentInfoEditForm
                studentId={studentId}
                studentName={student.name}
                isActive={student.is_active ?? true}
                initialData={studentInfoData}
                isAdmin={role === "admin"}
              />
              <Suspense fallback={<ParentLinksSectionSkeleton />}>
                <ParentLinksSection studentId={studentId} />
              </Suspense>
            </div>
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
              <ConsultingNotesSection
                studentId={studentId}
                consultantId={userId}
              />
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
      </PageContainer>
    </StudentDetailWrapper>
  );
}
