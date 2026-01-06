'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

interface SummaryDashboardProps {
  studentId: string;
  className?: string;
}

interface PlanStats {
  totalPlans: number;
  completedPlans: number;
  pendingPlans: number;
  inProgressPlans: number;
  totalVolume: number;
  completedVolume: number;
  carryoverCount: number;
  subjectBreakdown: Array<{
    subject: string;
    total: number;
    completed: number;
  }>;
  weeklyTrend: Array<{
    date: string;
    completed: number;
    total: number;
  }>;
}

export function SummaryDashboard({ studentId, className }: SummaryDashboardProps) {
  const [stats, setStats] = useState<PlanStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');

  useEffect(() => {
    async function fetchStats() {
      setIsLoading(true);
      const supabase = createSupabaseBrowserClient();

      // 기간 계산
      const now = new Date();
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else {
        startDate.setMonth(now.getMonth() - 1);
      }
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = now.toISOString().split('T')[0];

      // 플랜 데이터 조회
      const { data: plans } = await supabase
        .from('student_plan')
        .select(`
          id,
          status,
          content_subject,
          plan_date,
          planned_start_page_or_time,
          planned_end_page_or_time,
          completed_start_page_or_time,
          completed_end_page_or_time,
          carryover_count,
          container_type
        `)
        .eq('student_id', studentId)
        .eq('is_active', true)
        .gte('plan_date', startDateStr)
        .lte('plan_date', endDateStr);

      if (!plans) {
        setStats(null);
        setIsLoading(false);
        return;
      }

      // 통계 계산
      const totalPlans = plans.length;
      const completedPlans = plans.filter(p => p.status === 'completed').length;
      const pendingPlans = plans.filter(p => p.status === 'pending' || !p.status).length;
      const inProgressPlans = plans.filter(p => p.status === 'in_progress').length;
      const carryoverCount = plans.filter(p => (p.carryover_count ?? 0) > 0).length;

      // 볼륨 계산
      let totalVolume = 0;
      let completedVolume = 0;

      plans.forEach(p => {
        const planned = (p.planned_end_page_or_time ?? 0) - (p.planned_start_page_or_time ?? 0);
        const completed = (p.completed_end_page_or_time ?? 0) - (p.completed_start_page_or_time ?? 0);
        totalVolume += Math.max(0, planned);
        completedVolume += Math.max(0, completed);
      });

      // 과목별 분류
      const subjectMap = new Map<string, { total: number; completed: number }>();
      plans.forEach(p => {
        const subject = p.content_subject ?? '기타';
        const current = subjectMap.get(subject) ?? { total: 0, completed: 0 };
        current.total += 1;
        if (p.status === 'completed') current.completed += 1;
        subjectMap.set(subject, current);
      });

      const subjectBreakdown = Array.from(subjectMap.entries())
        .map(([subject, data]) => ({ subject, ...data }))
        .sort((a, b) => b.total - a.total);

      // 일별 트렌드 (최근 7일)
      const trendMap = new Map<string, { completed: number; total: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        trendMap.set(dateStr, { completed: 0, total: 0 });
      }

      plans.forEach(p => {
        if (trendMap.has(p.plan_date)) {
          const current = trendMap.get(p.plan_date)!;
          current.total += 1;
          if (p.status === 'completed') current.completed += 1;
        }
      });

      const weeklyTrend = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, ...data }));

      setStats({
        totalPlans,
        completedPlans,
        pendingPlans,
        inProgressPlans,
        totalVolume,
        completedVolume,
        carryoverCount,
        subjectBreakdown,
        weeklyTrend,
      });
      setIsLoading(false);
    }

    fetchStats();
  }, [studentId, timeRange]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-lg border p-4', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const completionRate = stats.totalPlans > 0
    ? Math.round((stats.completedPlans / stats.totalPlans) * 100)
    : 0;

  const volumeRate = stats.totalVolume > 0
    ? Math.round((stats.completedVolume / stats.totalVolume) * 100)
    : 0;

  return (
    <div className={cn('bg-white rounded-lg border overflow-hidden', className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h3 className="font-bold text-gray-800">학습 요약</h3>
        <div className="flex items-center gap-1 border rounded p-0.5">
          <button
            onClick={() => setTimeRange('week')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              timeRange === 'week' ? 'bg-blue-500 text-white' : 'text-gray-600'
            )}
          >
            주간
          </button>
          <button
            onClick={() => setTimeRange('month')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              timeRange === 'month' ? 'bg-blue-500 text-white' : 'text-gray-600'
            )}
          >
            월간
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 핵심 지표 */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalPlans}</div>
            <div className="text-xs text-gray-600">전체 플랜</div>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{completionRate}%</div>
            <div className="text-xs text-gray-600">완료율</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.completedVolume}p</div>
            <div className="text-xs text-gray-600">완료 분량</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-600">{stats.carryoverCount}</div>
            <div className="text-xs text-gray-600">이월 건수</div>
          </div>
        </div>

        {/* 진행률 바 */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">플랜 진행률</span>
            <span className="font-medium">{stats.completedPlans}/{stats.totalPlans}</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${completionRate}%` }}
            />
          </div>

          <div className="flex justify-between text-sm mt-3">
            <span className="text-gray-600">분량 진행률</span>
            <span className="font-medium">{stats.completedVolume}/{stats.totalVolume}p</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${volumeRate}%` }}
            />
          </div>
        </div>

        {/* 일별 트렌드 (미니 차트) */}
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">일별 완료 추이</div>
          <div className="flex items-end gap-1 h-16">
            {stats.weeklyTrend.map((day, i) => {
              const height = day.total > 0 ? (day.completed / day.total) * 100 : 0;
              const date = new Date(day.date + 'T00:00:00');
              const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '48px' }}>
                    <div
                      className={cn(
                        'absolute bottom-0 left-0 right-0 rounded-t transition-all',
                        height >= 100 ? 'bg-green-500' : height > 0 ? 'bg-blue-400' : 'bg-gray-200'
                      )}
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 과목별 분포 */}
        {stats.subjectBreakdown.length > 0 && (
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">과목별 현황</div>
            <div className="space-y-1.5">
              {stats.subjectBreakdown.slice(0, 5).map((item) => {
                const rate = item.total > 0 ? (item.completed / item.total) * 100 : 0;

                return (
                  <div key={item.subject} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-16 truncate">{item.subject}</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {item.completed}/{item.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
