'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/cn';

export interface PlanFilters {
  search: string;
  status: 'all' | 'pending' | 'in_progress' | 'completed';
  subject: string;
  dateRange: 'today' | 'week' | 'month' | 'all';
  containerType: 'all' | 'daily' | 'weekly' | 'unfinished';
}

interface PlanFilterBarProps {
  filters: PlanFilters;
  onFiltersChange: (filters: PlanFilters) => void;
  subjects: string[];
  className?: string;
}

export const defaultFilters: PlanFilters = {
  search: '',
  status: 'all',
  subject: '',
  dateRange: 'all',
  containerType: 'all',
};

export function PlanFilterBar({
  filters,
  onFiltersChange,
  subjects,
  className,
}: PlanFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.status !== 'all' ||
    filters.subject !== '' ||
    filters.dateRange !== 'all' ||
    filters.containerType !== 'all';

  const handleReset = () => {
    onFiltersChange(defaultFilters);
  };

  return (
    <div className={cn('bg-white rounded-lg border p-4', className)}>
      {/* 기본 검색 바 */}
      <div className="flex items-center gap-3">
        {/* 검색 입력 */}
        <div className="flex-1 relative">
          <input
            type="text"
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
            placeholder="플랜 제목 검색..."
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          {filters.search && (
            <button
              onClick={() => onFiltersChange({ ...filters, search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* 빠른 상태 필터 */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          {[
            { value: 'all', label: '전체' },
            { value: 'pending', label: '대기' },
            { value: 'in_progress', label: '진행중' },
            { value: 'completed', label: '완료' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  status: option.value as PlanFilters['status'],
                })
              }
              className={cn(
                'px-3 py-1 text-sm rounded transition-colors',
                filters.status === option.value
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 확장 토글 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'px-3 py-2 text-sm border rounded-lg transition-colors',
            isExpanded ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
          )}
        >
          {isExpanded ? '접기' : '더보기'}
          {hasActiveFilters && !isExpanded && (
            <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full inline-block" />
          )}
        </button>

        {/* 초기화 */}
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
          >
            초기화
          </button>
        )}
      </div>

      {/* 확장된 필터 옵션 */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
          {/* 과목 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              과목
            </label>
            <select
              value={filters.subject}
              onChange={(e) =>
                onFiltersChange({ ...filters, subject: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">전체 과목</option>
              {subjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </div>

          {/* 기간 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              기간
            </label>
            <select
              value={filters.dateRange}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  dateRange: e.target.value as PlanFilters['dateRange'],
                })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">전체 기간</option>
              <option value="today">오늘</option>
              <option value="week">이번 주</option>
              <option value="month">이번 달</option>
            </select>
          </div>

          {/* 컨테이너 필터 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              위치
            </label>
            <select
              value={filters.containerType}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  containerType: e.target.value as PlanFilters['containerType'],
                })
              }
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="all">전체</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="unfinished">Unfinished</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
