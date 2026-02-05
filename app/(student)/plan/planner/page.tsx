import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StudentPlannerSelectionPage } from './_components/StudentPlannerSelectionPage';

async function getStudentName(studentId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('students')
    .select('name')
    .eq('id', studentId)
    .single();

  return data?.name ?? '학생';
}

/**
 * 학생용 플래너 목록 페이지
 * - 학생 자신의 플래너 목록을 표시
 * - 플래너 선택 시 /plan/planner/[plannerId]로 이동
 */
export default async function StudentPlannerPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'student') {
    redirect('/dashboard');
  }

  const studentName = await getStudentName(user.userId);

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">내 플래너</h1>
        <p className="text-sm text-gray-500 mt-1">
          플래너를 선택하여 학습 플랜을 관리하세요
        </p>
      </div>

      {/* 플래너 선택 컴포넌트 */}
      <StudentPlannerSelectionPage
        studentId={user.userId}
        tenantId={user.tenantId ?? ''}
        studentName={studentName}
      />
    </div>
  );
}
