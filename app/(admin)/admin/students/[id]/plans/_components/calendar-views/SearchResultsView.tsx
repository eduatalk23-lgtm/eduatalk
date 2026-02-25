'use client';

import { memo, useMemo, Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/cn';
import { Check, Clock, Search } from 'lucide-react';
import { searchCalendarEventsQueryOptions } from '@/lib/query-options/calendarEvents';
import { calendarEventToPlanItemData } from '@/lib/domains/calendar/adapters';
import { resolveCalendarColors } from '../utils/subjectColors';
import type { PlanItemData } from '@/lib/types/planItem';

// ============================================
// Types
// ============================================

interface SearchResultsViewProps {
  searchQuery: string;
  studentId: string;
  calendarId: string;
  onPlanClick: (plan: PlanItemData, anchorRect: DOMRect) => void;
  onDateSelect: (date: string) => void;
  /** 캘린더별 색상 맵 (calendarId → hex) */
  calendarColorMap?: Map<string, string>;
}

interface DateGroup {
  dateStr: string;
  plans: PlanItemData[];
}

// ============================================
// Helpers
// ============================================

function formatDateHeader(dateStr: string): { dayOfWeek: string; dateText: string; isToday: boolean } {
  const d = parseISO(dateStr);
  return {
    dayOfWeek: format(d, 'EEE', { locale: ko }),
    dateText: format(d, 'M월 d일'),
    isToday: isToday(d),
  };
}

/**
 * 검색어 매칭 부분을 <mark>로 감싸 하이라이트
 * split(regex) + 캡처 그룹 → 홀수 인덱스가 매치 부분
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        // split(/(pattern)/gi) 결과에서 홀수 인덱스가 캡처된 매치
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-700/50 font-semibold rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}

// ============================================
// Skeleton
// ============================================

function SearchResultsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto animate-pulse">
      {Array.from({ length: 3 }).map((_, gi) => (
        <div key={gi} className="border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))]">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <div className="w-12 h-12 rounded-full bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
            <div className="h-4 w-20 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
          </div>
          {Array.from({ length: 2 }).map((_, ri) => (
            <div key={ri} className="flex items-center gap-3 px-4 py-2.5">
              <div className="w-3 h-3 rounded-full bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))]" />
              <div className="w-24 h-3 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded" />
              <div className="flex-1">
                <div className="h-4 w-40 bg-[rgb(var(--color-secondary-200))] dark:bg-[rgb(var(--color-secondary-700))] rounded mb-1" />
                <div className="h-3 w-16 bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Component
// ============================================

export const SearchResultsView = memo(function SearchResultsView({
  searchQuery,
  studentId,
  calendarId,
  onPlanClick,
  onDateSelect,
  calendarColorMap,
}: SearchResultsViewProps) {
  const { data: rawEvents, isLoading, isError } = useQuery(
    searchCalendarEventsQueryOptions(studentId, calendarId, searchQuery)
  );

  const dateGroups: DateGroup[] = useMemo(() => {
    if (!rawEvents || rawEvents.length === 0) return [];

    const planItems = rawEvents.map(calendarEventToPlanItemData);

    const grouped = new Map<string, PlanItemData[]>();
    for (const plan of planItems) {
      const dateKey = plan.planDate ?? '(날짜 없음)';
      const existing = grouped.get(dateKey);
      if (existing) {
        existing.push(plan);
      } else {
        grouped.set(dateKey, [plan]);
      }
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateStr, plans]) => ({ dateStr, plans }));
  }, [rawEvents]);

  const totalCount = useMemo(
    () => dateGroups.reduce((sum, g) => sum + g.plans.length, 0),
    [dateGroups]
  );

  const today = startOfDay(new Date());

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
        <SearchHeader query={searchQuery} count={null} />
        <SearchResultsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col">
        <SearchHeader query={searchQuery} count={null} />
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-tertiary)] text-sm py-16 gap-3">
          <Search className="w-10 h-10 opacity-50" />
          <span>검색에 실패했습니다. 다시 시도해주세요.</span>
        </div>
      </div>
    );
  }

  if (dateGroups.length === 0) {
    return (
      <div className="flex-1 flex flex-col">
        <SearchHeader query={searchQuery} count={0} />
        <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-tertiary)] text-sm py-16 gap-3">
          <Search className="w-10 h-10 text-[var(--text-tertiary)] opacity-50" />
          <span>검색 결과가 없습니다</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      <SearchHeader query={searchQuery} count={totalCount} />
      <div className="flex-1 overflow-y-auto">
        {dateGroups.map(({ dateStr, plans }) => {
          const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
          const header = isValidDate ? formatDateHeader(dateStr) : null;
          const isPast = header && isBefore(parseISO(dateStr), today) && !header.isToday;

          return (
            <div key={dateStr} className="border-b border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-800))] last:border-b-0">
              {/* 날짜 헤더 */}
              <button
                type="button"
                onClick={() => onDateSelect(dateStr)}
                aria-label={header ? `${header.dateText}로 이동` : dateStr}
                className={cn(
                  'sticky top-0 z-10 w-full flex items-center gap-3 px-4 py-2.5 text-left',
                  'bg-[rgb(var(--color-secondary-50))]/95 dark:bg-[rgb(var(--color-secondary-900))]/95 backdrop-blur-sm',
                  'border-b border-[rgb(var(--color-secondary-100))] dark:border-[rgb(var(--color-secondary-800))]',
                  'hover:bg-[rgb(var(--color-secondary-100))] dark:hover:bg-[rgb(var(--color-secondary-800))] transition-colors',
                )}
              >
                {header ? (
                  <div className={cn(
                    'flex flex-col items-center justify-center w-12 h-12 rounded-full shrink-0',
                    header.isToday
                      ? 'bg-[rgb(var(--color-primary-500))] text-white'
                      : 'bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] text-[var(--text-secondary)]',
                  )}>
                    <span className="text-[10px] font-medium leading-none">{header.dayOfWeek}</span>
                    <span className={cn('text-lg font-semibold leading-tight', header.isToday && 'text-white')}>
                      {format(parseISO(dateStr), 'd')}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full shrink-0 bg-[rgb(var(--color-secondary-100))] dark:bg-[rgb(var(--color-secondary-800))] text-[var(--text-tertiary)]">
                    <span className="text-xs">?</span>
                  </div>
                )}
                <span className={cn(
                  'text-sm font-medium',
                  header?.isToday ? 'text-[rgb(var(--color-primary-600))]' : isPast ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
                )}>
                  {header ? header.dateText : dateStr}
                  {header?.isToday && <span className="ml-1.5 text-xs text-[rgb(var(--color-primary-500))]">(오늘)</span>}
                </span>
                <span className="ml-auto text-xs text-[var(--text-tertiary)]">{plans.length}개</span>
              </button>

              {/* 플랜 목록 */}
              <div className="divide-y divide-[rgb(var(--color-secondary-50))] dark:divide-[rgb(var(--color-secondary-800))]">
                {plans.map((plan) => {
                  const calColor = calendarColorMap?.get(plan.calendarId ?? '');
                  const colors = resolveCalendarColors(plan.color, calColor, plan.status, plan.isCompleted);

                  return (
                    <button
                      key={plan.id}
                      type="button"
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        'hover:bg-[rgb(var(--color-secondary-50))] dark:hover:bg-[rgb(var(--color-secondary-800))]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-primary-400))] focus-visible:ring-inset',
                      )}
                      onClick={(e) => onPlanClick(plan, e.currentTarget.getBoundingClientRect())}
                    >
                      {/* 색상 도트 */}
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: colors.bgHex,
                          opacity: colors.opacity,
                        }}
                      />

                      {/* 시간 */}
                      <span className={cn(
                        'w-24 shrink-0 text-xs tabular-nums',
                        plan.isCompleted ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
                      )}>
                        {plan.startTime
                          ? `${plan.startTime.substring(0, 5)} - ${plan.endTime?.substring(0, 5) ?? ''}`
                          : '시간 미정'}
                      </span>

                      {/* 제목 + 과목 */}
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          'text-sm truncate block',
                          plan.isCompleted ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]',
                          colors.strikethrough && 'line-through',
                        )}>
                          <HighlightedText text={plan.title} query={searchQuery} />
                        </span>
                        {plan.subject && (
                          <span className="text-xs text-[var(--text-tertiary)] truncate block">
                            <HighlightedText text={plan.subject} query={searchQuery} />
                          </span>
                        )}
                      </div>

                      {/* 상태 아이콘 */}
                      <span className="shrink-0">
                        {plan.isCompleted ? (
                          <Check className="w-4 h-4 text-[rgb(var(--color-success-500))]" />
                        ) : plan.estimatedMinutes ? (
                          <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-0.5">
                            <Clock className="w-3 h-3" />
                            {plan.estimatedMinutes}분
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ============================================
// Sub-components
// ============================================

const SearchHeader = memo(function SearchHeader({
  query,
  count,
}: {
  query: string;
  count: number | null;
}) {
  return (
    <div className="px-4 py-3 border-b border-[rgb(var(--color-secondary-200))] dark:border-[rgb(var(--color-secondary-700))] bg-[rgb(var(--color-secondary-50))] dark:bg-[rgb(var(--color-secondary-900))] sticky top-0 z-20">
      <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
        <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
        <span>
          검색 결과 &mdash;{' '}
          <span className="font-semibold text-[var(--text-primary)]">&ldquo;{query}&rdquo;</span>
          {count !== null && (
            <span className="ml-1.5 text-[var(--text-tertiary)]">({count}건)</span>
          )}
        </span>
      </div>
    </div>
  );
});

export default SearchResultsView;
