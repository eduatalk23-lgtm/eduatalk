import { notFound } from 'next/navigation';
import { getCurrentUserRole } from '@/lib/auth/getCurrentUserRole';
import { isAdminRole } from '@/lib/auth/isAdminRole';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CalendarCreatePage } from './_components/CalendarCreatePage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewCalendarPage({ params }: Props) {
  const { id: studentId } = await params;

  const { role } = await getCurrentUserRole();
  if (!isAdminRole(role)) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: student } = await supabase
    .from('students')
    .select('id, name, tenant_id')
    .eq('id', studentId)
    .single();

  if (!student) notFound();

  return (
    <CalendarCreatePage
      studentId={student.id}
      studentName={student.name}
      tenantId={student.tenant_id}
    />
  );
}
