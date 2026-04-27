import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
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
import { AdminPlanManagementSkeleton } from '@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementSkeleton';
import { CalendarPageClient } from '@/components/calendar/CalendarPageClient';
import { StudentSwitcher } from './_components/StudentSwitcher';
import { AdminCalendarNoStudentShell } from './_components/AdminCalendarNoStudentShell';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ student?: string; date?: string }>;
}

function parseDateParam(raw: string | undefined): string | undefined {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

/**
 * 관리자 캘린더 페이지 — Thin Server Shell
 *
 * URL: /admin/calendar
 * - ?student 없음 → 관리자 본인 캘린더 (personal 모드)
 * - ?student={studentId} → 학생 캘린더 조회 (admin 모드)
 *
 * 날짜 의존 데이터(fetchCalendarPageData)는 CalendarPageClient에서
 * React Query로 페칭합니다. router.replace 시 서버 재실행 없음 → race 제거.
 *
 * 성능 최적화:
 * - Admin Layout이 이미 role 검증 → Page에서 중복 guard 제거 (React.cache hit ~0ms)
 * - ensure 호출 병렬화 (cache hit ~0ms)
 * - subscribeTenantCalendar는 fire-and-forget (렌더 블로킹 제거)
 */
export default async function AdminCalendarPage({ searchParams }: Props) {
  const { userId, tenantId } = await getCachedUserRole();

  if (!userId || !tenantId) {
    redirect('/login');
  }

  const { student: studentId, date: rawDate } = await searchParams;
  const dateParam = parseDateParam(rawDate);

  // ── 학생 미선택: 관리자 본인 캘린더 (personal 모드) ──
  if (!studentId) {
    const [calendarId, tenantCalendarId, adminProfile] = await Promise.all([
      ensureAdminPrimaryCalendar(userId, tenantId),
      ensureTenantPrimaryCalendar(tenantId),
      getCachedUserProfile(userId),
    ]);

    const adminName = adminProfile?.name ?? '관리자';

    subscribeTenantCalendar(userId, tenantCalendarId, "writer").catch(() => {});

    const queryClient = new QueryClient();
    try {
      await queryClient.prefetchQuery({
        queryKey: ["calendarPageData", userId, calendarId, dateParam ?? "today"],
        queryFn: () => fetchCalendarPageData(userId, calendarId, dateParam),
      });
    } catch {
      // prefetch 실패 시 클라이언트에서 재fetch — fatal 아님
    }

    const studentSwitcher = (
      <StudentSwitcher
        currentStudentId={userId}
        currentStudentName={`${adminName} (나)`}
      />
    );

    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
          <Suspense fallback={<AdminPlanManagementSkeleton />}>
            <CalendarPageClient
              currentUserId={userId}
              studentId={userId}
              studentName={adminName}
              tenantId={tenantId}
              calendarId={calendarId}
              viewMode="personal"
              studentSwitcher={studentSwitcher}
            />
          </Suspense>
        </div>
      </HydrationBoundary>
    );
  }

  // ── 학생 선택: 학생 캘린더 조회 (admin 모드) ──
  const supabase = await createSupabaseServerClient();
  const [{ data: studentRaw }, tenantCalendarId] = await Promise.all([
    supabase
      .from('students')
      .select('id, tenant_id, user_profiles(name)')
      .eq('id', studentId)
      .single(),
    ensureTenantPrimaryCalendar(tenantId),
  ]);

  const student = studentRaw
    ? {
        id: studentRaw.id,
        tenant_id: studentRaw.tenant_id,
        name: (
          (Array.isArray(studentRaw.user_profiles)
            ? studentRaw.user_profiles[0]
            : studentRaw.user_profiles) as { name: string | null } | null
        )?.name ?? '',
      }
    : null;

  if (!student) {
    return <AdminCalendarNoStudentShell />;
  }

  const calendarId = await ensureStudentPrimaryCalendar(student.id, student.tenant_id);

  subscribeTenantCalendar(userId, tenantCalendarId, "writer").catch(() => {});

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: ["calendarPageData", student.id, calendarId, dateParam ?? "today"],
      queryFn: () => fetchCalendarPageData(student.id, calendarId, dateParam),
    });
  } catch {
    // prefetch 실패 시 클라이언트에서 재fetch — fatal 아님
  }

  const studentSwitcher = (
    <StudentSwitcher
      currentStudentId={student.id}
      currentStudentName={student.name}
    />
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
        <Suspense fallback={<AdminPlanManagementSkeleton />}>
          <CalendarPageClient
            currentUserId={userId}
            studentId={student.id}
            studentName={student.name}
            tenantId={student.tenant_id}
            calendarId={calendarId}
            viewMode="admin"
            studentSwitcher={studentSwitcher}
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
