import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PlannerSelectionPage } from './_components/PlannerSelectionPage';

interface Props {
  params: Promise<{ id: string }>;
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

/**
 * 플래너 선택 페이지
 * - 학생의 플래너 목록을 표시
 * - 플래너 선택 시 /admin/students/[id]/plans/[plannerId]로 이동
 */
export default async function StudentPlansPage({ params }: Props) {
  const { id: studentId } = await params;

  const student = await getStudentInfo(studentId);

  if (!student) {
    notFound();
  }

  return (
    <div className="container mx-auto py-6 px-4">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          플랜 관리: {student.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          플래너를 선택하여 학습 플랜을 관리하세요
        </p>
      </div>

      {/* 플래너 선택 컴포넌트 */}
      <PlannerSelectionPage
        studentId={student.id}
        tenantId={student.tenant_id}
        studentName={student.name}
      />
    </div>
  );
}
