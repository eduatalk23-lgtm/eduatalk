'use client';

import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Planner } from '@/lib/domains/admin-plan/actions/planners';

interface StudentPlannerSelectorProps {
  planners: Planner[];
  selectedPlannerId: string | undefined;
  onSelect: (id: string) => void;
}

function formatPeriod(start: string, end: string): string {
  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };
  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

export const StudentPlannerSelector = memo(function StudentPlannerSelector({
  planners,
  selectedPlannerId,
  onSelect,
}: StudentPlannerSelectorProps) {
  const selected = planners.find(p => p.id === selectedPlannerId);

  if (planners.length <= 1) {
    // 플래너 1개면 셀렉터 불필요, 이름만 표시
    return selected ? (
      <div className="text-sm text-gray-600">
        <span className="font-medium">{selected.name}</span>
        <span className="text-gray-400 ml-2">
          {formatPeriod(selected.periodStart, selected.periodEnd)}
        </span>
      </div>
    ) : null;
  }

  return (
    <div className="relative inline-block">
      <select
        value={selectedPlannerId ?? ''}
        onChange={(e) => onSelect(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {planners.map(p => (
          <option key={p.id} value={p.id}>
            {p.name} ({formatPeriod(p.periodStart, p.periodEnd)})
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
});
