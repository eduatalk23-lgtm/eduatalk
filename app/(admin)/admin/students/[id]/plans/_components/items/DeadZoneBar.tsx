'use client';

import { memo, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';

interface DeadZoneBarProps {
  /** 새벽 구간(01:00~07:00) 내 이벤트 수 */
  eventCount: number;
  /** 접힌 상태 여부 */
  isCollapsed: boolean;
  /** 접기/펼치기 토글 */
  onToggle: () => void;
  /** 컴포넌트 높이 (px) */
  height: number;
}

/**
 * 새벽 시간대(01:00~07:00) 접기/펼치기 바.
 *
 * 접힌 상태: 40px 축소 바 + 이벤트 수 배지
 * 펼친 상태: 상단에 접기 버튼만 (실제 시간 블록은 부모가 렌더링)
 */
export const DeadZoneBar = memo(function DeadZoneBar({
  eventCount,
  isCollapsed,
  onToggle,
  height,
}: DeadZoneBarProps) {
  // 클릭 이벤트가 그리드 클릭 핸들러(퀵생성)로 버블링되지 않도록 차단
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggle();
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full flex items-center justify-between px-2',
          'bg-gray-50 dark:bg-gray-800/50',
          'border-b border-gray-200 dark:border-gray-700',
          'hover:bg-gray-100 dark:hover:bg-gray-700/50',
          'transition-colors cursor-pointer select-none',
          'text-[11px] text-gray-500 dark:text-gray-400',
        )}
        style={{ height }}
      >
        <span className="flex items-center gap-1">
          <svg
            className="w-3 h-3 transition-transform"
            viewBox="0 0 12 12"
            fill="currentColor"
          >
            <path d="M4 3l4 3-4 3z" />
          </svg>
          <span>새벽 (01~07시)</span>
        </span>
        {eventCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-medium">
            {eventCount}건
          </span>
        )}
      </button>
    );
  }

  // 펼친 상태: 접기 버튼 (실제 시간 블록은 부모의 정상 렌더링 영역)
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={cn(
        'w-full flex items-center gap-1 px-2 py-0.5',
        'bg-gray-50/50 dark:bg-gray-800/30',
        'border-b border-gray-200 dark:border-gray-700',
        'hover:bg-gray-100 dark:hover:bg-gray-700/50',
        'transition-colors cursor-pointer select-none',
        'text-[10px] text-gray-400 dark:text-gray-500',
      )}
    >
      <svg
        className="w-3 h-3 rotate-90 transition-transform"
        viewBox="0 0 12 12"
        fill="currentColor"
      >
        <path d="M4 3l4 3-4 3z" />
      </svg>
      <span>새벽 접기</span>
    </button>
  );
});
