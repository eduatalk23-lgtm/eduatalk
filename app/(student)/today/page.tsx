import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';
import { getTenantContext } from '@/lib/tenant/getTenantContext';
import { getStudentPlannersAction, getPlannerAction, type Planner } from '@/lib/domains/admin-plan/actions/planners';
import { prefetchAllDockData } from '@/lib/domains/admin-plan/actions/dockPrefetch';
import { formatDateString } from '@/lib/date/calendarUtils';
import { getContainerClass } from '@/lib/constants/layout';
import { EmptyState } from '@/components/molecules/EmptyState';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StudentTodayContent } from './_components/StudentTodayContent';
import type { DailyScheduleInfo } from '@/lib/types/plan';

type TodayPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function TodayPage({ searchParams }: TodayPageProps) {
  // 1. 인증 확인
  const { userId, role } = await getCurrentUserRole();
  if (!userId || role !== 'student') {
    redirect('/login');
  }

  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || '';

  // 2. searchParams 파싱
  const resolvedParams = await searchParams;
  const dateParam = typeof resolvedParams.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(resolvedParams.date)
    ? resolvedParams.date
    : undefined;
  const plannerIdParam = typeof resolvedParams.plannerId === 'string'
    ? resolvedParams.plannerId
    : undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDate = formatDateString(today);
  const selectedDate = dateParam ?? todayDate;

  // 3. 플래너 목록 조회
  let planners: Planner[];
  try {
    const plannersResult = await getStudentPlannersAction(userId, {
      status: ['active', 'paused'],
    });
    planners = plannersResult.data;
  } catch (error) {
    console.error('[TodayPage] 플래너 목록 조회 실패:', error);
    planners = [];
  }

  // 4. 플래너 없으면 EmptyState
  if (planners.length === 0) {
    return (
      <div className={getContainerClass('DASHBOARD', 'md')}>
        <div className="flex flex-col gap-6">
          <h1 className="text-2xl font-bold text-gray-900">오늘의 학습</h1>
          <EmptyState
            icon="📚"
            title="활성화된 플래너가 없습니다"
            description="선생님에게 학습 플랜을 요청해보세요."
          />
        </div>
      </div>
    );
  }

  // 5. 선택 플래너 결정
  const selectedPlannerId = plannerIdParam && planners.some(p => p.id === plannerIdParam)
    ? plannerIdParam
    : planners[0].id;

  // 6. 플래너 상세 (제외일 포함) + plan_groups (daily_schedule용) + Dock 프리페치 병렬 조회
  const supabase = await createSupabaseServerClient();

  const [plannerDetail, planGroupsResult, initialDockData] = await Promise.all([
    getPlannerAction(selectedPlannerId, true).catch((error) => {
      console.error('[TodayPage] 플래너 상세 조회 실패:', error);
      return null;
    }),
    supabase
      .from('plan_groups')
      .select('id, daily_schedule')
      .eq('planner_id', selectedPlannerId)
      .eq('student_id', userId)
      .is('deleted_at', null),
    prefetchAllDockData(userId, selectedDate, selectedPlannerId).catch((error) => {
      console.error('[TodayPage] Dock 프리페치 실패:', error);
      return undefined;
    }),
  ]);

  // daily_schedule 추출
  const plannerDailySchedules: DailyScheduleInfo[][] = (planGroupsResult.data ?? [])
    .map((g) => g.daily_schedule as DailyScheduleInfo[] | null)
    .filter((s): s is DailyScheduleInfo[] => Array.isArray(s) && s.length > 0);

  // 제외일 매핑
  const plannerExclusions = plannerDetail?.exclusions?.map((exc) => ({
    exclusionDate: exc.exclusionDate,
    exclusionType: exc.exclusionType,
    reason: exc.reason,
  }));

  return (
    <div className={getContainerClass('DASHBOARD', 'md')}>
      <Suspense>
        <StudentTodayContent
          studentId={userId}
          tenantId={tenantId}
          planners={planners}
          initialPlannerId={selectedPlannerId}
          initialDate={selectedDate}
          initialDockData={initialDockData}
          plannerDailySchedules={plannerDailySchedules}
          plannerExclusions={plannerExclusions}
        />
      </Suspense>
    </div>
  );
}
