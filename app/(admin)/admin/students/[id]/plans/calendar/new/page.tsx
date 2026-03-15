import { notFound } from 'next/navigation';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { isAdminRole } from '@/lib/auth/isAdminRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CalendarCreatePage } from './_components/CalendarCreatePage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewCalendarPage({ params }: Props) {
  const { id: studentId } = await params;

  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) notFound();

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

  if (!student) notFound();

  return (
    <CalendarCreatePage
      studentId={student.id}
      studentName={student.name}
      tenantId={student.tenant_id}
    />
  );
}
