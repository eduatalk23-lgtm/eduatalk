import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlannerAction, prefetchAllDockData } from '@/lib/domains/admin-plan/actions';
import { getStudentName } from '@/lib/data/students';
import { AdminPlanManagement } from '@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementSkeleton';
import { StudentPlannerHeader } from '../_components/StudentPlannerHeader';
import { getTodayInTimezone } from '@/lib/utils/dateUtils';
import { generateScheduleForPlanner } from '@/lib/domains/admin-plan/actions/planCreation/scheduleGenerator';
import type { DailyScheduleInfo } from '@/lib/types/plan';
import type { TimeSlot } from '@/lib/types/plan-generation';

interface Props {
  params: Promise<{ plannerId: string }>;
  searchParams: Promise<{ date?: string; openWizard?: string }>;
}

/**
 * 학생용 플래너 상세 페이지
 * - 학생 자신의 플래너에 대한 플랜 관리
 * - viewMode="student"로 Admin 전용 기능 숨김
 */
export default async function StudentPlannerDetailPage({
  params,
  searchParams,
}: Props) {
  const { plannerId } = await params;
  const { date, openWizard } = await searchParams;

  // 1. 현재 사용자 확인
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  const studentId = user.userId;
  const studentName = await getStudentName(studentId);

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
        study_hours: 0,
        week_number: d.week_number ?? undefined,
        cycle_day_number: d.cycle_day_number ?? undefined,
      }));
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

  // daily_schedule 추출
  const plannerDailySchedules: DailyScheduleInfo[][] = (plannerGroups ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  // 6. 플래너 제외일 매핑
  const plannerExclusions = planner.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusionDate,
    exclusionType: exc.exclusionType,
    reason: exc.reason,
  })) ?? [];

  // 7. Dock 데이터 SSR 프리페치 (초기 로딩 최적화)
  const initialDockData = await prefetchAllDockData(studentId, targetDate, plannerId);

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 플래너 헤더: 뒤로가기 + 플래너 정보 (학생용) */}
      <StudentPlannerHeader planner={planner} />

      {/* 플랜 관리 컴포넌트 (학생 모드) */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={studentId}
          studentName={studentName}
          tenantId={user.tenantId ?? ''}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
          allPlanGroups={allPlanGroups}
          selectedPlannerId={plannerId}
          autoOpenWizard={openWizard === 'true'}
          plannerDailySchedules={plannerDailySchedules}
          plannerExclusions={plannerExclusions}
          plannerCalculatedSchedule={plannerCalculatedSchedule}
          plannerDateTimeSlots={plannerDateTimeSlots}
          initialDockData={initialDockData}
          viewMode="student"
          currentUserId={user.userId}
          selectedPlanner={planner}
        />
      </Suspense>
    </div>
  );
}
