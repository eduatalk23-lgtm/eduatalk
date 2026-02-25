import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminPlanManagement } from '../../_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '../../_components/AdminPlanManagementSkeleton';
import { fetchCalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';

interface Props {
  params: Promise<{ id: string; calendarId: string }>;
  searchParams: Promise<{ date?: string; openWizard?: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();
  if (error || !data) return null;
  return data;
}

export default async function CalendarPlanManagementPage({
  params,
  searchParams,
}: Props) {
  const { id: studentId, calendarId } = await params;
  const { date, openWizard } = await searchParams;

  // 1. 학생 정보 조회
  const student = await getStudentInfo(studentId);
  if (!student) notFound();

  const supabase = await createSupabaseServerClient();

  // 2. 캘린더 존재 + 소유권 검증
  const { data: calendar } = await supabase
    .from('calendars')
    .select('id, owner_id')
    .eq('id', calendarId)
    .is('deleted_at', null)
    .single();

  if (!calendar || calendar.owner_id !== studentId) notFound();

  // 3. 공유 데이터 페칭
  const pageData = await fetchCalendarPageData(studentId, calendarId, date);

  return (
    <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={pageData.targetDate}
          activePlanGroupId={pageData.activePlanGroupId}
          allPlanGroups={pageData.allPlanGroups}
          calendarId={calendarId}
          autoOpenWizard={openWizard === 'true'}
          calendarDailySchedules={pageData.calendarDailySchedules}
          calendarExclusions={pageData.calendarExclusions}
          calendarCalculatedSchedule={pageData.calendarCalculatedSchedule}
          calendarDateTimeSlots={pageData.calendarDateTimeSlots}
          initialDockData={pageData.initialDockData}
          viewMode="admin"
        />
      </Suspense>
    </div>
  );
}
