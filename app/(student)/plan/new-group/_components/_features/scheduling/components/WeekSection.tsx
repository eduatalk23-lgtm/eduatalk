import {
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { DailySchedule, Plan } from "./scheduleTypes";
import type { ContentData, BlockData } from "../../../utils/scheduleTransform";
import { formatNumber } from "@/lib/utils/formatNumber";
import { ScheduleItem } from "./ScheduleItem";

// 주차 섹션 컴포넌트
export function WeekSection({
  weekNum,
  schedules,
  plansByDate,
  contents,
  blocks,
  sequenceMap,
  expandedDates,
  onToggleDate,
  isExpanded,
  onToggleWeek,
}: {
  weekNum: number | undefined;
  schedules: DailySchedule[];
  plansByDate: Map<string, Plan[]>;
  contents: Map<string, ContentData>;
  blocks: BlockData[];
  sequenceMap: Map<string, number>;
  expandedDates: Map<string, boolean>;
  onToggleDate: (date: string) => void;
  isExpanded: boolean;
  onToggleWeek: () => void;
}) {
  if (weekNum === undefined) {
    // 주차 정보가 없는 경우 (예외 상황 보정)
    return (
      <div>
        {schedules.map((schedule) => {
          const datePlans = plansByDate.get(schedule.date) || [];
          return (
            <ScheduleItem
              key={schedule.date}
              schedule={schedule}
              datePlans={datePlans}
              contents={contents}
              blocks={blocks}
              sequenceMap={sequenceMap}
              isExpanded={expandedDates.get(schedule.date) ?? false}
              onToggle={() => onToggleDate(schedule.date)}
            />
          );
        })}
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
  const weekReviewDays = schedules.filter(
    (s) => s.day_type === "복습일"
  ).length;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const weekExclusionDays = schedules.filter(
    (s) =>
      s.day_type === "휴가" ||
      s.day_type === "개인일정" ||
      s.day_type === "지정휴일"
  ).length;

  // 주차별 순수 학습 시간 계산 (time_slots에서 "학습시간" 타입만)
  const weekTotalHours = schedules.reduce((sum, s) => {
    // 지정휴일은 학습 시간이 없으므로 제외
    if (s.day_type === "지정휴일") return sum;
    if (!s.time_slots) return sum;
    const studyMinutes = s.time_slots
      .filter((slot) => slot.type === "학습시간")
      .reduce((slotSum, slot) => {
        const [startHour, startMin] = slot.start.split(":").map(Number);
        const [endHour, endMin] = slot.end.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        return slotSum + (endMinutes - startMinutes);
      }, 0);
    return sum + studyMinutes / 60;
  }, 0);

  // 주차별 자율학습 시간 계산
  // 지정휴일의 경우 study_hours가 이미 자율학습 시간을 포함하므로 중복 계산 방지
  const weekSelfStudyHours = schedules.reduce((sum, s) => {
    // 지정휴일인 경우 study_hours가 자율학습 시간이므로 그대로 사용
    if (s.day_type === "지정휴일") {
      return sum + s.study_hours;
    }
    // 일반 학습일/복습일의 경우 time_slots에서 자율학습 시간 계산
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
  const sortedSchedules = [...schedules].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={onToggleWeek}
        className="w-full bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-gray-600" />
            ) : (
              <ChevronDown className="h-5 w-5 text-gray-600" />
            )}
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-gray-900">
                {weekNum}주차 {formatDateRange()}
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>
                    학습일 {weekStudyDays}일
                    {weekReviewDays > 0 && <> + 복습일 {weekReviewDays}일</>}
                  </span>
                  <span>학습시간 {formatNumber(weekTotalHours)}시간</span>
                  {weekSelfStudyHours > 0 && (
                    <span>
                      자율학습시간 {formatNumber(weekSelfStudyHours)}시간
                    </span>
                  )}
                  <span>
                    총시간 {formatNumber(weekTotalHours + weekSelfStudyHours)}
                    시간
                  </span>
                </div>
                {weekStudyDays + weekReviewDays > 0 && (
                  <div className="text-xs text-gray-600">
                    평균:{" "}
                    {formatNumber(
                      (weekTotalHours + weekSelfStudyHours) /
                        (weekStudyDays + weekReviewDays)
                    )}
                    시간/일 ({formatNumber(weekTotalHours + weekSelfStudyHours)}
                    시간 ÷ {weekStudyDays + weekReviewDays}일)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </button>
      {isExpanded && (
        <div>
          {sortedSchedules.map((schedule) => {
            const datePlans = plansByDate.get(schedule.date) || [];
            return (
              <ScheduleItem
                key={schedule.date}
                schedule={schedule}
                datePlans={datePlans}
                contents={contents}
                blocks={blocks}
                sequenceMap={sequenceMap}
                isExpanded={expandedDates.get(schedule.date) ?? false}
                onToggle={() => onToggleDate(schedule.date)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
