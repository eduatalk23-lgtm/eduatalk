import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ensureStudentPrimaryCalendar } from '@/lib/domains/calendar/helpers';

interface Props {
  params: Promise<{ id: string }>;
}

async function getStudentInfo(studentId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, tenant_id')
    .eq('id', studentId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * 학생 플랜 페이지 → Primary Calendar로 자동 리다이렉트
 * 캘린더 뷰를 바로 표시
 */
export default async function StudentPlansPage({ params }: Props) {
  const { id: studentId } = await params;

  const student = await getStudentInfo(studentId);

  if (!student) {
    notFound();
  }

  // Primary Calendar 확보 (없으면 자동 생성)
  const calendarId = await ensureStudentPrimaryCalendar(
    student.id,
    student.tenant_id
  );

  // 캘린더 뷰로 바로 리다이렉트
  redirect(`/admin/students/${studentId}/plans/calendar/${calendarId}`);
}
