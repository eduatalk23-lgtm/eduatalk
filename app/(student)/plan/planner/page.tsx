import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * 학생용 플래너 페이지
 * - 활성 캘린더가 있으면 /plan/calendar로 리다이렉트
 * - 캘린더가 없으면 안내 메시지 표시
 */
export default async function StudentPlannerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  // 활성 캘린더 조회 (리다이렉트 판단용)
  const supabase = await createSupabaseServerClient();
  const { data: calendars } = await supabase
    .from('calendars')
    .select('id')
    .eq('owner_id', user.userId)
    .is('deleted_at', null)
    .in('status', ['active', 'paused'])
    .order('is_student_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  // 캘린더가 있으면 /plan/calendar로 리다이렉트
  if (calendars?.[0]?.id) {
    redirect(`/plan/calendar?calendarId=${calendars[0].id}`);
  }

  // 캘린더가 없으면 안내 메시지
  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">내 플래너</h1>
        <p className="text-sm text-gray-500 mt-1">
          학습 캘린더가 아직 없습니다. 선생님에게 학습 플랜을 요청해보세요.
        </p>
      </div>
    </div>
  );
}
