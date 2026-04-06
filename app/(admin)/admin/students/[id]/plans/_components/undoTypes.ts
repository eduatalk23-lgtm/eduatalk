import type { PlanStatus } from '@/lib/types/plan';
import type { RecurringScope } from '@/lib/domains/calendar/actions/calendarEventActions';

/**
 * Undo 가능한 액션 (discriminated union)
 */
export type UndoableAction =
  | {
      type: 'delete-plan';
      planId: string;
      description: string;
    }
  | {
      type: 'move-to-date';
      planId: string;
      studentId: string;
      prev: {
        date: string;
        startTime: string;
        endTime: string;
        estimatedMinutes?: number;
      };
      description: string;
    }
  | {
      type: 'resize';
      planId: string;
      studentId: string;
      calendarId: string;
      planDate: string;
      prev: {
        startTime: string;
        endTime: string;
        estimatedMinutes?: number;
      };
      description: string;
    }
  | {
      type: 'status-change';
      planId: string;
      prevStatus: PlanStatus;
      description: string;
    }
  | {
      type: 'recurring-delete';
      scope: RecurringScope;
      parentEventId: string;
      instanceDate: string;
      previousExdates?: string[] | null;
      deletedEventIds?: string[];
      previousRrule?: string | null;
      description: string;
    }
  | {
      type: 'recurrence-remove';
      eventId: string;
      previousRrule: string;
      previousExdates: string[] | null;
      deletedExceptionIds: string[];
      description: string;
    }
  | {
      type: 'undo-recurring-drag';
      exceptionEventId: string;
      parentEventId: string;
      instanceDate: string;
      description: string;
    };
