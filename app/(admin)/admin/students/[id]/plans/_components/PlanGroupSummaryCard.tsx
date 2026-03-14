'use client';

import { useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, BookOpen, Repeat2, CalendarOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getPlanGroupSummaryAction } from '@/lib/domains/admin-plan/actions/planGroupSummary';
import { CACHE_STALE_TIME_STABLE, CACHE_GC_TIME_STABLE } from '@/lib/constants/queryCache';

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

/**
 * PlanGroupSummaryCard - 플랜 그룹 요약 카드
 *
 * React.memo로 감싸서 props가 변경되지 않으면 리렌더링을 방지합니다.
 */
export const PlanGroupSummaryCard = memo(function PlanGroupSummaryCard({
  planGroupId,
  tenantId,
  className,
}: PlanGroupSummaryCardProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['planGroupSummary', planGroupId],
    queryFn: () => getPlanGroupSummaryAction(planGroupId, tenantId),
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
        'rounded-lg border border-[rgb(var(--color-secondary-200))] bg-[rgb(var(--color-secondary-50))] p-4 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-[var(--text-primary)] truncate">
          {data.name || '이름 없는 플랜 그룹'}
        </h3>
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
            <span className="text-gray-400 dark:text-gray-500 font-medium">○</span>
            <span className="text-[var(--text-secondary)]">미완료 {data.totalCount - data.completedCount}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-[rgb(var(--color-secondary-100))] rounded-full overflow-hidden">
          <div
            className="h-full bg-[rgb(var(--color-success-500))] rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-[var(--text-secondary)] w-10 text-right">
          {progressPercentage}%
        </span>
      </div>

      {/* Cycle Stats (1730 Timetable 주기 정보) */}
      {(data.studyDays != null || data.reviewDays != null || data.totalWeeks != null) && (
        <div className="mt-3 pt-3 border-t border-[rgb(var(--color-secondary-100))]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {data.studyDays != null && (
              <div className="flex items-center gap-1 text-[rgb(var(--color-info-600))]">
                <BookOpen className="w-3.5 h-3.5" />
                <span>학습일 {data.studyDays}일</span>
              </div>
            )}
            {data.reviewDays != null && (
              <div className="flex items-center gap-1 text-purple-600">
                <Repeat2 className="w-3.5 h-3.5" />
                <span>복습일 {data.reviewDays}일</span>
              </div>
            )}
            {data.totalWeeks != null && (
              <div className="flex items-center gap-1 text-[rgb(var(--color-secondary-600))]">
                <Calendar className="w-3.5 h-3.5" />
                <span>{data.totalWeeks}주차</span>
              </div>
            )}
            {data.exclusionDays != null && data.exclusionDays > 0 && (
              <div className="flex items-center gap-1 text-[rgb(var(--color-warning-500))]">
                <CalendarOff className="w-3.5 h-3.5" />
                <span>제외일 {data.exclusionDays}일</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
