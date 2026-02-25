import { queryOptions } from '@tanstack/react-query';
import {
  getCalendarEventsAction,
  type CalendarEvent,
} from '@/lib/domains/admin-plan/actions/calendarEvents';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const calendarViewKeys = {
  all: ['calendarView'] as const,
  events: (calendarId: string) =>
    [...calendarViewKeys.all, 'events', calendarId] as const,
  monthEvents: (calendarId: string, year: number, month: number) =>
    [...calendarViewKeys.events(calendarId), year, month] as const,
};

export function calendarViewEventsQueryOptions(
  calendarId: string,
  year: number,
  month: number
) {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');

  return queryOptions<CalendarEvent[]>({
    queryKey: calendarViewKeys.monthEvents(calendarId, year, month),
    queryFn: async () => {
      return getCalendarEventsAction(calendarId, startDate, endDate);
    },
    staleTime: 30_000,
  });
}
