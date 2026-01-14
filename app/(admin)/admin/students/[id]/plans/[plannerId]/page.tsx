import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlannerAction } from '@/lib/domains/admin-plan/actions';
import { AdminPlanManagement } from '../_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '../_components/AdminPlanManagementSkeleton';
import { PlannerHeader } from '../_components/PlannerHeader';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import { generateScheduleForPlanner } from '@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator';
import type { DailyScheduleInfo } from '@/lib/types/plan';
import type { TimeSlot } from '@/lib/types/plan-generation';

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

  // 4. 플래너 기반 스케줄 계산 (플랜 그룹 없이도 주차/일차 정보 표시용)
  let plannerCalculatedSchedule: DailyScheduleInfo[] | undefined;
  let plannerDateTimeSlots: Record<string, TimeSlot[]> | undefined;
  if (planner.periodStart && planner.periodEnd) {
    const scheduleResult = await generateScheduleForPlanner(
      plannerId,
      planner.periodStart,
      planner.periodEnd
    );
    if (scheduleResult.success) {
      plannerCalculatedSchedule = scheduleResult.dailySchedule.map((d) => ({
        date: d.date,
        day_type: d.day_type as DailyScheduleInfo['day_type'],
        study_hours: 0, // 계산된 스케줄에서는 기본값 사용
        week_number: d.week_number ?? undefined,
        cycle_day_number: d.cycle_day_number ?? undefined,
      }));
      // Map을 Object로 변환 (Server→Client 직렬화)
      plannerDateTimeSlots = Object.fromEntries(scheduleResult.dateTimeSlots);
    }
  }

  // 5. 해당 플래너의 플랜 그룹 조회 (전체 목록 + daily_schedule)
  const supabase = await createSupabaseServerClient();
  const { data: plannerGroups } = await supabase
    .from('plan_groups')
    .select('id, name, status, period_start, period_end, plan_purpose, daily_schedule, created_at')
    .eq('planner_id', plannerId)
    .eq('student_id', studentId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // 전체 플랜 그룹 목록 (드롭다운용)
  const allPlanGroups = (plannerGroups ?? []).map(g => ({
    id: g.id,
    name: g.name,
    status: g.status,
    periodStart: g.period_start,
    periodEnd: g.period_end,
    planPurpose: g.plan_purpose,
  }));

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
          allPlanGroups={allPlanGroups}
          selectedPlannerId={plannerId}
          autoOpenWizard={openWizard === 'true'}
          plannerDailySchedules={plannerDailySchedules}
          plannerExclusions={plannerExclusions}
          plannerCalculatedSchedule={plannerCalculatedSchedule}
          plannerDateTimeSlots={plannerDateTimeSlots}
        />
      </Suspense>
    </div>
  );
}
