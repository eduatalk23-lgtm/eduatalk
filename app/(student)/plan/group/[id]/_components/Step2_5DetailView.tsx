"use client";

import { useState, useEffect } from "react";
import { calculateScheduleAvailability } from "@/app/(student)/actions/calculateScheduleAvailability";
import { formatNumber } from "@/lib/utils/formatNumber";
import type { PlanGroup, PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import type {
  ScheduleAvailabilityResult,
} from "@/lib/scheduler/calculateAvailableDates";

type Step2_5DetailViewProps = {
  group: PlanGroup;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
};

export function Step2_5DetailView({ group, exclusions, academySchedules }: Step2_5DetailViewProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScheduleAvailabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (!group.period_start || !group.period_end || !group.block_set_id || !group.scheduler_type) {
        setError("필수 정보가 누락되었습니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await calculateScheduleAvailability({
          periodStart: group.period_start,
          periodEnd: group.period_end,
          blockSetId: group.block_set_id,
          exclusions: exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason,
          })),
          academySchedules: academySchedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name,
            subject: s.subject,
            travel_time: s.travel_time,
          })),
          schedulerType: group.scheduler_type as "1730_timetable" | "자동스케줄러",
          schedulerOptions: group.scheduler_options || undefined,
          timeSettings: undefined,
        });

        if (response.success && response.data) {
          setResult(response.data);
        } else {
          setError(response.error || "계산에 실패했습니다.");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [group, exclusions, academySchedules]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
          <p className="mt-1 text-sm text-gray-500">
            입력하신 정보를 바탕으로 학습 가능한 날짜와 시간을 계산 중입니다.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-gray-900"></div>
          <p className="mt-4 text-sm text-gray-500">계산 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
          <p className="mt-1 text-sm text-gray-500">
            입력하신 정보를 바탕으로 학습 가능한 날짜와 시간을 확인합니다.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">오류</h3>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
        <p className="mt-1 text-sm text-gray-500">
          입력하신 정보를 바탕으로 계산된 학습 가능한 날짜와 시간입니다.
        </p>
      </div>

      {/* 요약 정보 */}
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-4">
        <div>
          <div className="text-xs font-medium text-gray-500">총 일수</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {result.summary.total_days}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">학습일</div>
          <div className="mt-1 text-2xl font-semibold text-blue-600">
            {result.summary.total_study_days}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">복습일</div>
          <div className="mt-1 text-2xl font-semibold text-green-600">
            {result.summary.total_review_days}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium text-gray-500">총 학습 시간</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900">
            {formatNumber(result.summary.total_study_hours)}시간
          </div>
        </div>
      </div>

      {/* 주차별 스케줄 (간단 버전) */}
      {result.daily_schedule && result.daily_schedule.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">주차별 스케줄</h3>
          <div className="space-y-4">
            {(() => {
              // 주차별로 그룹화
              const weeksMap = new Map<number, typeof result.daily_schedule>();
              result.daily_schedule.forEach((day) => {
                const weekNum = day.week_number || 1;
                if (!weeksMap.has(weekNum)) {
                  weeksMap.set(weekNum, []);
                }
                weeksMap.get(weekNum)!.push(day);
              });

              return Array.from(weeksMap.entries())
                .sort(([a], [b]) => a - b) // 주차 번호 순으로 정렬
                .map(([weekNum, days]) => {
                  // 날짜 순으로 정렬
                  const sortedDays = [...days].sort((a, b) => 
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                  );

                  return (
                    <div key={weekNum} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-2 text-sm font-semibold text-gray-900">
                        {weekNum}주차
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {sortedDays.map((day, dayIndex) => (
                          <div
                            key={dayIndex}
                            className={`rounded border p-2 text-center text-xs ${
                              day.day_type === "학습일"
                                ? "border-blue-200 bg-blue-50 text-blue-800"
                                : day.day_type === "복습일"
                                ? "border-green-200 bg-green-50 text-green-800"
                                : "border-gray-200 bg-gray-50 text-gray-600"
                            }`}
                          >
                            <div className="font-medium">
                              {new Date(day.date).toLocaleDateString("ko-KR", {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                            <div className="mt-1">{day.day_type}</div>
                            {day.study_hours > 0 && (
                              <div className="mt-1 text-xs">{formatNumber(day.study_hours)}시간</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

