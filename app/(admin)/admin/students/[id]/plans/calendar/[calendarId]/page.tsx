import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminPlanManagementSkeleton } from '../../_components/AdminPlanManagementSkeleton';
import { CalendarPageClient } from '@/components/calendar/CalendarPageClient';
import { StudentSwitcher } from '@/app/(admin)/admin/calendar/_components/StudentSwitcher';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { ensureTenantPrimaryCalendar, subscribeTenantCalendar } from '@/lib/domains/calendar/helpers';
import { fetchCalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';

interface Props {
  params: Promise<{ id: string; calendarId: string }>;
  searchParams: Promise<{ date?: string; openWizard?: string }>;
}

function parseDateParam(raw: string | undefined): string | undefined {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, tenant_id, user_profiles(name)')
    .eq('id', studentId)
    .single();
  if (error || !data) return null;
  const profile = (Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles) as { name: string | null } | null;
  return { id: data.id, tenant_id: data.tenant_id, name: profile?.name ?? '' };
}

/**
 * 관리자 학생 캘린더 상세 페이지 — Thin Server Shell
 *
 * 날짜 의존 데이터(fetchCalendarPageData)는 CalendarPageClient에서
 * React Query로 페칭합니다. router.replace 시 서버 재실행 없음 → race 제거.
 */
export default async function CalendarPlanManagementPage({
  params,
  searchParams,
}: Props) {
  const { id: studentId, calendarId } = await params;
  const { openWizard, date: rawDate } = await searchParams;
  const dateParam = parseDateParam(rawDate);

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

  // 3. 테넌트 캘린더 보장 + 관리자 구독 (상담 이벤트 표시용) — fire-and-forget
  const [currentUser] = await Promise.all([
    getCurrentUser(),
    (async () => {
      const tenantCalendarId = await ensureTenantPrimaryCalendar(student.tenant_id);
      const user = await getCurrentUser();
      if (user?.userId) {
        await subscribeTenantCalendar(user.userId, tenantCalendarId, "writer");
      }
    })(),
  ]);

  // 4. SSR prefetch — CalendarPageClient의 queryKey와 완전히 동일해야 함
  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: ["calendarPageData", student.id, calendarId, dateParam ?? "today"],
      queryFn: () => fetchCalendarPageData(student.id, calendarId, dateParam),
    });
  } catch {
    // prefetch 실패 시 클라이언트에서 재fetch — fatal 아님
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
        <Suspense fallback={<AdminPlanManagementSkeleton />}>
          <CalendarPageClient
            currentUserId={currentUser?.userId ?? ''}
            studentId={student.id}
            studentName={student.name}
            tenantId={student.tenant_id}
            calendarId={calendarId}
            viewMode="admin"
            autoOpenWizard={openWizard === 'true'}
            studentSwitcher={
              <StudentSwitcher
                currentStudentId={student.id}
                currentStudentName={student.name}
              />
            }
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
