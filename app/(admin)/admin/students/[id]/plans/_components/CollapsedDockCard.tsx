'use client';

import { cn } from '@/lib/cn';

export type DockType = 'unfinished' | 'daily' | 'weekly';

interface CollapsedDockCardProps {
  type: DockType;
  icon: string;
  title: string;
  count: number;
  completedCount?: number;
  onClick: () => void;
}

const colorStyles: Record<DockType, {
  bg: string;
  border: string;
  text: string;
  hoverBg: string;
  focusRing: string;
}> = {
  unfinished: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    hoverBg: 'hover:bg-red-100',
    focusRing: 'focus-visible:ring-red-500',
  },
  daily: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    hoverBg: 'hover:bg-blue-100',
    focusRing: 'focus-visible:ring-blue-500',
  },
  weekly: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    hoverBg: 'hover:bg-green-100',
    focusRing: 'focus-visible:ring-green-500',
  },
};

/**
 * CollapsedDockCard - 축소 상태 Dock 카드
 *
 * 가로 아코디언 레이아웃에서 축소된 Dock을 표시합니다.
 * 클릭 시 해당 Dock이 확장됩니다.
 * 웹(lg 이상)에서만 표시됩니다.
 */
export function CollapsedDockCard({
  type,
  icon,
  title,
  count,
  completedCount = 0,
  onClick,
}: CollapsedDockCardProps) {
  const styles = colorStyles[type];
  const progressPercent = count > 0 ? (completedCount / count) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${title} 확장하기 (${count}개 플랜)`}
      className={cn(
        // 레이아웃: 고정 간격으로 일관된 배치
        'w-full h-full rounded-lg border-2',
        'flex flex-col items-center justify-center gap-4 py-6',
        // 색상
        styles.bg,
        styles.border,
        // 인터랙션 (성능을 위해 특정 속성만 전환)
        'transition-colors duration-200',
        styles.hoverBg,
        // 접근성: 포커스 링
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        styles.focusRing,
        // 커서
        'cursor-pointer'
      )}
    >
      {/* 아이콘 */}
      <span className="text-3xl" aria-hidden="true">{icon}</span>

      {/* 제목 (세로 텍스트) */}
      <span
        className={cn('font-semibold text-sm tracking-wide', styles.text)}
        style={{ writingMode: 'vertical-rl' }}
      >
        {title}
      </span>

      {/* 플랜 개수 */}
      <div className="text-center">
        <div className={cn('text-3xl font-bold leading-none', styles.text)}>{count}</div>
        <div className="text-sm text-gray-500 mt-1">플랜</div>
      </div>

      {/* 진행률 바 (항상 공간 확보) */}
      <div
        className={cn(
          'w-14 h-1.5 rounded-full overflow-hidden',
          count > 0 ? 'bg-gray-200' : 'bg-transparent'
        )}
        role="progressbar"
        aria-valuenow={completedCount}
        aria-valuemin={0}
        aria-valuemax={count || 1}
      >
        {count > 0 && (
          <div
            className={cn(
              'h-full transition-[width] duration-300',
              type === 'unfinished' && 'bg-red-500',
              type === 'daily' && 'bg-blue-500',
              type === 'weekly' && 'bg-green-500'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        )}
      </div>

      {/* 확장 화살표 */}
      <span className="text-xl text-gray-400" aria-hidden="true">▶</span>
    </button>
  );
}
