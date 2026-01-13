'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CheckCircle2, Loader2, Pause, AlertCircle, BookOpen, Repeat2, CalendarOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getPlanGroupSummaryAction } from '@/lib/domains/admin-plan/actions/planGroupSummary';

interface PlanGroupSummaryCardProps {
  planGroupId: string;
  tenantId: string;
  className?: string;
}

function formatDateRange(start: string | null, end: string | null): string {
  if (!start || !end) return '';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return `${formatDate(start)} ~ ${formatDate(end)}`;
}

export function PlanGroupSummaryCard({
  planGroupId,
  tenantId,
  className,
}: PlanGroupSummaryCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['planGroupSummary', planGroupId],
    queryFn: () => getPlanGroupSummaryAction(planGroupId, tenantId),
    staleTime: 30 * 1000, // 30초 동안 캐시 유지
    refetchOnWindowFocus: false,
  });

  const progressPercentage = useMemo(() => {
    if (!data || data.totalCount === 0) return 0;
    return Math.round((data.completedCount / data.totalCount) * 100);
  }, [data]);

  // 로딩 중이거나 데이터가 없으면 렌더링하지 않음
  if (isLoading || !data) {
    return null;
  }

  // 에러 시에도 렌더링하지 않음 (조용히 실패)
  if (isError) {
    return null;
  }

  // 플랜이 없으면 렌더링하지 않음
  if (data.totalCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
        'dark:border-gray-700 dark:bg-gray-800',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {data.name || '이름 없는 플랜 그룹'}
        </h3>
        {data.periodStart && data.periodEnd && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
            <Calendar className="w-3 h-3" />
            {formatDateRange(data.periodStart, data.periodEnd)}
          </span>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">총</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {data.totalCount}개
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{data.completedCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <Loader2 className="w-3.5 h-3.5" />
          <span>{data.inProgressCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500">
          <Pause className="w-3.5 h-3.5" />
          <span>{data.pendingCount}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
          {progressPercentage}%
        </span>
      </div>

      {/* Cycle Stats (1730 Timetable 주기 정보) */}
      {(data.studyDays != null || data.reviewDays != null || data.totalWeeks != null) && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {data.studyDays != null && (
              <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <BookOpen className="w-3.5 h-3.5" />
                <span>학습일 {data.studyDays}일</span>
              </div>
            )}
            {data.reviewDays != null && (
              <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                <Repeat2 className="w-3.5 h-3.5" />
                <span>복습일 {data.reviewDays}일</span>
              </div>
            )}
            {data.totalWeeks != null && (
              <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                <span>{data.totalWeeks}주차</span>
              </div>
            )}
            {data.exclusionDays != null && data.exclusionDays > 0 && (
              <div className="flex items-center gap-1 text-orange-500 dark:text-orange-400">
                <CalendarOff className="w-3.5 h-3.5" />
                <span>제외일 {data.exclusionDays}일</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
