'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { formatDateString } from '@/lib/date/calendarUtils';
import { cn } from '@/lib/cn';

interface PlanStatsCardsProps {
  studentId: string;
}

interface Stats {
  unfinishedCount: number;
  weeklyCompletionRate: number;
  avgDailyStudyHours: number;
  totalPlansThisWeek: number;
  completedPlansThisWeek: number;
}

export function PlanStatsCards({ studentId }: PlanStatsCardsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const supabase = createSupabaseBrowserClient();

      // 이번 주 시작/끝 계산
      const today = new Date();
      const dayOfWeek = today.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = formatDateString(weekStart);
      const weekEndStr = formatDateString(weekEnd);

      try {
        // 미완료 플랜 수 (오늘 이전 날짜 + 미완료 상태)
        const todayStr = formatDateString(today);
        const { count: unfinishedCount } = await supabase
          .from('student_plan')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', studentId)
          .eq('container_type', 'daily')
          .eq('is_active', true)
          .lt('plan_date', todayStr)
          .neq('status', 'completed');

        // 이번 주 플랜 통계
        const { data: weeklyPlans } = await supabase
          .from('student_plan')
          .select('status, total_duration_seconds')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .gte('plan_date', weekStartStr)
          .lte('plan_date', weekEndStr);

        const totalPlans = weeklyPlans?.length ?? 0;
        const completedPlans = weeklyPlans?.filter((p) => p.status === 'completed').length ?? 0;
        const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0;

        // 평균 일일 학습 시간 (완료된 플랜 기준)
        const totalSeconds = weeklyPlans
          ?.filter((p) => p.status === 'completed')
          .reduce((sum, p) => sum + (p.total_duration_seconds ?? 0), 0) ?? 0;
        const daysWithStudy = new Set(
          weeklyPlans?.filter((p) => p.status === 'completed').map(() => 'day')
        ).size || 1;
        const avgHours = Math.round((totalSeconds / daysWithStudy / 3600) * 10) / 10;

        setStats({
          unfinishedCount: unfinishedCount ?? 0,
          weeklyCompletionRate: completionRate,
          avgDailyStudyHours: avgHours,
          totalPlansThisWeek: totalPlans,
          completedPlansThisWeek: completedPlans,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, [studentId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[--background] rounded-lg border border-[rgb(var(--color-secondary-200))] p-4 animate-pulse flex flex-col gap-2"
          >
            <div className="h-4 bg-[rgb(var(--color-secondary-200))] rounded w-20" />
            <div className="h-8 bg-[rgb(var(--color-secondary-200))] rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-[--background] rounded-lg border border-[rgb(var(--color-secondary-200))] p-4 flex flex-col gap-3">
      <h3 className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
        현황
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 미완료 */}
        <div
          className={cn(
            'p-3 rounded-lg',
            stats.unfinishedCount > 0
              ? 'bg-[rgb(var(--color-error-50))]'
              : 'bg-[rgb(var(--color-secondary-50))]'
          )}
        >
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            미완료
          </div>
          <div className="flex items-baseline gap-2">
            <div className="flex items-baseline gap-1">
              <span
                className={cn(
                  'text-2xl font-bold',
                  stats.unfinishedCount > 0
                    ? 'text-[rgb(var(--color-error-600))]'
                    : 'text-[rgb(var(--color-secondary-900))]'
                )}
              >
                {stats.unfinishedCount}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                건
              </span>
            </div>
            {stats.unfinishedCount > 2 && (
              <span className="text-xs text-[rgb(var(--color-error-500))]">⚠</span>
            )}
          </div>
        </div>

        {/* 이번 주 완료율 */}
        <div className="p-3 rounded-lg bg-[rgb(var(--color-info-50))]">
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            이번 주 완료율
          </div>
          <div className="flex items-baseline gap-2">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-[rgb(var(--color-info-600))]">
                {stats.weeklyCompletionRate}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                %
              </span>
            </div>
            <span className="text-xs" style={{ color: 'var(--text-placeholder)' }}>
              ({stats.completedPlansThisWeek}/{stats.totalPlansThisWeek})
            </span>
          </div>
        </div>

        {/* 평균 학습 시간 */}
        <div className="p-3 rounded-lg bg-[rgb(var(--color-success-50))]">
          <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            평균 학습
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-[rgb(var(--color-success-600))]">
              {stats.avgDailyStudyHours}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              h/일
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
