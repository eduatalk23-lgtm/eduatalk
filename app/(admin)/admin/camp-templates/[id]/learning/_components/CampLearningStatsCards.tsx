"use client";

import type { CampLearningStats } from "@/lib/domains/camp/types";
import type { CampTemplate } from "@/lib/types/plan";
import { Card } from "@/components/ui/Card";

type CampLearningStatsCardsProps = {
  stats: CampLearningStats;
  template: CampTemplate;
};

/**
 * 학습 시간 포맷팅 (분 → 시간:분)
 */
function formatStudyTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}시간 ${mins}분`;
  }
  return `${mins}분`;
}

/**
 * 평균 완료율 계산
 */
function calculateAverageCompletionRate(stats: CampLearningStats): number {
  if (stats.participant_stats.length === 0) {
    return 0;
  }
  const sum = stats.participant_stats.reduce(
    (acc, stat) => acc + stat.plan_completion_rate,
    0
  );
  return Math.round(sum / stats.participant_stats.length);
}

/**
 * 전체 완료율 계산 (플랜 기준)
 */
function calculateOverallCompletionRate(stats: CampLearningStats): number {
  if (stats.total_plans === 0) {
    return 0;
  }
  return Math.round((stats.completed_plans / stats.total_plans) * 100);
}

/**
 * 평균 일일 학습 시간 계산
 */
function calculateAverageDailyStudyTime(
  stats: CampLearningStats,
  totalDays: number
): number {
  if (totalDays === 0 || stats.participant_stats.length === 0) {
    return 0;
  }
  const totalMinutes = stats.total_study_minutes;
  const averageMinutesPerParticipant = totalMinutes / stats.participant_stats.length;
  return Math.round(averageMinutesPerParticipant / totalDays);
}

/**
 * 캠프 기간 일수 계산
 */
function calculateCampDays(startDate: string | null, endDate: string | null): number {
  if (!startDate || !endDate) {
    return 0;
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  return diffDays > 0 ? diffDays : 0;
}

export function CampLearningStatsCards({
  stats,
  template,
}: CampLearningStatsCardsProps) {
  const averageCompletionRate = calculateAverageCompletionRate(stats);
  const overallCompletionRate = calculateOverallCompletionRate(stats);
  const totalDays = calculateCampDays(template.camp_start_date, template.camp_end_date);
  const averageDailyStudyTime = calculateAverageDailyStudyTime(stats, totalDays);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">총 참여자</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.participant_stats.length}명
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">플랜 진행률</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.completed_plans} / {stats.total_plans}
            <span className="ml-2 text-base font-normal text-gray-500">
              ({overallCompletionRate}%)
            </span>
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">평균 완료율</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {averageCompletionRate}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">총 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatStudyTime(stats.total_study_minutes)}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">평균 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatStudyTime(stats.average_study_minutes_per_participant)}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">평균 일일 학습</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatStudyTime(averageDailyStudyTime)}
          </p>
        </div>
      </Card>
    </div>
  );
}

