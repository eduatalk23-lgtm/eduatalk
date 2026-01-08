'use client';

/**
 * PlanTypeStats
 *
 * 콘텐츠 유형별 플랜 통계를 표시하는 컴포넌트
 * - 유형별 플랜 수
 * - 유형별 완료율
 * - 유형별 총 분량
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/PlanTypeStats
 */

import { useMemo } from 'react';
import { Book, Video, FileText, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDailyDockQuery, useWeeklyDockQuery, useUnfinishedDockQuery } from '@/lib/hooks/useAdminDockQueries';

interface PlanTypeStatsProps {
  studentId: string;
  selectedDate: string;
  plannerId?: string;
  className?: string;
}

interface TypeStat {
  type: 'book' | 'lecture' | 'custom';
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  count: number;
  completed: number;
  totalPages: number;
}

export function PlanTypeStats({
  studentId,
  selectedDate,
  plannerId,
  className,
}: PlanTypeStatsProps) {
  // 모든 Dock에서 플랜 데이터 가져오기
  const { plans: dailyPlans } = useDailyDockQuery(studentId, selectedDate, plannerId);
  const { plans: weeklyPlans } = useWeeklyDockQuery(studentId, selectedDate, plannerId);
  const { plans: unfinishedPlans } = useUnfinishedDockQuery(studentId, plannerId);

  // 모든 플랜 합치기
  const allPlans = useMemo(() => {
    return [...dailyPlans, ...weeklyPlans, ...unfinishedPlans];
  }, [dailyPlans, weeklyPlans, unfinishedPlans]);

  // 유형별 통계 계산
  const typeStats: TypeStat[] = useMemo(() => {
    const stats: Record<string, { count: number; completed: number; totalPages: number }> = {
      book: { count: 0, completed: 0, totalPages: 0 },
      lecture: { count: 0, completed: 0, totalPages: 0 },
      custom: { count: 0, completed: 0, totalPages: 0 },
    };

    for (const plan of allPlans) {
      const type = plan.content_type || 'custom';
      const normalizedType = type === 'book' || type === 'lecture' ? type : 'custom';

      stats[normalizedType].count++;

      if (plan.status === 'completed') {
        stats[normalizedType].completed++;
      }

      // 분량 계산 (페이지/강의 수)
      const start = plan.planned_start_page_or_time ?? 0;
      const end = plan.planned_end_page_or_time ?? 0;
      stats[normalizedType].totalPages += Math.max(0, end - start);
    }

    return [
      {
        type: 'book',
        label: '교재',
        icon: <Book className="w-4 h-4" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        ...stats.book,
      },
      {
        type: 'lecture',
        label: '강의',
        icon: <Video className="w-4 h-4" />,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        ...stats.lecture,
      },
      {
        type: 'custom',
        label: '직접입력',
        icon: <FileText className="w-4 h-4" />,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        ...stats.custom,
      },
    ];
  }, [allPlans]);

  // 전체 통계
  const totalStats = useMemo(() => {
    const total = typeStats.reduce(
      (acc, stat) => ({
        count: acc.count + stat.count,
        completed: acc.completed + stat.completed,
        totalPages: acc.totalPages + stat.totalPages,
      }),
      { count: 0, completed: 0, totalPages: 0 }
    );

    return {
      ...total,
      completionRate: total.count > 0 ? Math.round((total.completed / total.count) * 100) : 0,
    };
  }, [typeStats]);

  // 플랜이 없으면 표시하지 않음
  if (totalStats.count === 0) {
    return null;
  }

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200 p-4', className)}>
      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        유형별 통계
      </h3>

      {/* 전체 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-900">{totalStats.count}</div>
          <div className="text-xs text-gray-500">전체 플랜</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{totalStats.completed}</div>
          <div className="text-xs text-gray-500">완료</div>
        </div>
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{totalStats.completionRate}%</div>
          <div className="text-xs text-gray-500">완료율</div>
        </div>
      </div>

      {/* 유형별 상세 */}
      <div className="space-y-2">
        {typeStats
          .filter((stat) => stat.count > 0)
          .map((stat) => {
            const completionRate = stat.count > 0
              ? Math.round((stat.completed / stat.count) * 100)
              : 0;

            return (
              <div
                key={stat.type}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg',
                  stat.bgColor
                )}
              >
                {/* 아이콘 */}
                <div className={cn('flex-shrink-0', stat.color)}>
                  {stat.icon}
                </div>

                {/* 유형명 */}
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium text-sm', stat.color)}>
                    {stat.label}
                  </div>
                  <div className="text-xs text-gray-500">
                    {stat.totalPages > 0 && `${stat.totalPages}p`}
                  </div>
                </div>

                {/* 통계 */}
                <div className="flex items-center gap-3 text-sm">
                  {/* 플랜 수 */}
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-3 h-3" />
                    <span>{stat.count}</span>
                  </div>

                  {/* 완료 */}
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    <span>{stat.completed}</span>
                  </div>

                  {/* 완료율 */}
                  <div className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    completionRate >= 80
                      ? 'bg-green-100 text-green-700'
                      : completionRate >= 50
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-gray-100 text-gray-600'
                  )}>
                    {completionRate}%
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* 유형이 모두 0인 경우 메시지 */}
      {typeStats.every((stat) => stat.count === 0) && (
        <div className="text-center py-4 text-gray-500 text-sm">
          표시할 플랜이 없습니다.
        </div>
      )}
    </div>
  );
}

export default PlanTypeStats;
