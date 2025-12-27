'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

export type SortOption = 'sequence' | 'time' | 'status' | 'subject' | 'priority';
export type FilterStatus = 'all' | 'pending' | 'in_progress' | 'completed';

interface DockHeaderProps {
  title: string;
  icon: string;
  color: 'blue' | 'green' | 'orange' | 'purple';
  subtitle?: string;
  count?: { completed: number; total: number };

  // Filter & Sort
  showFilter?: boolean;
  showSort?: boolean;
  sortOption?: SortOption;
  filterStatus?: FilterStatus;
  onSortChange?: (sort: SortOption) => void;
  onFilterChange?: (filter: FilterStatus) => void;

  // Actions
  actions?: React.ReactNode;

  // Collapse
  collapsible?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-600',
    headerBg: 'bg-blue-100/50',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-600',
    headerBg: 'bg-green-100/50',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-600',
    headerBg: 'bg-orange-100/50',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-600',
    headerBg: 'bg-purple-100/50',
  },
};

export function DockHeader({
  title,
  icon,
  color,
  subtitle,
  count,
  showFilter,
  showSort,
  sortOption,
  filterStatus,
  onSortChange,
  onFilterChange,
  actions,
  collapsible,
  isCollapsed,
  onToggleCollapse,
}: DockHeaderProps) {
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const styles = colorStyles[color];

  return (
    <div className={cn('px-4 py-3 border-b', styles.border, styles.headerBg)}>
      <div className="flex items-center justify-between">
        {/* 왼쪽: 타이틀 & 정보 */}
        <div className="flex items-center gap-2">
          {collapsible && (
            <button
              onClick={onToggleCollapse}
              className="p-1 hover:bg-black/5 rounded"
            >
              <span className={cn('transition-transform', isCollapsed && '-rotate-90')}>
                ▼
              </span>
            </button>
          )}
          <span className="text-lg">{icon}</span>
          <span className={cn('font-medium', styles.text)}>{title}</span>
          {subtitle && (
            <span className="text-sm text-gray-600">{subtitle}</span>
          )}
          {count && count.total > 0 && (
            <span className={cn('text-sm px-2 py-0.5 rounded-full', styles.badge)}>
              {count.completed}/{count.total}
            </span>
          )}
        </div>

        {/* 오른쪽: 필터/정렬 & 액션 */}
        <div className="flex items-center gap-2">
          {/* 필터 */}
          {showFilter && onFilterChange && (
            <div className="relative">
              <button
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={cn(
                  'px-2 py-1 text-xs rounded border',
                  filterStatus !== 'all'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                )}
              >
                {filterStatus === 'all' && '전체'}
                {filterStatus === 'pending' && '대기'}
                {filterStatus === 'in_progress' && '진행중'}
                {filterStatus === 'completed' && '완료'}
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 w-24 bg-white border rounded-lg shadow-lg z-10">
                  {(['all', 'pending', 'in_progress', 'completed'] as FilterStatus[]).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => {
                          onFilterChange(status);
                          setShowFilterMenu(false);
                        }}
                        className={cn(
                          'w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50',
                          filterStatus === status && 'bg-blue-50 text-blue-700'
                        )}
                      >
                        {status === 'all' && '전체'}
                        {status === 'pending' && '대기'}
                        {status === 'in_progress' && '진행중'}
                        {status === 'completed' && '완료'}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* 정렬 */}
          {showSort && onSortChange && (
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="px-2 py-1 text-xs rounded border border-gray-200 bg-white text-gray-600"
            >
              <option value="sequence">순서</option>
              <option value="time">시간</option>
              <option value="status">상태</option>
              <option value="subject">과목</option>
              <option value="priority">우선순위</option>
            </select>
          )}

          {/* 커스텀 액션 */}
          {actions}
        </div>
      </div>
    </div>
  );
}
