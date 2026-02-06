'use client';

import { memo } from 'react';
import type { NonStudyItem } from '@/lib/hooks/useAdminDockQueries';

const TYPE_ICONS: Record<string, string> = {
  '아침식사': '🌅',
  '점심식사': '🍽️',
  '저녁식사': '🌙',
  '수면': '😴',
  '학원': '🏫',
  '이동시간': '🚌',
  '기타': '📌',
};

interface NonStudyTimeCardProps {
  item: NonStudyItem;
}

export const NonStudyTimeCard = memo(function NonStudyTimeCard({ item }: NonStudyTimeCardProps) {
  const icon = TYPE_ICONS[item.type] ?? '📌';

  return (
    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-100">
      <span className="text-lg shrink-0">{icon}</span>
      <div className="flex flex-col items-center justify-center w-14 shrink-0 py-0.5 px-1.5 bg-gray-100 rounded-md">
        <span className="text-sm font-semibold text-gray-700 tabular-nums">
          {item.start_time.substring(0, 5)}
        </span>
        <span className="text-[10px] text-gray-500 tabular-nums">
          ~{item.end_time.substring(0, 5)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-700">
          {item.label ?? item.type}
        </span>
      </div>
    </div>
  );
});
