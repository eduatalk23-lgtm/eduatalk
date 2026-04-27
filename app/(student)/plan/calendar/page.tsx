import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { getTenantContext } from '@/lib/tenant/getTenantContext';
import { ensureStudentPrimaryCalendar } from '@/lib/domains/calendar/helpers';
import { fetchCalendarPageData } from '@/lib/domains/admin-plan/actions/calendarPageData';
import { EmptyState } from '@/components/molecules/EmptyState';
import { AdminPlanManagementSkeleton } from '@/app/(admin)/admin/students/[id]/plans/_components/AdminPlanManagementSkeleton';
import { CalendarPageClient } from '@/components/calendar/CalendarPageClient';

/**
 * 학생 캘린더 페이지 (Calendar-First) — Thin Server Shell
 *
 * 서버에서 수행하는 작업을 최소화:
 * 1. 인증 확인 + role 가드
 * 2. tenantId 확보
 * 3. Primary Calendar ID 확보 (없으면 EmptyState)
 *
 * 날짜 의존 데이터(fetchCalendarPageData)는 CalendarPageClient에서
 * React Query로 페칭합니다. (세 캘린더 진입점 공용 컴포넌트)
 *
 * 이로 인해 router.replace('/plan/calendar?date=...') 시
 * 서버 컴포넌트가 재실행되지 않아 race condition이 발생하지 않습니다.
 */
interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function PlanCalendarPage({ searchParams }: Props) {
  // 1. 인증 확인
  const { userId, role } = await getCachedUserRole();
  if (!userId || role !== 'student') {
    redirect('/login');
  }

  const tenantContext = await getTenantContext();
  const tenantId = tenantContext?.tenantId || '';

  // 2. Primary Calendar 확보
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

  // 3. SSR prefetch — CalendarPageClient의 queryKey와 완전히 동일해야 함
  const { date: rawDate } = await searchParams;
  const dateParam = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : undefined;

  const queryClient = new QueryClient();
  try {
    await queryClient.prefetchQuery({
      queryKey: ["calendarPageData", userId, calendarId, dateParam ?? "today"],
      queryFn: () => fetchCalendarPageData(userId, calendarId, dateParam),
    });
  } catch {
    // prefetch 실패 시 클라이언트에서 재fetch — fatal 아님
  }

  // 4. CalendarPageClient에 정적 컨텍스트 + dehydrated state 전달
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="h-[calc(100dvh-4rem)] flex flex-col overflow-hidden">
        <Suspense fallback={<AdminPlanManagementSkeleton />}>
          <CalendarPageClient
            currentUserId={userId}
            studentId={userId}
            studentName="나의 캘린더"
            tenantId={tenantId}
            calendarId={calendarId}
            viewMode="student"
          />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
