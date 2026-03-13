import { notFound } from 'next/navigation';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { isAdminRole } from '@/lib/auth/isAdminRole';
import { EventEditPage } from '../../_components/EventEditPage';

interface Props {
  params: Promise<{ id: string; eventId: string }>;
  searchParams: Promise<{
    instanceDate?: string;
    calendarId?: string;
  }>;
}

export default async function EditEventPage({ params, searchParams }: Props) {
  const [{ id: studentId, eventId }, sp] = await Promise.all([params, searchParams]);

  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) notFound();

  return (
    <EventEditPage
      mode="edit"
      studentId={studentId}
      eventId={eventId}
      calendarId={sp.calendarId}
      instanceDate={sp.instanceDate}
    />
  );
}
