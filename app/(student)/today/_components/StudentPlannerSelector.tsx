'use client';

import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { CalendarSettings } from '@/lib/domains/admin-plan/types';

interface StudentCalendarSelectorProps {
  calendars: CalendarSettings[];
  selectedCalendarId: string | undefined;
  onSelect: (id: string) => void;
}

function formatPeriod(start: string, end: string): string {
  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

export const StudentCalendarSelector = memo(function StudentCalendarSelector({
  calendars,
  selectedCalendarId,
  onSelect,
}: StudentCalendarSelectorProps) {
  const selected = calendars.find(c => c.id === selectedCalendarId);

  if (calendars.length <= 1) {
    return selected ? (
      <div className="text-sm text-gray-600">
        <span className="font-medium">{selected.name}</span>
        {selected.periodStart && selected.periodEnd && (
          <span className="text-gray-400 ml-2">
            {formatPeriod(selected.periodStart, selected.periodEnd)}
          </span>
        )}
      </div>
    ) : null;
  }

  return (
    <div className="relative inline-block">
      <select
        value={selectedCalendarId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {calendars.map(c => (
          <option key={c.id} value={c.id}>
            {c.name}{c.periodStart && c.periodEnd ? ` (${formatPeriod(c.periodStart, c.periodEnd)})` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
});
