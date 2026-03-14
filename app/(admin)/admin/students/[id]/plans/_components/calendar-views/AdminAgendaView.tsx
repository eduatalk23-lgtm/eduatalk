'use client';

import { memo, useMemo } from 'react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/cn';
import { Check, Clock } from 'lucide-react';
import { getHolidayName } from '@/lib/domains/calendar/koreanHolidays';
import { resolveCalendarColors } from '../utils/subjectColors';
import type { PlanItemData } from '@/lib/types/planItem';
import type { CalendarPlan, PlansByDate } from './_types/adminCalendar';

interface AdminAgendaViewProps {
  plansByDate: PlansByDate;
  onPlanClick?: (plan: PlanItemData, anchorRect: DOMRect) => void;
  onDateSelect?: (date: string) => void;
  highlightedPlanIds?: Set<string>;
  /** 공휴일 표시 여부 (사이드바 토글) */
  showHolidays?: boolean;
  /** 캘린더별 색상 맵 (calendarId → hex) */
  calendarColorMap?: Map<string, string>;
}

/** CalendarPlan → agenda row용 간이 PlanItemData */
function toPlanItem(plan: CalendarPlan): PlanItemData {
  return {
    id: plan.id,
    type: 'plan',
    title: plan.custom_title || plan.content_title || '(제목 없음)',
    subject: plan.content_subject ?? undefined,
    status: plan.status as PlanItemData['status'],
    isCompleted: plan.status === 'completed',
    startTime: plan.start_time,
    endTime: plan.end_time,
    estimatedMinutes: plan.estimated_minutes,
    planDate: plan.plan_date,
    planGroupId: plan.plan_group_id,
    color: plan.color,
    calendarId: plan.calendar_id,
  };
}

/** 날짜를 사람이 읽기 쉬운 형태로 */
function formatDateHeader(dateStr: string): { dayOfWeek: string; dateText: string; isToday: boolean } {
  const d = parseISO(dateStr);
  return {
    dayOfWeek: format(d, 'EEE', { locale: ko }),
    dateText: format(d, 'M월 d일'),
    isToday: isToday(d),
  };
}

export const AdminAgendaView = memo(function AdminAgendaView({
  plansByDate,
  onPlanClick,
  onDateSelect,
  highlightedPlanIds,
  showHolidays = true,
  calendarColorMap,
}: AdminAgendaViewProps) {
  // 날짜 기준 정렬 (선택 월의 날짜들만 — 빈 날짜 포함하지 않음)
  const sortedDates = useMemo(() => {
    return Object.keys(plansByDate)
      .filter((d) => plansByDate[d].length > 0)
      .sort();
  }, [plansByDate]);

  const today = startOfDay(new Date());

  if (sortedDates.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-tertiary)] text-sm py-16">
        이 기간에 등록된 플랜이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sortedDates.map((dateStr) => {
        const plans = plansByDate[dateStr];
        const header = formatDateHeader(dateStr);
        const isPast = isBefore(parseISO(dateStr), today) && !header.isToday;

        return (
          <div key={dateStr} className="border-b border-[rgb(var(--color-secondary-100))] last:border-b-0">
            {/* 날짜 헤더 */}
            <button
              type="button"
              onClick={() => onDateSelect?.(dateStr)}
              className={cn(
                'sticky top-0 z-10 w-full flex items-center gap-3 px-4 py-2.5 text-left bg-[rgb(var(--color-secondary-50))]/95 backdrop-blur-sm border-b border-[rgb(var(--color-secondary-100))]',
                'hover:bg-[rgb(var(--color-secondary-50))] transition-colors',
              )}
            >
              <div className={cn(
                'flex flex-col items-center justify-center w-12 h-12 rounded-full shrink-0',
                header.isToday ? 'bg-blue-500 text-white' : 'bg-[rgb(var(--color-secondary-100))] text-[var(--text-secondary)]',
              )}>
                <span className="text-[10px] font-medium leading-none">{header.dayOfWeek}</span>
                <span className={cn('text-lg font-semibold leading-tight', header.isToday && 'text-white')}>
                  {format(parseISO(dateStr), 'd')}
                </span>
              </div>
              <span className={cn(
                'text-sm font-medium',
                header.isToday ? 'text-blue-600 dark:text-blue-400' : isPast ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
              )}>
                {header.dateText}
                {header.isToday && <span className="ml-1.5 text-xs text-blue-500 dark:text-blue-400">(오늘)</span>}
                {(() => { const h = showHolidays ? getHolidayName(dateStr) : null; return h ? <span className="ml-1.5 text-xs text-red-400">{h}</span> : null; })()}
              </span>
              <span className="ml-auto text-xs text-[var(--text-tertiary)]">{plans.length}개</span>
            </button>

            {/* 플랜 목록 */}
            <div className="divide-y divide-[rgb(var(--color-secondary-50))]">
              {plans.map((calPlan) => {
                const plan = toPlanItem(calPlan);
                const calColor = calendarColorMap?.get(calPlan.calendar_id ?? '');
                const colors = resolveCalendarColors(plan.color, calColor, plan.status, plan.isCompleted);
                const isHighlighted = highlightedPlanIds?.has(plan.id);

                return (
                  <button
                    key={plan.id}
                    type="button"
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      'hover:bg-[rgb(var(--color-secondary-50))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-inset',
                      isHighlighted && 'bg-yellow-50',
                    )}
                    onClick={(e) => onPlanClick?.(plan, e.currentTarget.getBoundingClientRect())}
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
                      'text-[var(--text-tertiary)]',
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
                        {plan.title}
                      </span>
                      {plan.subject && (
                        <span className="text-xs text-[var(--text-tertiary)] truncate block">{plan.subject}</span>
                      )}
                    </div>

                    {/* 상태 아이콘 */}
                    <span className="shrink-0">
                      {plan.isCompleted ? (
                        <Check className="w-4 h-4 text-green-500" />
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
  );
});

export default AdminAgendaView;
