"use client";

import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { X } from "lucide-react";
import type { CalendarEvent } from "@/lib/domains/admin-plan/actions/calendarEvents";
import CalendarEventRow from "./CalendarEventRow";

interface CalendarDayDetailProps {
  date: Date;
  events: CalendarEvent[];
  readOnly?: boolean;
  onClose: () => void;
  onUpdateEvent?: (eventId: string, updates: { startTime?: string; endTime?: string; label?: string }) => void;
  onDeleteEvent?: (eventId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
}

export default function CalendarDayDetail({
  date,
  events,
  readOnly = false,
  onClose,
  onUpdateEvent,
  onDeleteEvent,
  onDeleteGroup,
}: CalendarDayDetailProps) {
  const exclusionEvents = events.filter((e) => e.type === "제외일");
  const timeEvents = events.filter((e) => e.type !== "제외일");

  return (
    <div className="rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[var(--background)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {format(date, "M월 d일 (EEEE)", { locale: ko })}
        </h4>
        <button onClick={onClose} className="rounded p-1 text-[var(--text-placeholder)] hover:bg-[rgb(var(--color-secondary-100))]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {events.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--text-placeholder)]">
          등록된 이벤트가 없습니다
        </p>
      ) : (
        <div className="space-y-1.5">
          {exclusionEvents.length > 0 && (
            <div className="mb-2">
              <span className="mb-1 block text-xs font-medium text-[rgb(var(--color-error-500))]">
                제외일
              </span>
              {exclusionEvents.map((event) => (
                <CalendarEventRow
                  key={event.id}
                  event={event}
                  readOnly={readOnly}
                  onUpdate={onUpdateEvent}
                  onDelete={onDeleteEvent}
                />
              ))}
            </div>
          )}

          {timeEvents.length > 0 && (
            <div>
              {exclusionEvents.length > 0 && (
                <span className="mb-1 block text-xs font-medium text-[var(--text-tertiary)]">
                  비학습시간
                </span>
              )}
              {timeEvents.map((event) => (
                <CalendarEventRow
                  key={event.id}
                  event={event}
                  readOnly={readOnly}
                  onUpdate={onUpdateEvent}
                  onDelete={onDeleteEvent}
                  onDeleteGroup={onDeleteGroup}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
