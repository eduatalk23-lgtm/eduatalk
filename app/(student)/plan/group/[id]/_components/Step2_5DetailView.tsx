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
  // scheduler_options에서 time_settings 추출
  const schedulerOptions = (group.scheduler_options as any) || {};
  const timeSettings = {
    lunch_time: schedulerOptions.lunch_time,
    camp_study_hours: schedulerOptions.camp_study_hours,
    camp_self_study_hours: schedulerOptions.camp_self_study_hours,
    designated_holiday_hours: schedulerOptions.designated_holiday_hours,
    use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks,
    enable_self_study_for_holidays: schedulerOptions.enable_self_study_for_holidays,
    enable_self_study_for_study_days: schedulerOptions.enable_self_study_for_study_days,
  };
  
  // time_settings 필드 중 하나라도 값이 있으면 포함
  const hasTimeSettings = 
    timeSettings.lunch_time !== undefined ||
    timeSettings.camp_study_hours !== undefined ||
    timeSettings.camp_self_study_hours !== undefined ||
    timeSettings.designated_holiday_hours !== undefined ||
    timeSettings.use_self_study_with_blocks !== undefined ||
    timeSettings.enable_self_study_for_holidays !== undefined ||
    timeSettings.enable_self_study_for_study_days !== undefined;
        
        // scheduler_options에서 time_settings 필드 제거
        const { lunch_time, camp_study_hours, camp_self_study_hours, designated_holiday_hours, use_self_study_with_blocks, enable_self_study_for_holidays, enable_self_study_for_study_days, ...schedulerOptionsWithoutTimeSettings } = schedulerOptions;

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
          schedulerOptions: Object.keys(schedulerOptionsWithoutTimeSettings).length > 0 ? schedulerOptionsWithoutTimeSettings : undefined,
          timeSettings: hasTimeSettings ? timeSettings : undefined,
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

  // scheduler_options에서 time_settings 추출
  const schedulerOptions = (group.scheduler_options as any) || {};
  const timeSettings = {
    lunch_time: schedulerOptions.lunch_time,
    camp_study_hours: schedulerOptions.camp_study_hours,
    camp_self_study_hours: schedulerOptions.camp_self_study_hours,
    designated_holiday_hours: schedulerOptions.designated_holiday_hours,
    use_self_study_with_blocks: schedulerOptions.use_self_study_with_blocks,
    enable_self_study_for_holidays: schedulerOptions.enable_self_study_for_holidays,
    enable_self_study_for_study_days: schedulerOptions.enable_self_study_for_study_days,
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">스케줄 미리보기</h2>
        <p className="mt-1 text-sm text-gray-500">
          입력하신 정보를 바탕으로 계산된 학습 가능한 날짜와 시간입니다.
        </p>
        
        {/* 자율학습 시간 배정 설정 표시 */}
        {(timeSettings.enable_self_study_for_holidays !== undefined || 
          timeSettings.enable_self_study_for_study_days !== undefined) && (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">자율학습 시간 배정 설정</h3>
            <div className="space-y-2 text-sm text-gray-700">
              {timeSettings.enable_self_study_for_holidays !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">지정휴일 자율학습 시간 배정:</span>
                  <span className={timeSettings.enable_self_study_for_holidays ? "text-green-600" : "text-gray-500"}>
                    {timeSettings.enable_self_study_for_holidays ? "✓ 활성화" : "✗ 비활성화"}
                  </span>
                  {timeSettings.enable_self_study_for_holidays && timeSettings.designated_holiday_hours && (
                    <span className="text-xs text-gray-600">
                      ({timeSettings.designated_holiday_hours.start} ~ {timeSettings.designated_holiday_hours.end})
                    </span>
                  )}
                </div>
              )}
              {timeSettings.enable_self_study_for_study_days !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">학습일/복습일 자율학습 시간 배정:</span>
                  <span className={timeSettings.enable_self_study_for_study_days ? "text-green-600" : "text-gray-500"}>
                    {timeSettings.enable_self_study_for_study_days ? "✓ 활성화" : "✗ 비활성화"}
                  </span>
                  {timeSettings.enable_self_study_for_study_days && timeSettings.camp_self_study_hours && (
                    <span className="text-xs text-gray-600">
                      ({timeSettings.camp_self_study_hours.start} ~ {timeSettings.camp_self_study_hours.end})
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 요약 정보 */}
      {(() => {
        // 자율학습 시간 계산 (summary에 없으면 daily_schedule에서 계산)
        const totalSelfStudyHours = result.summary.total_self_study_hours ?? 
          (result.daily_schedule?.reduce((sum, day) => {
            // 지정휴일인 경우 study_hours가 자율학습 시간이므로 그대로 사용
            if (day.day_type === "지정휴일") {
              return sum + day.study_hours;
            }
            // 일반 학습일/복습일의 경우 time_slots에서 자율학습 시간 계산
            if (!day.time_slots) return sum;
            const selfStudyMinutes = day.time_slots
              .filter((slot) => slot.type === "자율학습")
              .reduce((slotSum, slot) => {
                const [startHour, startMin] = slot.start.split(":").map(Number);
                const [endHour, endMin] = slot.end.split(":").map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                return slotSum + (endMinutes - startMinutes);
              }, 0);
            return sum + selfStudyMinutes / 60;
          }, 0) || 0);

        return (
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 bg-white p-6 sm:grid-cols-5">
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
            {totalSelfStudyHours > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500">자율학습 시간</div>
                <div className="mt-1 text-2xl font-semibold text-yellow-600">
                  {formatNumber(totalSelfStudyHours)}시간
                </div>
              </div>
            )}
          </div>
        );
      })()}

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

                  // 주차별 자율학습 시간 계산
                  const weekSelfStudyHours = days.reduce((sum, day) => {
                    // 지정휴일인 경우 study_hours가 자율학습 시간이므로 그대로 사용
                    if (day.day_type === "지정휴일") {
                      return sum + day.study_hours;
                    }
                    // 일반 학습일/복습일의 경우 time_slots에서 자율학습 시간 계산
                    if (!day.time_slots) return sum;
                    const selfStudyMinutes = day.time_slots
                      .filter((slot) => slot.type === "자율학습")
                      .reduce((slotSum, slot) => {
                        const [startHour, startMin] = slot.start.split(":").map(Number);
                        const [endHour, endMin] = slot.end.split(":").map(Number);
                        const startMinutes = startHour * 60 + startMin;
                        const endMinutes = endHour * 60 + endMin;
                        return slotSum + (endMinutes - startMinutes);
                      }, 0);
                    return sum + selfStudyMinutes / 60;
                  }, 0);

                  return (
                    <div key={weekNum} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-gray-900">
                          {weekNum}주차
                        </div>
                        {weekSelfStudyHours > 0 && (
                          <div className="text-xs text-gray-600">
                            자율학습 {formatNumber(weekSelfStudyHours)}시간
                          </div>
                        )}
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

