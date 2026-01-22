'use client';

import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getAllPlanGroupsSummaryAction } from '@/lib/domains/admin-plan/actions/planGroupSummary';
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from '@/lib/constants/queryCache';

interface AllGroupsSummaryCardProps {
  plannerId: string;
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

/**
 * AllGroupsSummaryCard - 전체 플랜 그룹 통합 요약 카드
 *
 * 전체 보기 모드에서 모든 플랜 그룹의 통합 현황 표시
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const AllGroupsSummaryCard = memo(function AllGroupsSummaryCard({
  plannerId,
  tenantId,
  className,
}: AllGroupsSummaryCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['allGroupsSummary', plannerId],
    queryFn: () => getAllPlanGroupsSummaryAction(plannerId, tenantId),
    staleTime: CACHE_STALE_TIME_STABLE, // 30분 (플랜 그룹 요약은 자주 변하지 않음)
    gcTime: CACHE_GC_TIME_STABLE,
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

  // 에러 시에도 렌더링하지 않음
  if (isError) {
    return null;
  }

  // 플랜 그룹이 없으면 렌더링하지 않음
  if (data.groupCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-blue-200 bg-blue-50/50 p-4 shadow-sm',
        'dark:border-blue-800 dark:bg-blue-900/20',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            전체 플랜 요약
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            {data.groupCount}개 그룹
          </span>
        </div>
        {data.periodStart && data.periodEnd && (
          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 ml-2">
            <Calendar className="w-3 h-3" />
            {formatDateRange(data.periodStart, data.periodEnd)}
          </span>
        )}
      </div>

      {/* Stats Row - 완료/미완료 기준 (캘린더와 동일) */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-500 dark:text-gray-400">총</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {data.totalCount}개
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-green-500 font-medium">✓</span>
          <span className="text-gray-700 dark:text-gray-300">완료 {data.completedCount}</span>
        </div>
        {data.totalCount - data.completedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">○</span>
            <span className="text-gray-700 dark:text-gray-300">미완료 {data.totalCount - data.completedCount}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-blue-100 dark:bg-blue-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 dark:bg-green-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 w-10 text-right">
          {progressPercentage}%
        </span>
      </div>
    </div>
  );
});
