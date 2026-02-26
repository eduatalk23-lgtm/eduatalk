'use client';

import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Layers } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getAllPlanGroupsSummaryAction } from '@/lib/domains/admin-plan/actions/planGroupSummary';
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from '@/lib/constants/queryCache';

interface AllGroupsSummaryCardProps {
  calendarId: string;
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
  calendarId,
  tenantId,
  className,
}: AllGroupsSummaryCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['allGroupsSummary', calendarId],
    queryFn: () => getAllPlanGroupsSummaryAction(calendarId, tenantId),
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
        'rounded-lg border border-[rgb(var(--color-info-200))] bg-[rgb(var(--color-info-50))]/50 p-4 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[rgb(var(--color-info-600))]" />
          <h3 className="font-medium text-[var(--text-primary)]">
            전체 플랜 요약
          </h3>
          <span className="text-xs text-[var(--text-tertiary)] bg-[rgb(var(--color-secondary-100))] px-1.5 py-0.5 rounded">
            {data.groupCount}개 그룹
          </span>
        </div>
        {data.periodStart && data.periodEnd && (
          <span className="flex items-center gap-1 text-xs text-[var(--text-tertiary)] shrink-0 ml-2">
            <Calendar className="w-3 h-3" />
            {formatDateRange(data.periodStart, data.periodEnd)}
          </span>
        )}
      </div>

      {/* Stats Row - 완료/미완료 기준 (캘린더와 동일) */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--text-tertiary)]">총</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {data.totalCount}개
          </span>
        </div>
        <div className="h-4 w-px bg-[rgb(var(--color-secondary-200))]" />
        <div className="flex items-center gap-1.5">
          <span className="text-green-500 font-medium">✓</span>
          <span className="text-[var(--text-secondary)]">완료 {data.completedCount}</span>
        </div>
        {data.totalCount - data.completedCount > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400 font-medium">○</span>
            <span className="text-[var(--text-secondary)]">미완료 {data.totalCount - data.completedCount}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-[rgb(var(--color-info-100))] rounded-full overflow-hidden">
          <div
            className="h-full bg-[rgb(var(--color-success-500))] rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--text-secondary)] w-10 text-right">
          {progressPercentage}%
        </span>
      </div>
    </div>
  );
});
