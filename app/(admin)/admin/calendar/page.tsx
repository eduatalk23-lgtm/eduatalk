import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ensureStudentPrimaryCalendar,
  ensureAdminPrimaryCalendar,
  ensureTenantPrimaryCalendar,
  subscribeTenantCalendar,
} from '@/lib/domains/calendar/helpers';
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
 *
 * 성능 최적화:
 * - ensure 호출 병렬화 (student + tenant 캘린더 동시 보장)
 * - subscribe를 fetchCalendarPageData와 병렬 실행 (블로킹 불필요)
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  const admin = await requireAdminOrConsultant({ requireTenant: true });

  const { student: studentId, date } = await searchParams;

  // ── 학생 미선택: 관리자 본인 캘린더 ──
  if (!studentId) {
    const supabase = await createSupabaseServerClient();

    // admin 이름 조회 + 캘린더 보장을 병렬 실행
    const [adminUser, calendarId, tenantCalendarId] = await Promise.all([
      supabase
        .from('admin_users')
        .select('user_profiles(name)')
        .eq('id', admin.userId)
        .maybeSingle()
        .then((r) => {
          const rawProfile = r.data?.user_profiles;
          const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as { name: string | null } | null;
          return { name: profile?.name ?? null };
        }),
      ensureAdminPrimaryCalendar(admin.userId, admin.tenantId!),
      ensureTenantPrimaryCalendar(admin.tenantId!),
    ]);

    const adminName = adminUser?.name ?? '관리자';

    // subscribe(idempotent upsert)와 데이터 조회를 병렬 실행
    const [pageData] = await Promise.all([
      fetchCalendarPageData(admin.userId, calendarId, date),
      subscribeTenantCalendar(admin.userId, tenantCalendarId, "writer"),
    ]);

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
  const { data: studentRaw } = await supabase
    .from('students')
    .select('id, tenant_id, user_profiles(name)')
    .eq('id', studentId)
    .single();

  const student = studentRaw
    ? {
        id: studentRaw.id,
        tenant_id: studentRaw.tenant_id,
        name: ((Array.isArray(studentRaw.user_profiles) ? studentRaw.user_profiles[0] : studentRaw.user_profiles) as { name: string | null } | null)?.name ?? '',
      }
    : null;

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

  // 학생 + 테넌트 캘린더 보장을 병렬 실행
  const [calendarId, tenantCalendarId] = await Promise.all([
    ensureStudentPrimaryCalendar(student.id, student.tenant_id),
    ensureTenantPrimaryCalendar(student.tenant_id),
  ]);

  // subscribe(idempotent upsert)와 데이터 조회를 병렬 실행
  const [pageData] = await Promise.all([
    fetchCalendarPageData(student.id, calendarId, date),
    subscribeTenantCalendar(admin.userId, tenantCalendarId, "writer"),
  ]);

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
