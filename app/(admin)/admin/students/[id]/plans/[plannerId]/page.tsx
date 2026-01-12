import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlannerAction } from '@/lib/domains/admin-plan/actions';
import { AdminPlanManagement } from '../_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '../_components/AdminPlanManagementSkeleton';
import { PlannerHeader } from '../_components/PlannerHeader';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import type { DailyScheduleInfo } from '@/lib/types/plan';

interface Props {
  params: Promise<{ id: string; plannerId: string }>;
  searchParams: Promise<{ date?: string; openWizard?: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function PlannerPlanManagementPage({
  params,
  searchParams,
}: Props) {
  const { id: studentId, plannerId } = await params;
  const { date, openWizard } = await searchParams;

  // 1. 학생 정보 조회
  const student = await getStudentInfo(studentId);
  if (!student) {
    notFound();
  }

  // 2. 플래너 조회 (관계 데이터 포함)
  const planner = await getPlannerAction(plannerId, true);
  if (!planner) {
    notFound();
  }

  // 3. 플래너가 해당 학생의 것인지 검증
  if (planner.studentId !== studentId) {
    notFound();
  }

  const targetDate = date ?? getTodayInTimezone();

  // 4. 해당 플래너의 플랜 그룹 조회 (활성 그룹 ID + daily_schedule)
  const supabase = await createSupabaseServerClient();
  const { data: plannerGroups } = await supabase
    .from('plan_groups')
    .select('id, status, daily_schedule')
    .eq('planner_id', plannerId)
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // 현재 플래너의 활성 플랜 그룹 ID 추출
  const activePlanGroupId = plannerGroups?.find(g => g.status === 'active')?.id ?? null;

  // daily_schedule 추출 (여러 그룹이 있을 수 있음)
  const plannerDailySchedules: DailyScheduleInfo[][] = (plannerGroups ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  // 6. 플래너 제외일 매핑
  const plannerExclusions = planner.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusionDate,
    exclusionType: exc.exclusionType,
    reason: exc.reason,
  })) ?? [];

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 플래너 헤더: 뒤로가기 + 플래너 정보 */}
      <PlannerHeader
        studentId={studentId}
        studentName={student.name}
        planner={planner}
      />

      {/* 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
          selectedPlannerId={plannerId}
          autoOpenWizard={openWizard === 'true'}
          plannerDailySchedules={plannerDailySchedules}
          plannerExclusions={plannerExclusions}
        />
      </Suspense>
    </div>
  );
}
