'use client';

import { memo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';

interface OffScreenEventHintProps {
  direction: 'above' | 'below';
  timeRange: string;
  eventCount: number;
  onClick: () => void;
}

export const OffScreenEventHint = memo(function OffScreenEventHint({
  direction,
  timeRange,
  eventCount,
  onClick,
}: OffScreenEventHintProps) {
  const Icon = direction === 'above' ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 z-50',
        'flex items-center gap-1 px-2.5 py-1 rounded-full',
        'bg-primary-500/90 text-white',
        'shadow-md backdrop-blur-sm',
        'text-[11px] font-medium whitespace-nowrap',
        'hover:bg-primary-600/95 transition-colors',
        'cursor-pointer select-none',
        direction === 'above' ? 'top-2' : 'bottom-2',
      )}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span>
        {eventCount}개 · {timeRange}
      </span>
    </button>
  );
});
