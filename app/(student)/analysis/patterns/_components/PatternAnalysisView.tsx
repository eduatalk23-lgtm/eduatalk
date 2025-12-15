"use client";

import ProgressBar from "@/components/atoms/ProgressBar";
import { createHeightStyle } from "@/lib/utils/cssVariables";
import { cardStyle, textPrimary, textSecondary, textTertiary, textMuted, bgSurface } from "@/lib/utils/darkMode";
import { cn } from "@/lib/cn";

type DayStats = {
  totalSeconds: number;
  planCount: number;
};

type PatternAnalysisViewProps = {
  byDayOfWeek: Record<number, DayStats>;
  byHour: Record<number, number>;
  byDate: Record<string, DayStats>;
  mostActiveDay: { day: number; totalSeconds: number; planCount: number };
  mostActiveHour: { hour: number; seconds: number };
  averageWeeklySeconds: number;
  weeklyTrend: Array<{ week: number; totalSeconds: number }>;
  delayPercentage: number;
  weekdays: string[];
};

export function PatternAnalysisView({
  byDayOfWeek,
  byHour,
  byDate,
  mostActiveDay,
  mostActiveHour,
  averageWeeklySeconds,
  weeklyTrend,
  delayPercentage,
  weekdays,
}: PatternAnalysisViewProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  const formatHour = (hour: number): string => {
    return `${hour}시`;
  };

  // 요일별 최대값 계산 (비율 계산용)
  const maxDaySeconds = Math.max(...Object.values(byDayOfWeek).map((s) => s.totalSeconds), 1);

  // 시간대별 최대값 계산
  const maxHourSeconds = Math.max(...Object.values(byHour), 1);

  // 주간 트렌드 최대값
  const maxWeekSeconds = Math.max(...weeklyTrend.map((w) => w.totalSeconds), 1);

  return (
    <div className="space-y-6">
      {/* 주요 인사이트 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-6">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-indigo-700">가장 활발한 요일</div>
            <div className="text-2xl font-bold text-indigo-900">
              {weekdays[mostActiveDay.day]}요일
            </div>
            <div className="text-sm text-indigo-600">
              {formatTime(mostActiveDay.totalSeconds)} ({mostActiveDay.planCount}개 플랜)
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-blue-700">가장 활발한 시간대</div>
            <div className="text-2xl font-bold text-blue-900">
              {formatHour(mostActiveHour.hour)}
            </div>
            <div className="text-sm text-blue-600">
              {formatTime(mostActiveHour.seconds)} 학습
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
          <div className="flex flex-col gap-1">
            <div className="text-sm font-medium text-purple-700">주간 평균 학습 시간</div>
            <div className="text-2xl font-bold text-purple-900">
              {formatTime(averageWeeklySeconds)}
            </div>
            <div className="text-sm text-purple-600">최근 4주 평균</div>
          </div>
        </div>
      </div>

      {/* 학습 지연 감지 */}
      {delayPercentage > 10 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-yellow-900">학습 지연 감지</h3>
                  <p className="text-sm text-yellow-800">
                    최근 3일간의 평균 학습 시간이 이전 3일 대비 {delayPercentage}% 감소했습니다.
                  </p>
                </div>
                <div className={cn("rounded-lg p-3", bgSurface)}>
                  <div className="flex flex-col gap-2">
                    <p className="text-sm font-medium text-yellow-900 dark:text-yellow-100">💡 제안:</p>
                    <ul className="list-inside list-disc space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                  <li>주말에 보충 학습 시간을 추가해보세요</li>
                  <li>일부 플랜을 다음 주로 이동하는 것을 고려해보세요</li>
                      <li>학습 목표를 재검토해보세요</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 요일별 학습 분포 */}
      <div className={cardStyle()}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>요일별 학습 분포</h2>
          <div className="flex flex-col gap-3">
            {weekdays.map((day, index) => {
              const stats = byDayOfWeek[index] || { totalSeconds: 0, planCount: 0 };
              const percentage = (stats.totalSeconds / maxDaySeconds) * 100;

              return (
                <div key={index} className="flex items-center gap-4">
                  <div className={cn("w-12 text-sm font-medium", textSecondary)}>{day}</div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-1">
                      <div className={cn("flex items-center justify-between text-xs", textTertiary)}>
                        <span>{formatTime(stats.totalSeconds)}</span>
                        <span>{stats.planCount}개 플랜</span>
                      </div>
                      <ProgressBar
                        value={percentage}
                        max={100}
                        color="indigo"
                        height="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 시간대별 학습 분포 */}
      <div className={cardStyle()}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>시간대별 학습 분포</h2>
          <div className="grid grid-cols-12 gap-2">
            {Array.from({ length: 24 }, (_, hour) => {
              const seconds = byHour[hour] || 0;
              const percentage = (seconds / maxHourSeconds) * 100;
              const height = Math.max(percentage, 5); // 최소 5% 높이

              return (
                <div key={hour} className="flex flex-col items-center gap-1">
                  <div className={cn("text-xs", textTertiary)}>{hour}</div>
                  <div className="relative w-full">
                    <div
                      className="w-full rounded-t bg-indigo-600 transition-all"
                      style={createHeightStyle(height, "20px")}
                      title={`${formatHour(hour)}: ${formatTime(seconds)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className={cn("text-center text-xs", textMuted)}>
            각 막대는 해당 시간대에 시작한 학습의 총 시간을 나타냅니다
          </div>
        </div>
      </div>

      {/* 주간 학습 추이 */}
      <div className={cardStyle()}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>주간 학습 추이</h2>
          <div className="flex flex-col gap-3">
            {weeklyTrend.map((week) => {
              const percentage = (week.totalSeconds / maxWeekSeconds) * 100;

              return (
                <div key={week.week} className="flex items-center gap-4">
                  <div className={cn("w-20 text-sm font-medium", textSecondary)}>
                    {week.week}주 전
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col gap-1">
                      <div className={cn("flex items-center justify-between text-xs", textTertiary)}>
                        <span>{formatTime(week.totalSeconds)}</span>
                      </div>
                      <ProgressBar
                        value={percentage}
                        max={100}
                        color="violet"
                        height="sm"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 학습 히트맵 (최근 4주) */}
      <div className={cardStyle()}>
        <div className="flex flex-col gap-4">
          <h2 className={cn("text-lg font-semibold", textPrimary)}>학습 강도 히트맵</h2>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-8 gap-1">
                  <div className={cn("text-xs", textTertiary)}></div>
                  {weekdays.map((day) => (
                    <div key={day} className={cn("text-center text-xs font-medium", textSecondary)}>
                      {day}
                    </div>
                  ))}
                </div>
                {Array.from({ length: 4 }, (_, weekIndex) => {
                  const weekStart = new Date();
                  weekStart.setDate(weekStart.getDate() - (weekIndex * 7) - 6);

                  return (
                    <div key={weekIndex} className="grid grid-cols-8 gap-1">
                      <div className={cn("text-xs", textTertiary)}>
                        {4 - weekIndex}주 전
                      </div>
                      {weekdays.map((_, dayIndex) => {
                        const date = new Date(weekStart);
                        date.setDate(weekStart.getDate() + dayIndex);
                        const dateStr = date.toISOString().slice(0, 10);
                        const stats = byDate[dateStr] || { totalSeconds: 0, planCount: 0 };

                        // 강도 계산 (0-3 레벨)
                        const maxSeconds = Math.max(
                          ...Object.values(byDate).map((s) => s.totalSeconds),
                          1
                        );
                        const intensity = Math.min(
                          Math.floor((stats.totalSeconds / maxSeconds) * 4),
                          3
                        );

                        const intensityColors = [
                          "bg-gray-100 dark:bg-gray-700", // 0
                          "bg-green-200 dark:bg-green-900", // 1
                          "bg-green-400 dark:bg-green-700", // 2
                          "bg-green-600 dark:bg-green-600", // 3
                        ];

                        return (
                          <div
                            key={dayIndex}
                            className={`aspect-square rounded ${intensityColors[intensity]}`}
                            title={`${dateStr}: ${formatTime(stats.totalSeconds)}`}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className={cn("flex items-center justify-center gap-4 text-xs", textTertiary)}>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-gray-100 dark:bg-gray-700" />
            <span>낮음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-200 dark:bg-green-900" />
            <span>보통</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-400 dark:bg-green-700" />
            <span>높음</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-600 dark:bg-green-600" />
            <span>매우 높음</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}

