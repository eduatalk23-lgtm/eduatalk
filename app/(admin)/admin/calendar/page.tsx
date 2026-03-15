import { redirect } from 'next/navigation';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { getCachedUserProfile } from '@/lib/auth/cachedUserProfile';
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
 * - Admin Layout이 이미 role 검증 → Page에서 중복 guard 제거 (React.cache hit ~0ms)
 * - ensure 호출 병렬화 (cache hit ~0ms)
 * - 이름 조회를 fetchCalendarPageData와 병렬 실행
 * - subscribeTenantCalendar는 fire-and-forget (렌더 블로킹 제거)
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  // Admin Layout에서 이미 role 검증 완료 → getCachedUserRole()은 React.cache hit (~0ms)
  const { userId, tenantId } = await getCachedUserRole();

  if (!userId || !tenantId) {
    redirect('/login');
  }

  const { student: studentId, date } = await searchParams;

  // ── 학생 미선택: 관리자 본인 캘린더 ──
  if (!studentId) {
    // 캘린더 ID 보장 (cache hit 시 ~0ms)
    const [calendarId, tenantCalendarId] = await Promise.all([
      ensureAdminPrimaryCalendar(userId, tenantId!),
      ensureTenantPrimaryCalendar(tenantId!),
    ]);

    // 데이터 조회 + 이름 조회를 병렬 실행
    // getCachedUserProfile: Admin Layout에서 이미 호출 → React.cache HIT (~0ms)
    const [pageData, adminProfile] = await Promise.all([
      fetchCalendarPageData(userId, calendarId, date),
      getCachedUserProfile(userId),
    ]);

    const adminName = adminProfile?.name ?? '관리자';

    // subscribe는 fire-and-forget (idempotent upsert, 결과 미사용)
    subscribeTenantCalendar(userId, tenantCalendarId, "writer").catch(() => {});

    return (
      <AdminCalendarWrapper
        studentId={userId}
        studentName={adminName}
        tenantId={tenantId!}
        calendarId={calendarId}
        pageData={pageData}
        isPersonalMode
        currentUserId={userId}
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

  const pageData = await fetchCalendarPageData(student.id, calendarId, date);

  // subscribe는 fire-and-forget (idempotent upsert, 결과 미사용)
  subscribeTenantCalendar(userId, tenantCalendarId, "writer").catch(() => {});

  return (
    <AdminCalendarWrapper
      studentId={student.id}
      studentName={student.name}
      tenantId={student.tenant_id}
      calendarId={calendarId}
      pageData={pageData}
      currentUserId={userId}
    />
  );
}
