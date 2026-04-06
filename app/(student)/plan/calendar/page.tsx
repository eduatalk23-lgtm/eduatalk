import { redirect } from 'next/navigation';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { getTenantContext } from '@/lib/tenant/getTenantContext';
import { ensureStudentPrimaryCalendar } from '@/lib/domains/calendar/helpers';
import { fetchCalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';
import { EmptyState } from '@/components/molecules/EmptyState';
import { AdminPlanManagementClient } from '@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementClient';
import { PlanCalendarProviders } from './PlanCalendarProviders';

type PlanCalendarPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * 학생 캘린더 페이지 (Calendar-First)
 *
 * GCal 스타일 캘린더 뷰. 관리자와 동일한 UI를 viewMode="student"로 렌더링합니다.
 */
export default async function PlanCalendarPage({
  searchParams,
}: PlanCalendarPageProps) {
  // 1. 인증 확인
  const { userId, role } = await getCachedUserRole();
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

  // 3. Primary Calendar 확보
  let calendarId: string;
  try {
    calendarId = await ensureStudentPrimaryCalendar(userId, tenantId);
  } catch (error) {
    console.error('[PlanCalendarPage] Primary Calendar 확보 실패:', error);
    return (
      <div className="h-[calc(100dvh-4rem)] flex items-center justify-center">
        <EmptyState
          icon="📅"
          title="학습 캘린더가 없습니다"
          description="선생님에게 학습 플랜을 요청해보세요."
        />
      </div>
    );
  }

  // 4. 캘린더 데이터 조회 (관리자 페이지와 동일한 데이터 페칭)
  const pageData = await fetchCalendarPageData(userId, calendarId, dateParam);

  // 5. 학생 이름 조회
  const studentName = '나의 캘린더';

  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      <PlanCalendarProviders>
        <AdminPlanManagementClient
          studentId={userId}
          studentName={studentName}
          tenantId={tenantId}
          initialDate={pageData.targetDate}
          activePlanGroupId={pageData.activePlanGroupId}
          allPlanGroups={pageData.allPlanGroups}
          calendarId={calendarId}
          calendarDailySchedules={pageData.calendarDailySchedules}
          calendarExclusions={pageData.calendarExclusions}
          calendarCalculatedSchedule={pageData.calendarCalculatedSchedule}
          calendarDateTimeSlots={pageData.calendarDateTimeSlots}
          viewMode="student"
          currentUserId={userId}
          selectedCalendarSettings={pageData.calendarSettings}
        />
      </PlanCalendarProviders>
    </div>
  );
}
