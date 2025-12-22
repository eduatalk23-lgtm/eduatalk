"use client";

import type { CampLearningStats } from "@/lib/domains/camp/types";
import { Card } from "@/components/ui/Card";

type CampLearningStatsCardsProps = {
  stats: CampLearningStats;
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
 * 총 플랜 수 계산
 */
function calculateTotalPlans(stats: CampLearningStats): number {
  // participant_stats에는 총 플랜 수가 없으므로
  // 학습 통계에서 직접 계산할 수 없음
  // 일단 0 반환 (나중에 데이터 레이어에서 제공하도록 개선 필요)
  return 0;
}

/**
 * 완료된 플랜 수 계산
 */
function calculateCompletedPlans(stats: CampLearningStats): number {
  // participant_stats에는 완료된 플랜 수가 없으므로
  // 학습 통계에서 직접 계산할 수 없음
  // 일단 0 반환 (나중에 데이터 레이어에서 제공하도록 개선 필요)
  return 0;
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

export function CampLearningStatsCards({
  stats,
}: CampLearningStatsCardsProps) {
  const averageCompletionRate = calculateAverageCompletionRate(stats);
  const totalDays = 30; // TODO: 템플릿에서 가져오기
  const averageDailyStudyTime = calculateAverageDailyStudyTime(stats, totalDays);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 참여자</p>
          <p className="text-2xl font-semibold text-gray-900">
            {stats.participant_stats.length}명
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">평균 완료율</p>
          <p className="text-2xl font-semibold text-gray-900">
            {averageCompletionRate}%
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">총 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatStudyTime(stats.total_study_minutes)}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">평균 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatStudyTime(stats.average_study_minutes_per_participant)}
          </p>
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-600">평균 일일 학습 시간</p>
          <p className="text-2xl font-semibold text-gray-900">
            {formatStudyTime(averageDailyStudyTime)}
          </p>
        </div>
      </Card>
    </div>
  );
}

