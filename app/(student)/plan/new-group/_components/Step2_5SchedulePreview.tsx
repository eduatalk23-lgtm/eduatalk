"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Calendar, XCircle, Clock, School, MapPin } from "lucide-react";
import { WizardData } from "./PlanGroupWizard";
import { calculateScheduleAvailability } from "@/app/(student)/actions/calculateScheduleAvailability";
import { formatNumber } from "@/lib/utils/formatNumber";
import type {
  ScheduleAvailabilityResult,
  DailySchedule,
  TimeSlot,
} from "@/lib/scheduler/calculateAvailableDates";

type Step2_5SchedulePreviewProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
};

const dayTypeLabels: Record<string, string> = {
  학습일: "학습일",
  복습일: "복습일",
  지정휴일: "지정휴일",
  휴가: "휴가",
  개인일정: "개인일정",
};

const dayTypeColors: Record<string, string> = {
  학습일: "bg-blue-100 text-blue-800 border-blue-200",
  복습일: "bg-green-100 text-green-800 border-green-200",
  지정휴일: "bg-yellow-100 text-yellow-800 border-yellow-200",
  휴가: "bg-gray-100 text-gray-800 border-gray-200",
  개인일정: "bg-purple-100 text-purple-800 border-purple-200",
};

export function Step2_5SchedulePreview({
  data,
  onUpdate,
}: Step2_5SchedulePreviewProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScheduleAvailabilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchedule = async () => {
      if (
        !data.period_start ||
        !data.period_end ||
        !data.block_set_id ||
        !data.scheduler_type
      ) {
        setError("필수 정보가 누락되었습니다.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await calculateScheduleAvailability({
          periodStart: data.period_start,
          periodEnd: data.period_end,
          blockSetId: data.block_set_id,
          exclusions: data.exclusions.map((e) => ({
            exclusion_date: e.exclusion_date,
            exclusion_type: e.exclusion_type,
            reason: e.reason,
          })),
          academySchedules: data.academy_schedules.map((s) => ({
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            academy_name: s.academy_name,
            subject: s.subject,
            travel_time: s.travel_time,
          })),
          schedulerType: data.scheduler_type as "1730_timetable" | "자동스케줄러",
          schedulerOptions: data.scheduler_options,
          timeSettings: data.time_settings,
        });

        if (response.success && response.data) {
          setResult(response.data);
          // 스케줄 요약 정보를 WizardData에 저장 (Step 3에서 학습 범위 추천에 사용)
          onUpdate({
            schedule_summary: {
              total_days: response.data.summary.total_days,
              total_study_days: response.data.summary.total_study_days,
              total_review_days: response.data.summary.total_review_days,
              total_study_hours: response.data.summary.total_study_hours,
              total_study_hours_학습일: response.data.summary.total_study_hours_학습일,
              total_study_hours_복습일: response.data.summary.total_study_hours_복습일,
              total_self_study_hours: response.data.summary.total_self_study_hours,
            },
          });
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
  }, [
    data.period_start,
    data.period_end,
    data.block_set_id,
    data.scheduler_type,
    data.exclusions,
    data.academy_schedules,
    data.scheduler_options,
    data.time_settings,
  ]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            스케줄 가능 날짜 확인
          </h2>
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
          <h2 className="text-xl font-semibold text-gray-900">
            스케줄 가능 날짜 확인
          </h2>
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
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            스케줄 가능 날짜 확인
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            입력하신 정보를 바탕으로 학습 가능한 날짜와 시간을 확인합니다.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const { summary, daily_schedule, errors } = result;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">
          스케줄 가능 날짜 확인
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          입력하신 정보를 바탕으로 학습 가능한 날짜와 시간을 확인합니다.
        </p>
      </div>

      {/* 오류 표시 */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="mb-2 text-sm font-semibold text-red-800">오류</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">
            {errors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 요약 정보 */}
      <div className="space-y-4">
        {/* 기본 통계 */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">총 일수</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {summary.total_days}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">학습일</div>
            <div className="mt-1 text-2xl font-bold text-blue-600">
              {summary.total_study_days}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">복습일</div>
            <div className="mt-1 text-2xl font-bold text-green-600">
              {summary.total_review_days}
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">총 학습 시간</div>
            <div className="mt-1 text-2xl font-bold text-gray-900">
              {formatNumber(summary.total_study_hours)}h
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">총 주차 수</div>
            <div className="mt-1 text-2xl font-bold text-indigo-600">
              {(() => {
                const weekSet = new Set(
                  daily_schedule.map((s) => s.week_number).filter((w) => w !== undefined)
                );
                return weekSet.size || "-";
              })()}
            </div>
          </div>
        </div>

        {/* 시간 효율성 지표 */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">평균 일일 학습 시간</div>
            <div className="mt-1 text-xl font-bold text-gray-900">
              {summary.total_study_days > 0
                ? formatNumber(summary.total_study_hours / summary.total_study_days)
                : "0.00"}
              시간
            </div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-xs font-medium text-gray-500">학습일 평균 시간</div>
            <div className="mt-1 text-xl font-bold text-blue-600">
              {summary.total_study_days > 0
                ? formatNumber(summary.total_study_hours_학습일 / summary.total_study_days)
                : "0.00"}
              시간
            </div>
          </div>
        </div>

        {/* 제외일 통계 */}
        <div className="grid gap-4 md:grid-cols-3">
          <div
            className={`rounded-lg border p-4 ${
              summary.total_exclusion_days.휴가 > 0
                ? "border-gray-200 bg-white"
                : "border-gray-100 bg-gray-50 opacity-60"
            }`}
          >
            <div className="text-xs font-medium text-gray-500">휴가</div>
            <div className="mt-1 text-2xl font-bold text-gray-600">
              {summary.total_exclusion_days.휴가}
            </div>
            {summary.total_days > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                ({formatNumber((summary.total_exclusion_days.휴가 / summary.total_days) * 100)}%)
              </div>
            )}
          </div>
          <div
            className={`rounded-lg border p-4 ${
              summary.total_exclusion_days.개인사정 > 0
                ? "border-gray-200 bg-white"
                : "border-gray-100 bg-gray-50 opacity-60"
            }`}
          >
            <div className="text-xs font-medium text-gray-500">개인사정</div>
            <div className="mt-1 text-2xl font-bold text-purple-600">
              {summary.total_exclusion_days.개인사정}
            </div>
            {summary.total_days > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                ({formatNumber((summary.total_exclusion_days.개인사정 / summary.total_days) * 100)}%)
              </div>
            )}
          </div>
          <div
            className={`rounded-lg border p-4 ${
              summary.total_exclusion_days.지정휴일 > 0
                ? "border-yellow-200 bg-yellow-50"
                : "border-gray-100 bg-gray-50 opacity-60"
            }`}
          >
            <div className={`text-xs font-medium ${summary.total_exclusion_days.지정휴일 > 0 ? "text-yellow-700" : "text-gray-500"}`}>
              지정휴일
            </div>
            <div className={`mt-1 text-2xl font-bold ${summary.total_exclusion_days.지정휴일 > 0 ? "text-yellow-800" : "text-gray-600"}`}>
              {summary.total_exclusion_days.지정휴일}
            </div>
            {summary.total_days > 0 && (
              <div className="mt-1 text-xs text-gray-500">
                ({formatNumber((summary.total_exclusion_days.지정휴일 / summary.total_days) * 100)}%)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 상세 통계 */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">상세 통계</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-gray-500">학습일 총 시간</div>
            <div className="mt-1 text-lg font-semibold text-blue-600">
              {formatNumber(summary.total_study_hours_학습일)}시간
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">복습일 총 시간</div>
            <div className="mt-1 text-lg font-semibold text-green-600">
              {formatNumber(summary.total_study_hours_복습일)}시간
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">자율학습 총 시간</div>
            <div className="mt-1 text-lg font-semibold text-yellow-600">
              {formatNumber(summary.total_self_study_hours || 0)}시간
            </div>
          </div>
        </div>
      </div>

      {/* 학원일정 통계 */}
      {summary.academy_statistics && summary.academy_statistics.total_academy_schedules > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-gray-600" />
              <h3 className="text-sm font-semibold text-gray-900">학원일정 통계</h3>
            </div>
          </div>
          <div className="p-4">
            {/* 기본 통계 카드 */}
            <div className="grid gap-4 md:grid-cols-4 mb-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs font-medium text-gray-500">총 학원일정</div>
                <div className="mt-1 text-xl font-bold text-gray-900">
                  {summary.academy_statistics.total_academy_schedules}회
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs font-medium text-gray-500">고유 학원</div>
                <div className="mt-1 text-xl font-bold text-purple-600">
                  {summary.academy_statistics.unique_academies}개
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs font-medium text-gray-500">총 학원 수업 시간</div>
                <div className="mt-1 text-xl font-bold text-blue-600">
                  {formatNumber(summary.academy_statistics.total_academy_hours)}시간
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-xs font-medium text-gray-500">총 이동시간</div>
                <div className="mt-1 text-xl font-bold text-orange-600">
                  {formatNumber(summary.academy_statistics.total_travel_hours)}시간
                </div>
              </div>
            </div>

            {/* 이동시간 상세 */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-gray-600" />
                <div className="text-xs font-semibold text-gray-900">이동시간 통계</div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <div className="text-xs text-gray-500">평균 이동시간</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {formatNumber(summary.academy_statistics.average_travel_time)}분/회
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">학원일정으로 인한 학습 제외 시간</div>
                  <div className="mt-1 text-sm font-semibold text-orange-600">
                    {formatNumber(summary.academy_statistics.total_academy_hours + summary.academy_statistics.total_travel_hours)}시간
                  </div>
                </div>
              </div>
            </div>

            {/* 학원별 상세 정보 */}
            {summary.academy_statistics.academy_groups.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-900 mb-2">학원별 상세 정보</div>
                {summary.academy_statistics.academy_groups.map((group, idx) => {
                  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
                  const dayLabels = group.days_of_week.map((d) => dayNames[d]).join(", ");
                  
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {group.academy_name}
                            {group.subject && (
                              <span className="ml-1 text-gray-600">- {group.subject}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {dayLabels} ({group.total_count}회)
                          </div>
                        </div>
                        <div className="text-xs text-gray-500">
                          {group.time_range.start} ~ {group.time_range.end}
                        </div>
                      </div>
                      <div className="grid gap-2 md:grid-cols-3 mt-2 pt-2 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-500">총 수업 시간</div>
                          <div className="mt-0.5 text-xs font-semibold text-blue-600">
                            {formatNumber(group.total_academy_hours)}시간
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">총 이동시간</div>
                          <div className="mt-0.5 text-xs font-semibold text-orange-600">
                            {formatNumber(group.total_travel_hours)}시간
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">이동시간/회</div>
                          <div className="mt-0.5 text-xs font-semibold text-gray-700">
                            {group.travel_time}분
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 일별 스케줄 리스트 (주차별 그룹화) */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            일별 스케줄 ({daily_schedule.length}일)
          </h3>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <ScheduleListByWeek schedules={daily_schedule} />
        </div>
      </div>
    </div>
  );
}

// 주차별 그룹화 컴포넌트
function ScheduleListByWeek({ schedules }: { schedules: DailySchedule[] }) {
  // 주차별로 그룹화
  const schedulesByWeek = new Map<number | undefined, DailySchedule[]>();
  
  for (const schedule of schedules) {
    const weekNum = schedule.week_number;
    if (!schedulesByWeek.has(weekNum)) {
      schedulesByWeek.set(weekNum, []);
    }
    schedulesByWeek.get(weekNum)!.push(schedule);
  }

  // 주차 번호로 정렬 (undefined는 마지막)
  const sortedWeeks = Array.from(schedulesByWeek.entries()).sort((a, b) => {
    if (a[0] === undefined) return 1;
    if (b[0] === undefined) return -1;
    return a[0] - b[0];
  });

  return (
    <div>
      {sortedWeeks.map(([weekNum, weekSchedules]) => (
        <WeekSection key={weekNum ?? "no-week"} weekNum={weekNum} schedules={weekSchedules} />
      ))}
    </div>
  );
}

// 주차 섹션 컴포넌트
function WeekSection({ weekNum, schedules }: { weekNum: number | undefined; schedules: DailySchedule[] }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (weekNum === undefined) {
    // 주차 정보가 없는 경우 (자동 스케줄러 등)
    return (
      <div>
        {schedules.map((schedule) => (
          <ScheduleItem key={schedule.date} schedule={schedule} />
        ))}
      </div>
    );
  }

  const weekStart = schedules[0]?.date;
  const weekEnd = schedules[schedules.length - 1]?.date;
  const weekStartDate = weekStart ? new Date(weekStart) : null;
  const weekEndDate = weekEnd ? new Date(weekEnd) : null;

  const formatDateRange = () => {
    if (!weekStartDate || !weekEndDate) return "";
    return `${weekStart} ~ ${weekEnd}`;
  };

  const weekStudyDays = schedules.filter((s) => s.day_type === "학습일").length;
  const weekReviewDays = schedules.filter((s) => s.day_type === "복습일").length;
  const weekExclusionDays = schedules.filter((s) => 
    s.day_type === "휴가" || s.day_type === "개인일정" || s.day_type === "지정휴일"
  ).length;
  const weekTotalHours = schedules.reduce((sum, s) => sum + s.study_hours, 0);
  
  // 주차별 자율학습 시간 계산
  const weekSelfStudyHours = schedules.reduce((sum, s) => {
    if (!s.time_slots) return sum;
    const selfStudyMinutes = s.time_slots
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

  // 날짜 순으로 정렬
  const sortedSchedules = [...schedules].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            )}
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {weekNum}주차 {formatDateRange()}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-gray-600">
                <span>학습일 {weekStudyDays}일</span>
                <span>복습일 {weekReviewDays}일</span>
                {weekExclusionDays > 0 && (
                  <span className="text-gray-500">제외일 {weekExclusionDays}일</span>
                )}
                <span>총 {formatNumber(weekTotalHours)}시간</span>
                {weekSelfStudyHours > 0 && (
                  <span>자율학습 {formatNumber(weekSelfStudyHours)}시간</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
      {isExpanded && (
        <div>
          {sortedSchedules.map((schedule) => (
            <ScheduleItem key={schedule.date} schedule={schedule} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleItem({ schedule }: { schedule: DailySchedule }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];
    return `${dateStr} (${weekday})`;
  };

  // 시간 슬롯에서 각 타입별 시간 계산 (시간 단위)
  const calculateTimeFromSlots = (type: "자율학습" | "이동시간" | "학원일정"): number => {
    if (!schedule.time_slots) return 0;
    const minutes = schedule.time_slots
      .filter((slot) => slot.type === type)
      .reduce((sum, slot) => {
        const [startHour, startMin] = slot.start.split(":").map(Number);
        const [endHour, endMin] = slot.end.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return sum + (endMinutes - startMinutes);
      }, 0);
    return minutes / 60;
  };

  const selfStudyHours = calculateTimeFromSlots("자율학습");
  const travelHours = calculateTimeFromSlots("이동시간");
  const academyHours = calculateTimeFromSlots("학원일정");

  const hasDetails =
    schedule.academy_schedules && schedule.academy_schedules.length > 0;
  const hasExclusion = schedule.exclusion !== null && schedule.exclusion !== undefined;
  const hasTimeSlots = schedule.time_slots && schedule.time_slots.length > 0;

  return (
    <div className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
      <div
        className={`w-full px-4 py-3 ${hasDetails || hasExclusion || hasTimeSlots ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (hasDetails || hasExclusion || hasTimeSlots) {
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {formatDate(schedule.date)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                  dayTypeColors[schedule.day_type] || dayTypeColors["학습일"]
                }`}
              >
                {dayTypeLabels[schedule.day_type] || schedule.day_type}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
              <div className="flex items-center gap-4">
                <span className="font-medium">
                  학습 시간: {formatNumber(schedule.study_hours)}시간
                </span>
                <span>
                  자율 학습 시간: {formatNumber(selfStudyHours)}시간
                </span>
              </div>
              {(travelHours > 0 || academyHours > 0) && (
                <div className="flex items-center gap-4">
                  {travelHours > 0 && (
                    <span>이동시간: {formatNumber(travelHours)}시간</span>
                  )}
                  {academyHours > 0 && (
                    <span>학원 시간: {formatNumber(academyHours)}시간</span>
                  )}
                </div>
              )}
            </div>
          </div>
            {(hasDetails || hasExclusion || hasTimeSlots) && (
            <div className="flex-shrink-0">
              {isExpanded ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 확장된 상세 정보 */}
      {isExpanded && (hasDetails || hasExclusion || hasTimeSlots) && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="space-y-4">
            {/* 시간 타임라인 */}
            {hasTimeSlots && schedule.time_slots && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <div className="text-xs font-medium text-gray-700">시간 구성</div>
                </div>
                <div className="ml-6 space-y-1.5">
                  {schedule.time_slots.map((slot, idx) => (
                    <TimeSlotItem key={idx} slot={slot} index={idx + 1} />
                  ))}
                </div>
              </div>
            )}

            {/* 제외일 정보 */}
            {hasExclusion && schedule.exclusion && (
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700">
                    {schedule.exclusion.exclusion_type === "휴가"
                      ? "휴가"
                      : schedule.exclusion.exclusion_type === "개인사정"
                        ? "개인사정"
                        : schedule.exclusion.exclusion_type === "휴일지정"
                          ? "지정휴일"
                          : "제외일"}
                  </div>
                  {schedule.exclusion.reason && (
                    <div className="mt-1 text-xs text-gray-600">
                      {schedule.exclusion.reason}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 학원일정 정보 */}
            {hasDetails && schedule.academy_schedules && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div className="text-xs font-medium text-gray-700">
                    학원일정 ({schedule.academy_schedules.length}개)
                  </div>
                </div>
                <div className="ml-6 space-y-1.5">
                  {schedule.academy_schedules.map((academy, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-gray-900">
                          {academy.academy_name || "학원"}
                          {academy.subject && (
                            <span className="ml-1 text-gray-600">
                              ({academy.subject})
                            </span>
                          )}
                        </div>
                        <div className="text-gray-600">
                          {academy.start_time} ~ {academy.end_time}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 시간 슬롯 아이템 컴포넌트
function TimeSlotItem({ slot, index }: { slot: TimeSlot; index: number }) {
  const getSlotLabel = () => {
    if (slot.label) return slot.label;
    return slot.type;
  };

  const getSlotColor = () => {
    switch (slot.type) {
      case "학습시간":
        return "bg-blue-50 border-blue-200 text-blue-800";
      case "점심시간":
        return "bg-orange-50 border-orange-200 text-orange-800";
      case "학원일정":
        return "bg-purple-50 border-purple-200 text-purple-800";
      case "이동시간":
        return "bg-gray-50 border-gray-200 text-gray-800";
      case "자율학습":
        return "bg-green-50 border-green-200 text-green-800";
      default:
        return "bg-gray-50 border-gray-200 text-gray-800";
    }
  };

  return (
    <div className={`rounded border px-3 py-2 text-xs ${getSlotColor()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{index}.</span>
          <span className="font-medium">{getSlotLabel()}</span>
        </div>
        <span className="text-gray-600">
          {slot.start} ~ {slot.end}
        </span>
      </div>
    </div>
  );
}

