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
  /** 클릭 핸들러 (편집 모달 열기용) */
  onClick?: () => void;
  /** 편집 가능 여부 */
  editable?: boolean;
}

export function NonStudyTimeCard({ item, onClick, editable = false }: NonStudyTimeCardProps) {
  const icon = NON_STUDY_ICONS[item.type] ?? '⏸️';
  const styles = NON_STUDY_STYLES[item.type] ?? NON_STUDY_STYLES['기타'];

  const handleClick = () => {
    if (editable && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editable && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2 opacity-80',
        styles.bg,
        styles.border,
        editable && 'cursor-pointer hover:opacity-100 hover:shadow-sm transition-all',
        editable && 'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1'
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
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base shrink-0">{icon}</span>
        <span className="text-sm text-gray-600 truncate">
          {item.label ?? item.type}
        </span>
      </div>

      {/* Edit indicator */}
      {editable && (
        <svg
          className="w-4 h-4 text-gray-400 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
      )}
    </div>
  );
}
