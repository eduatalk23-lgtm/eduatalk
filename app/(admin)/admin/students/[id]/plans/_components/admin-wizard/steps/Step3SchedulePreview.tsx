"use client";

/**
 * Step 3: 스케줄 미리보기
 *
 * Phase 3: 7단계 위저드 확장
 * - 설정된 블록과 제외일 기반 스케줄 미리보기
 * - 일간/주간 뷰 전환
 * - 설정 수정 링크 (Step 2로 이동)
 *
 * @module app/(admin)/admin/students/[id]/plans/_components/admin-wizard/steps/Step3SchedulePreview
 */

import { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  ArrowLeft,
  Info,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  List,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  useAdminWizardData,
  useAdminWizardStep,
} from "../_context";
import { WeeklyAvailabilityTimeline } from "./_components/WeeklyAvailabilityTimeline";

/**
 * Step3SchedulePreview Props
 */
interface Step3SchedulePreviewProps {
  studentId: string;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

type ViewMode = "timeline" | "week" | "day";

/**
 * 주어진 기간의 날짜 배열 생성
 */
function getDateRange(start: string, end: string): Date[] {
  const dates: Date[] = [];
  const startDate = new Date(start);
  const endDate = new Date(end);

  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * 주 단위로 날짜 그룹화
 */
function getWeeksFromDates(dates: Date[]): Date[][] {
  if (dates.length === 0) return [];

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  // 첫 주의 시작을 일요일로 맞추기 위해 빈 날짜 추가
  const firstDayOfWeek = dates[0].getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push(new Date(0)); // placeholder
  }

  for (const date of dates) {
    currentWeek.push(date);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 마지막 주가 7일 미만이면 추가
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Step 3: 스케줄 미리보기 컴포넌트
 */
export function Step3SchedulePreview({
  studentId,
}: Step3SchedulePreviewProps) {
  const { wizardData } = useAdminWizardData();
  const { setStep } = useAdminWizardStep();

  const {
    periodStart,
    periodEnd,
    academySchedules,
    exclusions,
    blockSetId,
    name,
    studyHours,
    selfStudyHours,
    lunchTime,
    nonStudyTimeBlocks,
  } = wizardData;

  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);

  // 날짜 배열과 주 단위 그룹화
  const dates = useMemo(() => {
    if (!periodStart || !periodEnd) return [];
    return getDateRange(periodStart, periodEnd);
  }, [periodStart, periodEnd]);

  const weeks = useMemo(() => getWeeksFromDates(dates), [dates]);

  // 제외일 세트 (빠른 조회용)
  const exclusionDates = useMemo(() => {
    return new Set(exclusions.map((e) => e.exclusion_date));
  }, [exclusions]);

  // 특정 요일의 학원 스케줄
  const getAcademyScheduleForDay = (dayOfWeek: number) => {
    return academySchedules.filter((s) => s.day_of_week === dayOfWeek);
  };

  // 날짜가 유효한지 (placeholder가 아닌지)
  const isValidDate = (date: Date) => date.getTime() !== 0;

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    if (!isValidDate(date)) return "";
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatDateFull = (date: Date) => {
    if (!isValidDate(date)) return "";
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  };

  // 해당 날짜가 제외일인지
  const isExclusionDate = (date: Date) => {
    if (!isValidDate(date)) return false;
    const dateStr = date.toISOString().split("T")[0];
    return exclusionDates.has(dateStr);
  };

  // 현재 주의 날짜 범위
  const currentWeek = weeks[currentWeekIndex] || [];
  const weekStart = currentWeek.find(isValidDate);
  const weekEnd = [...currentWeek].reverse().find(isValidDate);

  // 통계 계산
  const stats = useMemo(() => {
    const totalDays = dates.length;
    const excludedDays = exclusions.length;
    const studyDays = totalDays - excludedDays;
    const academyDays = new Set(academySchedules.map((s) => s.day_of_week)).size;

    return { totalDays, excludedDays, studyDays, academyDays };
  }, [dates, exclusions, academySchedules]);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">스케줄 미리보기</h3>
          <p className="text-sm text-gray-600">
            설정된 스케줄을 확인하고 다음 단계로 진행하세요.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setStep(2)}
          data-testid="edit-settings-button"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          설정 수정
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3" data-testid="schedule-stats">
        <div className="rounded-lg border border-gray-200 bg-white p-3" data-testid="stat-total-days">
          <p className="text-xs text-gray-500">전체 기간</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {stats.totalDays}일
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">학습 가능일</p>
          <p className="mt-1 text-lg font-semibold text-blue-600">
            {stats.studyDays}일
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">제외일</p>
          <p className="mt-1 text-lg font-semibold text-red-600">
            {stats.excludedDays}일
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">학원 스케줄</p>
          <p className="mt-1 text-lg font-semibold text-orange-600">
            주 {stats.academyDays}일
          </p>
        </div>
      </div>

      {/* 뷰 전환 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setViewMode("timeline")}
            data-testid="view-mode-timeline"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "timeline"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <BarChart3 className="h-4 w-4" />
            타임라인
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            data-testid="view-mode-week"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "week"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Calendar className="h-4 w-4" />
            캘린더
          </button>
          <button
            type="button"
            onClick={() => setViewMode("day")}
            data-testid="view-mode-day"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "day"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <List className="h-4 w-4" />
            리스트
          </button>
        </div>

        {viewMode === "week" && weeks.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentWeekIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentWeekIndex === 0}
              data-testid="prev-week-button"
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600">
              {weekStart && weekEnd
                ? `${formatDateFull(weekStart)} ~ ${formatDateFull(weekEnd)}`
                : ""}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentWeekIndex((prev) => Math.min(weeks.length - 1, prev + 1))
              }
              disabled={currentWeekIndex === weeks.length - 1}
              data-testid="next-week-button"
              className="rounded p-1 hover:bg-gray-100 disabled:opacity-50"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      {/* 타임라인 뷰 (신규) */}
      {viewMode === "timeline" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <WeeklyAvailabilityTimeline
            studyHours={studyHours ?? null}
            selfStudyHours={selfStudyHours}
            lunchTime={lunchTime ?? null}
            academySchedules={academySchedules}
            nonStudyTimeBlocks={nonStudyTimeBlocks}
          />
        </div>
      )}

      {/* 주간 캘린더 뷰 */}
      {viewMode === "week" && (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  "py-2 text-center text-xs font-medium",
                  i === 0 ? "text-red-600" : i === 6 ? "text-blue-600" : "text-gray-700"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7">
            {currentWeek.map((date, index) => {
              const isValid = isValidDate(date);
              const isExcluded = isExclusionDate(date);
              const dayOfWeek = isValid ? date.getDay() : index;
              const academyForDay = getAcademyScheduleForDay(dayOfWeek);
              const hasAcademy = academyForDay.length > 0;

              return (
                <div
                  key={index}
                  className={cn(
                    "min-h-[100px] border-b border-r border-gray-200 p-2",
                    !isValid && "bg-gray-50",
                    isExcluded && "bg-red-50",
                    index === 6 && "border-r-0"
                  )}
                >
                  {isValid && (
                    <>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          isExcluded
                            ? "text-red-600"
                            : dayOfWeek === 0
                              ? "text-red-600"
                              : dayOfWeek === 6
                                ? "text-blue-600"
                                : "text-gray-900"
                        )}
                      >
                        {formatDate(date)}
                      </p>
                      <div className="mt-1 space-y-1">
                        {isExcluded && (
                          <span className="block rounded bg-red-100 px-1 py-0.5 text-xs text-red-700">
                            제외
                          </span>
                        )}
                        {hasAcademy &&
                          academyForDay.map((schedule, i) => (
                            <span
                              key={i}
                              className="block rounded bg-orange-100 px-1 py-0.5 text-xs text-orange-700"
                            >
                              {schedule.academy_name || "학원"}{" "}
                              {schedule.start_time.slice(0, 5)}
                            </span>
                          ))}
                        {!isExcluded && !hasAcademy && (
                          <span className="block rounded bg-blue-100 px-1 py-0.5 text-xs text-blue-700">
                            학습
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 일간 리스트 뷰 */}
      {viewMode === "day" && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
          {dates.slice(0, 30).map((date) => {
            const isExcluded = isExclusionDate(date);
            const dayOfWeek = date.getDay();
            const academyForDay = getAcademyScheduleForDay(dayOfWeek);

            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2",
                  isExcluded
                    ? "border-red-200 bg-red-50"
                    : "border-gray-200 bg-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-8 text-center text-xs font-medium",
                      dayOfWeek === 0
                        ? "text-red-600"
                        : dayOfWeek === 6
                          ? "text-blue-600"
                          : "text-gray-700"
                    )}
                  >
                    {WEEKDAYS[dayOfWeek]}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {formatDateFull(date)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isExcluded ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      제외
                    </span>
                  ) : academyForDay.length > 0 ? (
                    academyForDay.map((schedule, i) => (
                      <span
                        key={i}
                        className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"
                      >
                        {schedule.academy_name || "학원"}{" "}
                        {schedule.start_time.slice(0, 5)}-{schedule.end_time.slice(0, 5)}
                      </span>
                    ))
                  ) : (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      학습 가능
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {dates.length > 30 && (
            <p className="py-2 text-center text-sm text-gray-500">
              외 {dates.length - 30}일 더...
            </p>
          )}
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">스케줄 미리보기</p>
          <p className="mt-1 text-blue-700">
            위 캘린더에서 학습 가능일과 제외일을 확인하세요.
            수정이 필요하면 &quot;설정 수정&quot; 버튼을 눌러 이전 단계로 돌아갈 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
