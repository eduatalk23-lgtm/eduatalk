import { queryOptions } from '@tanstack/react-query';
import {
  getPlannerCalendarEventsAction,
  type CalendarEvent,
} from '@/lib/domains/admin-plan/actions/calendarEvents';
import { startOfMonth, endOfMonth, format } from 'date-fns';

export const plannerCalendarKeys = {
  all: ['plannerCalendar'] as const,
  events: (plannerId: string) =>
    [...plannerCalendarKeys.all, 'events', plannerId] as const,
  monthEvents: (plannerId: string, year: number, month: number) =>
    [...plannerCalendarKeys.events(plannerId), year, month] as const,
};

export function plannerCalendarEventsQueryOptions(
  plannerId: string,
  year: number,
  month: number
) {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const startDate = format(monthStart, 'yyyy-MM-dd');
  const endDate = format(monthEnd, 'yyyy-MM-dd');

  return queryOptions<CalendarEvent[]>({
    queryKey: plannerCalendarKeys.monthEvents(plannerId, year, month),
    queryFn: async () => {
      return getPlannerCalendarEventsAction(plannerId, startDate, endDate);
    },
    staleTime: 30_000,
  });
}
