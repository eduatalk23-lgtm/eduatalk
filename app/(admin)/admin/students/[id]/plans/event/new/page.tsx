import { notFound } from 'next/navigation';
import { getCachedUserRole } from '@/lib/auth/getCurrentUserRole';
import { isAdminRole } from '@/lib/auth/isAdminRole';
import { EventEditPage } from '../_components/EventEditPage';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    date?: string;
    startTime?: string;
    endTime?: string;
    calendarId?: string;
    subject?: string;
  }>;
}

export default async function NewEventPage({ params, searchParams }: Props) {
  const [{ id: studentId }, sp] = await Promise.all([params, searchParams]);

  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) notFound();

  if (!sp.calendarId) notFound();

  return (
    <EventEditPage
      mode="new"
      studentId={studentId}
      calendarId={sp.calendarId}
      initialDate={sp.date}
      initialStartTime={sp.startTime}
      initialEndTime={sp.endTime}
      initialSubject={sp.subject}
    />
  );
}
