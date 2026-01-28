'use client';

import { cn } from '@/lib/cn';
import type { NonStudyItem } from '@/lib/query-options/adminDock';

const NON_STUDY_ICONS: Record<NonStudyItem['type'], string> = {
  '아침식사': '🍳',
  '점심식사': '🍽️',
  '저녁식사': '🍽️',
  '수면': '😴',
  '학원': '🏫',
  '이동시간': '🚗',
  '기타': '⏸️',
};

const NON_STUDY_STYLES: Record<NonStudyItem['type'], { bg: string; border: string; timeBg: string; timeBorder: string }> = {
  '아침식사': { bg: 'bg-amber-50/70', border: 'border-amber-200/60', timeBg: 'bg-amber-100', timeBorder: 'border-amber-200' },
  '점심식사': { bg: 'bg-amber-50/70', border: 'border-amber-200/60', timeBg: 'bg-amber-100', timeBorder: 'border-amber-200' },
  '저녁식사': { bg: 'bg-amber-50/70', border: 'border-amber-200/60', timeBg: 'bg-amber-100', timeBorder: 'border-amber-200' },
  '수면': { bg: 'bg-slate-50/70', border: 'border-slate-200/60', timeBg: 'bg-slate-100', timeBorder: 'border-slate-200' },
  '학원': { bg: 'bg-purple-50/70', border: 'border-purple-200/60', timeBg: 'bg-purple-100', timeBorder: 'border-purple-200' },
  '이동시간': { bg: 'bg-gray-50/70', border: 'border-gray-200/60', timeBg: 'bg-gray-100', timeBorder: 'border-gray-200' },
  '기타': { bg: 'bg-gray-50/70', border: 'border-gray-200/60', timeBg: 'bg-gray-100', timeBorder: 'border-gray-200' },
};

interface NonStudyTimeCardProps {
  item: NonStudyItem;
}

export function NonStudyTimeCard({ item }: NonStudyTimeCardProps) {
  const icon = NON_STUDY_ICONS[item.type] ?? '⏸️';
  const styles = NON_STUDY_STYLES[item.type] ?? NON_STUDY_STYLES['기타'];

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 opacity-80',
        styles.bg,
        styles.border,
      )}
    >
      {/* Time box */}
      <div className={cn(
        'flex flex-col items-center justify-center w-14 shrink-0 py-0.5 px-1.5 rounded-md border',
        styles.timeBg,
        styles.timeBorder,
      )}>
        <span className="text-sm font-semibold text-gray-600 tabular-nums">
          {item.start_time.substring(0, 5)}
        </span>
        <span className="text-[10px] text-gray-500 tabular-nums">
          ~{item.end_time.substring(0, 5)}
        </span>
      </div>

      {/* Icon + Label */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{icon}</span>
        <span className="text-sm text-gray-600 truncate">
          {item.label ?? item.type}
        </span>
      </div>
    </div>
  );
}
