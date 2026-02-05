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
import { PlanListSectionClient } from "./_components/PlanListSectionClient";
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
import { ConnectionCodeSection } from "./_components/ConnectionCodeSection";
import { FamilySection } from "./_components/FamilySection";
import { FamilySectionSkeleton } from "./_components/FamilySectionSkeleton";
import { TimeManagementSection } from "./_components/time-management/TimeManagementSection";
import { TimeManagementSectionSkeleton } from "./_components/time-management/TimeManagementSectionSkeleton";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

type TabType = "basic" | "plan" | "content" | "score" | "session" | "analysis" | "consulting" | "attendance" | "time";

export default async function AdminStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { userId, role, tenantId } = await getCurrentUserRole();

  if (!userId || !isAdminRole(role)) {
    redirect("/login");
  }

  const { id: studentId } = await params;
  const paramsObj = await searchParams;
  const defaultTab: TabType = (paramsObj.tab as TabType) || "basic";

  // 학생 정보 통합 조회 (3개 테이블)
  // 관리자는 memo와 is_active 필드도 조회해야 함
  // RLS 정책을 우회하기 위해 Admin Client 사용
  const supabase = await createSupabaseServerClient();
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const adminClient = createSupabaseAdminClient();
  
  if (!adminClient) {
    throw new Error("Admin client를 초기화할 수 없습니다. SUPABASE_SERVICE_ROLE_KEY를 확인해주세요.");
  }
  
  const [studentResult, profileResult, careerGoalResult] = await Promise.all([
    supabase
      .from("students")
      .select("id,name,grade,class,birth_date,school_id,school_name,school_type,division,memo,status,is_active,created_at,updated_at")
      .eq("id", studentId)
      .maybeSingle(),
    adminClient
      .from("student_profiles")
      .select("*")
      .eq("id", studentId)
      .maybeSingle(),
    adminClient
      .from("student_career_goals")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (studentResult.error || !studentResult.data) {
    notFound();
  }

  const student = studentResult.data;
  const profile = profileResult.data;
  const careerGoal = careerGoalResult.data;

  // 이메일 조회
  const { getAuthUserMetadata } = await import("@/lib/utils/authUserMetadata");
  const userMetadata = await getAuthUserMetadata(adminClient, [studentId]);
  const email = userMetadata.get(studentId)?.email ?? null;

  // 통합 데이터 구성
  const studentInfoData: StudentInfoData = {
    // students 테이블
    id: student.id,
    name: student.name,
    grade: student.grade,
    class: student.class,
    birth_date: student.birth_date,
    school_id: student.school_id,
    school_name: student.school_name,
    school_type: student.school_type as "MIDDLE" | "HIGH" | "UNIVERSITY" | null,
    division: student.division as "고등부" | "중등부" | "기타" | null,
    memo: student.memo ?? null,
    status: student.status as "enrolled" | "on_leave" | "graduated" | "transferred" | null,
    is_active: student.is_active ?? true,
    // student_profiles 테이블
    gender: profile?.gender as "남" | "여" | null,
    phone: profile?.phone ?? null,
    mother_phone: profile?.mother_phone ?? null,
    father_phone: profile?.father_phone ?? null,
    address: profile?.address ?? null,
    emergency_contact: profile?.emergency_contact ?? null,
    emergency_contact_phone: profile?.emergency_contact_phone ?? null,
    medical_info: profile?.medical_info ?? null,
    // student_career_goals 테이블
    exam_year: careerGoal?.exam_year ?? null,
    curriculum_revision: careerGoal?.curriculum_revision as "2009 개정" | "2015 개정" | "2022 개정" | null,
    desired_university_ids: careerGoal?.desired_university_ids ?? null,
    desired_career_field: careerGoal?.desired_career_field ?? null,
  };

  return (
    <StudentDetailWrapper studentId={studentId} studentName={student.name}>
      <PageContainer widthType="LIST">
        <div className="flex flex-col gap-6 md:gap-8">
          <PageHeader
            title={`${student.name ?? "이름 없음"} 학생 상세`}
            backHref="/admin/students"
            backLabel="학생 목록으로"
          />

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
              <ConnectionCodeSection studentId={studentId} />
              <StudentInfoEditForm
                studentId={studentId}
                studentName={student.name}
                isActive={student.is_active ?? true}
                initialData={studentInfoData}
                isAdmin={role === "admin"}
                studentEmail={email}
              />
              <Suspense fallback={<FamilySectionSkeleton />}>
                <FamilySection studentId={studentId} />
              </Suspense>
              <Suspense fallback={<ParentLinksSectionSkeleton />}>
                <ParentLinksSection studentId={studentId} />
              </Suspense>
            </div>
          </TabContent>

          {/* 학습계획 탭 */}
          <TabContent tab="plan">
            <PlanListSectionClient
              studentId={studentId}
              tenantId={tenantId}
              studentName={student.name ?? ""}
            >
              <Suspense fallback={<PlanListSectionSkeleton />}>
                <PlanListSection studentId={studentId} tenantId={tenantId} />
              </Suspense>
            </PlanListSectionClient>
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

          {/* 시간관리 탭 */}
          <TabContent tab="time">
            <Suspense fallback={<TimeManagementSectionSkeleton />}>
              <TimeManagementSection studentId={studentId} />
            </Suspense>
          </TabContent>
        </StudentDetailTabs>
        </div>
      </PageContainer>
    </StudentDetailWrapper>
  );
}
