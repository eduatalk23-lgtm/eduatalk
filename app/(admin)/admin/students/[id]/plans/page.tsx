import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { StudentPlansPageClient } from './_components/StudentPlansPageClient';
import { AdminPlanManagementSkeleton } from './_components/AdminPlanManagementSkeleton';
import { getPlanGroupsForStudent } from '@/lib/data/planGroups';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

export default async function StudentPlansPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { date } = await searchParams;

  const student = await getStudentInfo(id);

  if (!student) {
    notFound();
  }

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  // 활성 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId: id,
    status: 'active',
  });
  const activePlanGroupId = activePlanGroups[0]?.id ?? null;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          학생의 학습 플랜을 관리하고 재분배할 수 있습니다
        </p>
      </div>

      {/* 플래너 & 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <StudentPlansPageClient
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
        />
      </Suspense>
    </div>
  );
}
