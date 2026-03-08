import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureStudentPrimaryCalendar, ensureAdminPrimaryCalendar } from '@/lib/domains/calendar/helpers';
import { fetchCalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';
import { AdminCalendarWrapper } from './_components/AdminCalendarWrapper';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ student?: string; date?: string }>;
}

/**
 * 관리자 캘린더 페이지
 *
 * URL: /admin/calendar
 * - ?student 없음 → 관리자 본인 캘린더 (상담/회의/업무 일정)
 * - ?student={studentId} → 학생 캘린더 조회
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  const admin = await requireAdminOrConsultant({ requireTenant: true });

  const { student: studentId, date } = await searchParams;

  // ── 학생 미선택: 관리자 본인 캘린더 ──
  if (!studentId) {
    const supabase = await createSupabaseServerClient();

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', admin.userId)
      .maybeSingle();

    const adminName = adminUser?.name ?? '관리자';
    const calendarId = await ensureAdminPrimaryCalendar(admin.userId, admin.tenantId!);
    const pageData = await fetchCalendarPageData(admin.userId, calendarId, date);

    return (
      <AdminCalendarWrapper
        studentId={admin.userId}
        studentName={adminName}
        tenantId={admin.tenantId!}
        calendarId={calendarId}
        pageData={pageData}
        isPersonalMode
        currentUserId={admin.userId}
      />
    );
  }

  // ── 학생 선택: 학생 캘린더 조회 ──
  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (!student) {
    return (
      <AdminCalendarWrapper
        studentId={null}
        studentName={null}
        tenantId={null}
        calendarId={null}
        pageData={null}
      />
    );
  }

  const calendarId = await ensureStudentPrimaryCalendar(student.id, student.tenant_id);
  const pageData = await fetchCalendarPageData(student.id, calendarId, date);

  return (
    <AdminCalendarWrapper
      studentId={student.id}
      studentName={student.name}
      tenantId={student.tenant_id}
      calendarId={calendarId}
      pageData={pageData}
      currentUserId={admin.userId}
    />
  );
}
