import { memo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  XCircle,
} from "lucide-react";
import type { DailySchedule, Plan } from "./scheduleTypes";
import type { ContentData, BlockData } from "../../../utils/scheduleTransform";
import { formatNumber } from "@/lib/utils/formatNumber";
import { TimelineBar } from "./TimelineBar";
import { TimeSlotsWithPlans } from "./TimeSlotsWithPlans";
import { dayTypeLabels, dayTypeColors } from "./scheduleUtils";

export const ScheduleItem = memo(
  function ScheduleItem({
    schedule,
    datePlans,
    contents,
    blocks,
    sequenceMap,
    isExpanded,
    onToggle,
  }: {
    schedule: DailySchedule;
    datePlans: Plan[];
    contents: Map<string, ContentData>;
    blocks: BlockData[];
    sequenceMap: Map<string, number>;
    isExpanded: boolean;
    onToggle: () => void;
  }) {
    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
      const weekday = weekdays[date.getDay()];
      return `${dateStr} (${weekday})`;
    };

    const hasDetails =
      schedule.academy_schedules && schedule.academy_schedules.length > 0;
    const hasExclusion =
      schedule.exclusion !== null && schedule.exclusion !== undefined;
    const hasTimeSlots = schedule.time_slots && schedule.time_slots.length > 0;

    return (
      <div className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
        <div
          className={`w-full px-4 py-3 ${
            hasDetails || hasExclusion || hasTimeSlots ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (hasDetails || hasExclusion || hasTimeSlots) {
              onToggle();
            }
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex flex-col gap-2">
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
                {/* 시간 슬롯에서 각 타입별 시간 계산 (시간 단위) */}
                {(() => {
                const calculateTimeFromSlots = (
                  type: "학습시간" | "자율학습" | "이동시간" | "학원일정"
                ): number => {
                  if (!schedule.time_slots) return 0;
                  const minutes = schedule.time_slots
                    .filter((slot) => slot.type === type)
                    .reduce((sum, slot) => {
                      const [startHour, startMin] = slot.start
                        .split(":")
                        .map(Number);
                      const [endHour, endMin] = slot.end.split(":").map(Number);
                      const startMinutes = startHour * 60 + startMin;
                      const endMinutes = endHour * 60 + endMin;
                      return sum + (endMinutes - startMinutes);
                    }, 0);
                  return minutes / 60;
                };

                // 지정휴일인 경우 study_hours가 자율학습 시간이므로 별도 계산 불필요
                const isDesignatedHoliday = schedule.day_type === "지정휴일";

                // 순수 학습 시간: time_slots에서 "학습시간" 타입만 계산
                const studyHours = calculateTimeFromSlots("학습시간");
                const selfStudyHours = isDesignatedHoliday
                  ? schedule.study_hours
                  : calculateTimeFromSlots("자율학습");
                const travelHours = calculateTimeFromSlots("이동시간");
                const academyHours = calculateTimeFromSlots("학원일정");

                return (
                  <div className="flex flex-col gap-1 text-xs text-gray-600">
                    {isDesignatedHoliday ? (
                      // 지정휴일인 경우 자율학습 시간만 표기
                      <div className="flex items-center gap-4">
                        <span className="font-medium">
                          자율 학습 시간: {formatNumber(selfStudyHours)}시간
                        </span>
                      </div>
                    ) : (
                      // 일반 학습일/복습일인 경우 학습 시간과 자율학습 시간 별도 표기
                      <>
                        <div className="flex items-center gap-4">
                          <span className="font-medium">
                            학습 시간: {formatNumber(studyHours)}시간
                          </span>
                          {selfStudyHours > 0 && (
                            <span>
                              자율 학습 시간: {formatNumber(selfStudyHours)}시간
                            </span>
                          )}
                          {datePlans.length > 0 && (
                            <span>플랜: {datePlans.length}개</span>
                          )}
                        </div>
                        {(travelHours > 0 || academyHours > 0) && (
                          <div className="flex items-center gap-4">
                            {travelHours > 0 && (
                              <span>
                                이동시간: {formatNumber(travelHours)}시간
                              </span>
                            )}
                            {academyHours > 0 && (
                              <span>
                                학원 시간: {formatNumber(academyHours)}시간
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* 타임라인 바 그래프 */}
                    {schedule.time_slots && schedule.time_slots.length > 0 && (
                      <TimelineBar
                        timeSlots={schedule.time_slots}
                        totalHours={
                          studyHours +
                          selfStudyHours +
                          travelHours +
                          academyHours
                        }
                      />
                    )}
                  </div>
                );
              })()}
              {schedule.note && (
                <div className="text-xs text-gray-600">
                  {schedule.note}
                </div>
              )}
              </div>
            </div>
            {(hasDetails || hasExclusion || hasTimeSlots) && (
              <div className="flex-shrink-0 relative z-10">
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-600" />
                )}
              </div>
            )}
          </div>
        </div>

        {/* 확장된 상세 정보 */}
        {isExpanded && (hasDetails || hasExclusion || hasTimeSlots) && (
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex flex-col gap-4">
              {/* 시간 타임라인 */}
              {hasTimeSlots && schedule.time_slots && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-600" />
                    <div className="text-xs font-medium text-gray-600">
                      시간 구성
                    </div>
                  </div>
                  <div className="pl-6 flex flex-col gap-1.5">
                    <TimeSlotsWithPlans
                      timeSlots={schedule.time_slots}
                      date={schedule.date}
                      datePlans={datePlans}
                      contents={contents}
                      blocks={blocks}
                      dayType={schedule.day_type}
                      totalStudyHours={schedule.study_hours}
                      sequenceMap={sequenceMap}
                    />
                  </div>
                </div>
              )}

              {/* 제외일 정보 */}
              {hasExclusion && schedule.exclusion && (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 flex-shrink-0 text-gray-600 self-start" />
                  <div className="flex-1">
                    <div className="flex flex-col gap-1">
                      <div className="text-xs font-medium text-gray-600">
                        {schedule.exclusion.exclusion_type === "휴가"
                          ? "휴가"
                          : schedule.exclusion.exclusion_type === "개인사정"
                          ? "개인사정"
                          : schedule.exclusion.exclusion_type === "휴일지정"
                          ? "지정휴일"
                          : "제외일"}
                      </div>
                      {schedule.exclusion.reason && (
                        <div className="text-xs text-gray-600">
                          {schedule.exclusion.reason}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 학원일정 정보 */}
              {hasDetails && schedule.academy_schedules && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-600" />
                    <div className="text-xs font-medium text-gray-600">
                      학원일정 ({schedule.academy_schedules.length}개)
                    </div>
                  </div>
                  <div className="pl-6 flex flex-col gap-1.5">
                    {schedule.academy_schedules.map((academy, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 font-medium text-gray-900">
                            <span>{academy.academy_name || "학원"}</span>
                            {academy.subject && (
                              <span className="text-gray-600">
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
  },
  (prevProps, nextProps) => {
    // 커스텀 비교 함수로 불필요한 재렌더링 방지
    return (
      prevProps.schedule.date === nextProps.schedule.date &&
      prevProps.isExpanded === nextProps.isExpanded &&
      prevProps.datePlans.length === nextProps.datePlans.length &&
      prevProps.sequenceMap.size === nextProps.sequenceMap.size &&
      prevProps.schedule.day_type === nextProps.schedule.day_type &&
      prevProps.schedule.study_hours === nextProps.schedule.study_hours
    );
  }
);
