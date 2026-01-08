import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPlannerAction } from '@/lib/domains/admin-plan/actions';
import { getPlanGroupsForStudent } from '@/lib/data/planGroups';
import { AdminPlanManagement } from '../_components/AdminPlanManagement';
import { AdminPlanManagementSkeleton } from '../_components/AdminPlanManagementSkeleton';
import { PlannerHeader } from '../_components/PlannerHeader';

interface Props {
  params: Promise<{ id: string; plannerId: string }>;
  searchParams: Promise<{ date?: string; openWizard?: string }>;
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

export default async function PlannerPlanManagementPage({
  params,
  searchParams,
}: Props) {
  const { id: studentId, plannerId } = await params;
  const { date, openWizard } = await searchParams;

  // 1. 학생 정보 조회
  const student = await getStudentInfo(studentId);
  if (!student) {
    notFound();
  }

  // 2. 플래너 조회 (관계 데이터 포함)
  const planner = await getPlannerAction(plannerId, true);
  if (!planner) {
    notFound();
  }

  // 3. 플래너가 해당 학생의 것인지 검증
  if (planner.studentId !== studentId) {
    notFound();
  }

  const targetDate = date ?? new Date().toISOString().split('T')[0];

  // 4. 활성 플랜 그룹 조회
  const activePlanGroups = await getPlanGroupsForStudent({
    studentId,
    status: 'active',
  });
  const activePlanGroupId = activePlanGroups[0]?.id ?? null;

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 플래너 헤더: 뒤로가기 + 플래너 정보 */}
      <PlannerHeader
        studentId={studentId}
        studentName={student.name}
        planner={planner}
      />

      {/* 플랜 관리 컴포넌트 */}
      <Suspense fallback={<AdminPlanManagementSkeleton />}>
        <AdminPlanManagement
          studentId={student.id}
          studentName={student.name}
          tenantId={student.tenant_id}
          initialDate={targetDate}
          activePlanGroupId={activePlanGroupId}
          selectedPlannerId={plannerId}
          autoOpenWizard={openWizard === 'true'}
        />
      </Suspense>
    </div>
  );
}
