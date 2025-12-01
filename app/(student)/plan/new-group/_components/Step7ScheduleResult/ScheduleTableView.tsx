"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronUp, Clock, School, MapPin, Utensils, XCircle, Calendar } from "lucide-react";
import type { BlockData, ContentData } from "../utils/scheduleTransform";
import { formatNumber } from "@/lib/utils/formatNumber";
import { TimelineBar } from "./TimelineBar";

type DailySchedule = {
  date: string;
  day_type: string;
  study_hours: number;
  week_number?: number; // 주차 번호 (선택적)
  time_slots?: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
    label?: string;
  }>;
  exclusion?: {
    exclusion_type: string;
    reason?: string;
  } | null;
  academy_schedules?: Array<{
    academy_name?: string;
    subject?: string;
    start_time: string;
    end_time: string;
  }>;
};

type Plan = {
  id: string;
  plan_date: string;
  block_index: number | null;
  content_type: string;
  content_id: string;
  chapter: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_amount: number | null;
  plan_number: number | null;
  sequence: number | null;
};

type ScheduleTableViewProps = {
  dailySchedule: DailySchedule[];
  plans: Plan[];
  contents: Map<string, ContentData>;
  blocks: BlockData[];
};

// 전체 플랜에서 회차 계산을 위한 헬퍼
// 저장된 sequence가 있으면 사용하고, 없으면 계산
// 같은 plan_number를 가진 플랜들은 같은 회차를 가짐
function calculateSequenceForPlan(
  plan: Plan,
  allPlans: Plan[]
): number {
  // 저장된 sequence가 있으면 사용
  if (plan.sequence !== null && plan.sequence !== undefined) {
    return plan.sequence;
  }
  
  // 같은 content_id를 가진 플랜들 필터링
  const sameContentPlans = allPlans.filter((p) => p.content_id === plan.content_id);
  
  // plan_number가 null이 아닌 경우, 같은 plan_number를 가진 첫 번째 플랜의 회차를 사용
  if (plan.plan_number !== null) {
    const firstPlanWithSameNumber = sameContentPlans.find(
      (p) => p.plan_number === plan.plan_number && p.sequence !== null && p.sequence !== undefined
    );
    
    if (firstPlanWithSameNumber) {
      // 같은 plan_number를 가진 플랜의 저장된 회차 사용
      return firstPlanWithSameNumber.sequence!;
    }
    
    // 저장된 회차가 없으면 계산
    const firstPlanWithSameNumberForCalc = sameContentPlans.find(
      (p) => p.plan_number === plan.plan_number
    );
    
    if (firstPlanWithSameNumberForCalc && firstPlanWithSameNumberForCalc.id !== plan.id) {
      // 같은 plan_number를 가진 첫 번째 플랜의 회차 계산 (재귀 호출)
      return calculateSequenceForPlan(firstPlanWithSameNumberForCalc, allPlans);
    }
  }
  
  // plan_number가 null이거나 같은 plan_number를 가진 첫 번째 플랜인 경우
  // 날짜와 planned_start_page_or_time 순으로 정렬하여 회차 계산
  const sortedPlans = sameContentPlans
    .sort((a, b) => {
      // 날짜 순
      if (a.plan_date !== b.plan_date) {
        return a.plan_date.localeCompare(b.plan_date);
      }
      // 같은 날짜면 planned_start_page_or_time 순
      const aStart = a.planned_start_page_or_time || 0;
      const bStart = b.planned_start_page_or_time || 0;
      return aStart - bStart;
    });
  
  // plan_number를 고려하여 회차 계산
  const seenPlanNumbers = new Set<number | null>();
  let sequence = 1;
  
  for (const p of sortedPlans) {
    if (p.id === plan.id) {
      break;
    }
    
    const pn = p.plan_number;
    
    // plan_number가 null이면 개별 카운트
    if (pn === null) {
      sequence++;
    } else {
      // plan_number가 있으면 같은 번호를 가진 그룹은 한 번만 카운트
      if (!seenPlanNumbers.has(pn)) {
        seenPlanNumbers.add(pn);
        sequence++;
      }
    }
  }
  
  return sequence;
}

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

export function ScheduleTableView({
  dailySchedule,
  plans,
  contents,
  blocks,
}: ScheduleTableViewProps) {
  // 전체 플랜에서 회차 계산을 위한 Map 생성
  const sequenceMap = new Map<string, number>();
  if (plans && Array.isArray(plans)) {
    plans.forEach((plan) => {
      sequenceMap.set(plan.id, calculateSequenceForPlan(plan, plans));
    });
  }
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    const newExpanded = new Set(expandedDates);
    if (newExpanded.has(date)) {
      newExpanded.delete(date);
    } else {
      newExpanded.add(date);
    }
    setExpandedDates(newExpanded);
  };

  if (!dailySchedule || dailySchedule.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm text-gray-500">표시할 데이터가 없습니다.</p>
      </div>
    );
  }

  // 날짜별로 플랜 그룹화
  const plansByDate = new Map<string, Plan[]>();
  if (plans && Array.isArray(plans)) {
    plans.forEach((plan) => {
      if (!plansByDate.has(plan.plan_date)) {
        plansByDate.set(plan.plan_date, []);
      }
      plansByDate.get(plan.plan_date)!.push(plan);
    });
  }

  // 주차별 그룹화가 가능한지 확인 (week_number가 있는지)
  const hasWeekNumbers = dailySchedule.some((s) => s.week_number !== undefined);

  return (
    <div className="w-full rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">
          일별 스케줄 ({dailySchedule.length}일)
        </h3>
      </div>
      <div className="max-h-[800px] overflow-y-auto">
        {hasWeekNumbers ? (
          <ScheduleListByWeek
            schedules={dailySchedule}
            plansByDate={plansByDate}
            contents={contents}
            blocks={blocks}
            sequenceMap={sequenceMap}
            expandedDates={expandedDates}
            onToggleDate={toggleDate}
          />
        ) : (
          // 주차 정보가 없으면 날짜 순으로 정렬하여 표시
          [...(dailySchedule || [])]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((schedule) => {
              const datePlans = plansByDate.get(schedule.date) || [];
              return (
                <ScheduleItem
                  key={schedule.date}
                  schedule={schedule}
                  datePlans={datePlans}
                  contents={contents}
                  blocks={blocks}
                  sequenceMap={sequenceMap}
                  isExpanded={expandedDates.has(schedule.date)}
                  onToggle={() => toggleDate(schedule.date)}
                />
              );
            })
        )}
      </div>
    </div>
  );
}

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
  const hasExclusion = schedule.exclusion !== null && schedule.exclusion !== undefined;
  const hasTimeSlots = schedule.time_slots && schedule.time_slots.length > 0;

  return (
    <div className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
      <div
        className={`w-full px-4 py-3 ${hasDetails || hasExclusion || hasTimeSlots ? "cursor-pointer" : ""}`}
        onClick={() => {
          if (hasDetails || hasExclusion || hasTimeSlots) {
            onToggle();
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
            {/* 시간 슬롯에서 각 타입별 시간 계산 (시간 단위) */}
            {(() => {
              const calculateTimeFromSlots = (type: "학습시간" | "자율학습" | "이동시간" | "학원일정"): number => {
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
                <div className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
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
                            <span>이동시간: {formatNumber(travelHours)}시간</span>
                          )}
                          {academyHours > 0 && (
                            <span>학원 시간: {formatNumber(academyHours)}시간</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* 타임라인 바 그래프 */}
                  {schedule.time_slots && schedule.time_slots.length > 0 && (
                    <TimelineBar 
                      timeSlots={schedule.time_slots}
                      totalHours={studyHours + selfStudyHours + travelHours + academyHours}
                    />
                  )}
                </div>
              );
            })()}
            {schedule.note && (
              <div className="mt-1 text-xs text-gray-500">{schedule.note}</div>
            )}
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

// 모든 시간 슬롯과 플랜을 함께 처리하는 컴포넌트 (플랜이 여러 블록에 걸칠 수 있음)
function TimeSlotsWithPlans({
  timeSlots,
  date,
  datePlans,
  contents,
  blocks,
  dayType,
  totalStudyHours,
  sequenceMap,
}: {
  timeSlots: Array<{
    type: "학습시간" | "점심시간" | "학원일정" | "이동시간" | "자율학습";
    start: string;
    end: string;
    label?: string;
  }>;
  date: string;
  datePlans: Plan[];
  contents: Map<string, ContentData>;
  blocks: BlockData[];
  dayType: string;
  totalStudyHours: number;
  sequenceMap: Map<string, number>;
}) {
  // 학습시간과 자율학습 블록 필터링
  const studyTimeSlots = timeSlots.filter(
    (slot) => slot.type === "학습시간" || slot.type === "자율학습"
  );

  // 이동시간과 학원일정 슬롯 필터링
  const travelAndAcademySlots = timeSlots.filter(
    (slot) => slot.type === "이동시간" || slot.type === "학원일정"
  );

  // 플랜 정보 준비
  const plansWithInfo = datePlans.map((plan) => {
    const startTime = getPlanStartTime(plan, date, blocks);
    const estimatedTime = calculateEstimatedTime(plan, contents, dayType);
    return {
      plan,
      originalStartTime: startTime ? timeToMinutes(startTime) : null,
      originalEstimatedTime: estimatedTime, // 원래 예상 소요시간 저장
      estimatedTime, // 배치에 사용할 시간
      remainingTime: estimatedTime, // 남은 시간 추적
      blockIndex: plan.block_index,
    };
  });

  // 복습일이고 예상 소요시간이 총 학습시간보다 큰 경우 평균 시간으로 조정
  const isReviewDay = dayType === "복습일";
  const totalEstimatedTime = plansWithInfo.reduce((sum, p) => sum + p.originalEstimatedTime, 0);
  const totalStudyMinutes = totalStudyHours * 60;

  if (isReviewDay && totalEstimatedTime > totalStudyMinutes && datePlans.length > 0) {
    // 평균 시간 계산
    const averageTime = Math.floor(totalStudyMinutes / datePlans.length);
    plansWithInfo.forEach((p) => {
      p.estimatedTime = averageTime;
      p.remainingTime = averageTime;
      // originalEstimatedTime은 그대로 유지 (강조 표시용)
    });
  }

  // 플랜을 시간 순으로 정렬 (시작 시간이 있는 것 우선, 같은 날 모든 플랜 우선 배치)
  const sortedPlans = [...plansWithInfo].sort((a, b) => {
    if (a.originalStartTime !== null && b.originalStartTime !== null) {
      return a.originalStartTime - b.originalStartTime;
    }
    if (a.originalStartTime !== null) return -1;
    if (b.originalStartTime !== null) return 1;
    return (a.blockIndex || 0) - (b.blockIndex || 0);
  });

  // 각 학습시간 블록에 플랜 배치
  const slotPlansMap = new Map<number, Array<{
    plan: Plan;
    start: string;
    end: string;
    isPartial: boolean;
    isContinued: boolean; // 이전 블록에서 이어지는지
    originalEstimatedTime: number; // 원래 예상 소요시간
  }>>();

  // 각 슬롯에 플랜 배치 (같은 날 모든 플랜 우선 배치)
  studyTimeSlots.forEach((slot, slotIdx) => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    const plansInSlot: Array<{
      plan: Plan;
      start: string;
      end: string;
      isPartial: boolean;
      isContinued: boolean;
      originalEstimatedTime: number;
    }> = [];

    // 시작 시간이 있는 플랜들 배치
    for (const planInfo of sortedPlans) {
      if (planInfo.remainingTime <= 0) continue;

      if (planInfo.originalStartTime !== null) {
        const planStart = planInfo.originalStartTime;
        const planEnd = planStart + planInfo.originalEstimatedTime; // 원래 예상 시간 사용

        // 플랜이 이 슬롯과 겹치는지 확인
        if (planStart < slotEnd && planEnd > slotStart) {
          const slotAvailableStart = Math.max(planStart, slotStart);
          const slotAvailableEnd = Math.min(planStart + planInfo.remainingTime, slotEnd);

          if (slotAvailableStart < slotAvailableEnd) {
            const timeUsed = slotAvailableEnd - slotAvailableStart;
            const wasPartial = planInfo.remainingTime < planInfo.originalEstimatedTime;
            
            plansInSlot.push({
              plan: planInfo.plan,
              start: minutesToTime(slotAvailableStart),
              end: minutesToTime(slotAvailableEnd),
              isPartial: planInfo.remainingTime > timeUsed,
              isContinued: wasPartial, // 이전 블록에서 이어지는지
              originalEstimatedTime: planInfo.originalEstimatedTime,
            });
            planInfo.remainingTime -= timeUsed;
          }
        }
      }
    }

    // 시작 시간이 없는 플랜들 배치 (같은 날 모든 플랜 우선 배치)
    let currentTime = slotStart;
    for (const planInfo of sortedPlans) {
      if (planInfo.remainingTime <= 0) continue;
      if (planInfo.originalStartTime !== null) continue; // 이미 배치된 플랜은 스킵

      const timeToUse = Math.min(planInfo.remainingTime, slotEnd - currentTime);
      if (timeToUse > 0) {
        const wasPartial = planInfo.remainingTime < planInfo.originalEstimatedTime;
        const willBePartial = planInfo.remainingTime > timeToUse;
        
        plansInSlot.push({
          plan: planInfo.plan,
          start: minutesToTime(currentTime),
          end: minutesToTime(currentTime + timeToUse),
          isPartial: willBePartial,
          isContinued: wasPartial, // 이전 블록에서 이어지는지
          originalEstimatedTime: planInfo.originalEstimatedTime,
        });
        planInfo.remainingTime -= timeToUse;
        currentTime += timeToUse;

        if (currentTime >= slotEnd) break;
      }
    }

    // 시간 순으로 정렬
    plansInSlot.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

    if (plansInSlot.length > 0) {
      slotPlansMap.set(slotIdx, plansInSlot);
    }
  });

  // 각 학습시간 슬롯에서 남은 시간 영역 계산
  const remainingTimeSlotsMap = new Map<number, Array<{
    start: string;
    end: string;
    type: "학습시간" | "자율학습";
  }>>();

  studyTimeSlots.forEach((slot, slotIdx) => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    const plansInSlot = slotPlansMap.get(slotIdx) || [];

    // 플랜이 배치된 시간 구간들
    const usedRanges: Array<{ start: number; end: number }> = [];
    plansInSlot.forEach((plan) => {
      usedRanges.push({
        start: timeToMinutes(plan.start),
        end: timeToMinutes(plan.end),
      });
    });

    // 시간 순으로 정렬
    usedRanges.sort((a, b) => a.start - b.start);

    // 남은 시간 구간 계산
    const remainingRanges: Array<{ start: string; end: string }> = [];
    let currentTime = slotStart;

    usedRanges.forEach((range) => {
      if (currentTime < range.start) {
        // 플랜 배치 전 남은 시간
        remainingRanges.push({
          start: minutesToTime(currentTime),
          end: minutesToTime(range.start),
        });
      }
      currentTime = Math.max(currentTime, range.end);
    });

    // 마지막 플랜 이후 남은 시간
    if (currentTime < slotEnd) {
      remainingRanges.push({
        start: minutesToTime(currentTime),
        end: minutesToTime(slotEnd),
      });
    }

    if (remainingRanges.length > 0) {
      remainingTimeSlotsMap.set(slotIdx, remainingRanges.map(range => ({
        ...range,
        type: slot.type as "학습시간" | "자율학습",
      })));
    }
  });

  // 이동시간/학원일정 슬롯에 커스텀 플랜 배치
  const travelAndAcademyPlansMap = new Map<number, Array<{
    plan: Plan;
    start: string;
    end: string;
    isPartial: boolean;
    isContinued: boolean;
    originalEstimatedTime: number;
  }>>();

  // 커스텀 플랜만 별도로 처리 (이동시간/학원일정 슬롯에 배치)
  const customPlansWithInfo = plansWithInfo.filter(
    (p) => p.plan.content_type === "custom"
  );

  travelAndAcademySlots.forEach((slot, slotIdx) => {
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    const plansInSlot: Array<{
      plan: Plan;
      start: string;
      end: string;
      isPartial: boolean;
      isContinued: boolean;
      originalEstimatedTime: number;
    }> = [];

    // 커스텀 플랜 중에서 이 슬롯과 시간이 일치하는 플랜 찾기
    for (const planInfo of customPlansWithInfo) {
      // 시작 시간이 있는 경우: 슬롯과 시간이 겹치는지 확인
      if (planInfo.originalStartTime !== null) {
        const planStart = planInfo.originalStartTime;
        const planEnd = planStart + planInfo.originalEstimatedTime;

        // 플랜이 이 슬롯과 겹치는지 확인
        if (planStart < slotEnd && planEnd > slotStart) {
          const slotAvailableStart = Math.max(planStart, slotStart);
          const slotAvailableEnd = Math.min(planEnd, slotEnd);

          if (slotAvailableStart < slotAvailableEnd) {
            plansInSlot.push({
              plan: planInfo.plan,
              start: minutesToTime(slotAvailableStart),
              end: minutesToTime(slotAvailableEnd),
              isPartial: false,
              isContinued: false,
              originalEstimatedTime: planInfo.originalEstimatedTime,
            });
          }
        }
      } else {
        // 시작 시간이 없는 경우: 슬롯 시간에 맞춰 배치
        // (이동시간/학원일정은 일반적으로 시간이 고정되어 있으므로)
        const timeToUse = Math.min(planInfo.estimatedTime, slotEnd - slotStart);
        if (timeToUse > 0) {
          plansInSlot.push({
            plan: planInfo.plan,
            start: slot.start,
            end: minutesToTime(slotStart + timeToUse),
            isPartial: planInfo.estimatedTime > timeToUse,
            isContinued: false,
            originalEstimatedTime: planInfo.originalEstimatedTime,
          });
        }
      }
    }

    if (plansInSlot.length > 0) {
      travelAndAcademyPlansMap.set(slotIdx, plansInSlot);
    }
  });

  // 모든 이동시간/학원일정 슬롯에서 배치된 플랜 ID 수집
  const placedPlanIds = new Set<string>();
  travelAndAcademyPlansMap.forEach((plans) => {
    plans.forEach((p) => {
      placedPlanIds.add(p.plan.id);
    });
  });

  // 학습시간 및 자율학습 블록 인덱스 매핑 (timeSlots 전체 인덱스 -> 학습시간/자율학습 블록 인덱스)
  const studySlotIndexMap = new Map<number, number>();
  let studySlotIdx = 0;
  timeSlots.forEach((slot, idx) => {
    if (slot.type === "학습시간" || slot.type === "자율학습") {
      studySlotIndexMap.set(idx, studySlotIdx);
      studySlotIdx++;
    }
  });

  // 이동시간/학원일정 슬롯 인덱스 매핑 (timeSlots 전체 인덱스 -> 이동시간/학원일정 블록 인덱스)
  const travelAndAcademySlotIndexMap = new Map<number, number>();
  let travelAndAcademySlotIdx = 0;
  timeSlots.forEach((slot, idx) => {
    if (slot.type === "이동시간" || slot.type === "학원일정") {
      travelAndAcademySlotIndexMap.set(idx, travelAndAcademySlotIdx);
      travelAndAcademySlotIdx++;
    }
  });

  return (
    <>
      {timeSlots.map((slot, idx) => {
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

        // 학습시간 블록인 경우 해당 인덱스로 플랜 찾기
        const studySlotIdx = studySlotIndexMap.get(idx);
        const plansInStudySlot = slot.type === "학습시간" && studySlotIdx !== undefined 
          ? slotPlansMap.get(studySlotIdx) || [] 
          : [];

        // 이동시간/학원일정 슬롯인 경우 커스텀 플랜 찾기
        const travelAndAcademySlotIdx = travelAndAcademySlotIndexMap.get(idx);
        const plansInTravelAndAcademySlot = 
          (slot.type === "이동시간" || slot.type === "학원일정") && travelAndAcademySlotIdx !== undefined
            ? travelAndAcademyPlansMap.get(travelAndAcademySlotIdx) || []
            : [];

        // 학습시간 슬롯에는 커스텀이 아닌 플랜만 표시
        const nonCustomPlans = datePlans.filter(p => p.content_type !== "custom");
        // 이동시간/학원일정 슬롯에는 커스텀 플랜만 표시
        const customPlans = datePlans.filter(p => p.content_type === "custom");
        // 배치되지 않은 커스텀 플랜만 필터링
        const unplacedCustomPlans = customPlans.filter(
          (p) => !placedPlanIds.has(p.id)
        );

        return (
          <div key={idx} className="space-y-1.5">
            <div className={`rounded border px-3 py-2 text-xs ${getSlotColor()}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{idx + 1}.</span>
                  <span className="font-medium">{slot.label || slot.type}</span>
                </div>
                <span className="text-gray-600">
                  {slot.start} ~ {slot.end}
                </span>
              </div>
            </div>
            {/* 학습시간 슬롯 */}
            {(slot.type === "학습시간" || slot.type === "자율학습") && (
              <>
                {plansInStudySlot.length > 0 && (
                  <div className="ml-4 overflow-x-auto">
                    <PlanTable
                      plans={plansInStudySlot}
                      contents={contents}
                      dayType={dayType}
                      sequenceMap={sequenceMap}
                    />
                  </div>
                )}
                {/* 남은 학습 시간 영역 표시 (플랜이 일부만 배치된 경우만) */}
                {(() => {
                  // 플랜이 하나도 없으면 남은 시간 영역을 표시하지 않음 (중복 방지)
                  if (plansInStudySlot.length === 0) {
                    return null;
                  }
                  
                  const studySlotIdx = studySlotIndexMap.get(idx);
                  const remainingRanges = studySlotIdx !== undefined 
                    ? remainingTimeSlotsMap.get(studySlotIdx) || []
                    : [];
                  
                  // 플랜이 일부만 배치되어 남은 영역이 있을 때만 표시
                  return remainingRanges.length > 0 ? (
                    <div className="ml-4 space-y-1.5">
                      {remainingRanges.map((range, rangeIdx) => (
                        <div
                          key={rangeIdx}
                          className={`rounded border px-3 py-2 text-xs ${
                            range.type === "학습시간"
                              ? "border-blue-200 bg-blue-50"
                              : "border-green-200 bg-green-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${
                              range.type === "학습시간"
                                ? "text-blue-800"
                                : "text-green-800"
                            }`}>
                              {range.type === "학습시간" ? "학습 시간" : "자율 학습 시간"}
                            </span>
                            <span className={`${
                              range.type === "학습시간"
                                ? "text-blue-600"
                                : "text-green-600"
                            }`}>
                              {range.start} ~ {range.end}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}
              </>
            )}
            {/* 이동시간/학원일정 슬롯 */}
            {(slot.type === "이동시간" || slot.type === "학원일정") && (
              <>
                {plansInTravelAndAcademySlot.length > 0 ? (
                  <div className="ml-4 overflow-x-auto">
                    <PlanTable
                      plans={plansInTravelAndAcademySlot}
                      contents={contents}
                      dayType={dayType}
                      sequenceMap={sequenceMap}
                    />
                  </div>
                ) : unplacedCustomPlans.length > 0 ? (
                  <div className="ml-4 text-xs text-gray-500 italic">
                    (커스텀 플랜 {unplacedCustomPlans.length}개 - 시간 정보 없음)
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

// 플랜 표 컴포넌트
function PlanTable({
  plans,
  contents,
  dayType,
  sequenceMap,
}: {
  plans: Array<{
    plan: Plan;
    start: string;
    end: string;
    isPartial?: boolean;
    isContinued?: boolean;
    originalEstimatedTime?: number;
  }>;
  contents: Map<string, ContentData>;
  dayType: string;
  sequenceMap: Map<string, number>;
}) {
  const formatTime = (minutes: number): string => {
    if (minutes === 0) return "0분";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}시간 ${mins}분`;
    } else if (hours > 0) {
      return `${hours}시간`;
    } else {
      return `${mins}분`;
    }
  };

  const formatLearningAmount = (plan: Plan): string => {
    if (
      plan.planned_start_page_or_time === null ||
      plan.planned_end_page_or_time === null
    ) {
      return "-";
    }

    if (plan.content_type === "book") {
      return `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}p`;
    } else if (plan.content_type === "lecture") {
      return `${plan.planned_start_page_or_time}강`;
    }

    return `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
  };

  return (
    <table className="w-full text-xs border-collapse border border-blue-200">
      <thead className="bg-blue-100">
        <tr>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            시간
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            교과
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            과목
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            유형
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            이름
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            학습내역
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            회차
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            학습 분량
          </th>
          <th className="px-3 py-2 text-left border border-blue-200 font-semibold text-blue-900">
            소요시간
          </th>
        </tr>
      </thead>
      <tbody>
        {plans.map((planTime, planIdx) => {
          const content = contents.get(planTime.plan.content_id);
          const duration = timeToMinutes(planTime.end) - timeToMinutes(planTime.start);
          const isReviewDay = dayType === "복습일";
          const showOriginalTime = isReviewDay && planTime.originalEstimatedTime && planTime.originalEstimatedTime > duration;
          const sequence = sequenceMap.get(planTime.plan.id) || 1;

          return (
            <tr
              key={`${planTime.plan.id}-${planIdx}`}
              className={`hover:bg-blue-50 ${
                planTime.isContinued ? "bg-blue-100" : ""
              }`}
            >
              <td className="px-3 py-2 border border-blue-200 text-blue-900">
                <div className="flex items-center gap-1">
                  {planTime.isContinued && (
                    <span className="text-blue-600 font-semibold text-[10px]">[이어서]</span>
                  )}
                  <span className="font-medium">
                    {planTime.start} ~ {planTime.end}
                  </span>
                  <span className="text-blue-700">
                    ({formatTime(duration)})
                  </span>
                  {planTime.isPartial && (
                    <span className="text-blue-600 text-[10px]">(일부)</span>
                  )}
                  {showOriginalTime && (
                    <span className="text-orange-600 font-semibold text-[10px]">
                      [예상: {formatTime(planTime.originalEstimatedTime!)}]
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                {content?.subject_category || "-"}
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                {content?.subject || "-"}
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                {planTime.plan.content_type === "book" ? "교재" : "강의"}
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                <div className="max-w-[200px] truncate" title={content?.title || ""}>
                  {content?.title || "-"}
                </div>
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                <div className="max-w-[200px] truncate" title={planTime.plan.chapter || ""}>
                  {planTime.plan.chapter || "-"}
                </div>
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700 text-center">
                {sequence}
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                {formatLearningAmount(planTime.plan)}
              </td>
              <td className="px-3 py-2 border border-blue-200 text-blue-700">
                {formatTime(duration)}
                {showOriginalTime && (
                  <div className="text-orange-600 text-[10px] mt-0.5">
                    (예상: {formatTime(planTime.originalEstimatedTime!)})
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// 유틸리티 함수들
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function getPlanStartTime(plan: Plan, date: string, blocks: BlockData[]): string | null {
  if (plan.block_index !== null && plan.block_index !== undefined) {
    const planDate = new Date(date + "T00:00:00");
    const dayOfWeek = planDate.getDay();

    // 정확히 일치하는 블록 찾기
    let block = blocks.find(
      (b) => b.day_of_week === dayOfWeek && b.block_index === plan.block_index
    );

    // 정확히 일치하는 블록이 없으면 같은 요일의 블록 중에서 찾기
    if (!block) {
      const dayBlocks = blocks.filter((b) => b.day_of_week === dayOfWeek);
      if (dayBlocks.length > 0) {
        const sortedBlocks = [...dayBlocks].sort((a, b) => a.block_index - b.block_index);
        // block_index가 범위 내에 있으면 해당 블록 사용
        if (plan.block_index > 0 && plan.block_index <= sortedBlocks.length) {
          block = sortedBlocks[plan.block_index - 1];
        } else if (sortedBlocks.length > 0) {
          // 범위를 벗어나면 첫 번째 블록 사용
          block = sortedBlocks[0];
        }
      }
    }

    if (block) {
      return block.start_time;
    }
  }

  return null;
}

// 주차별 그룹화 컴포넌트
function ScheduleListByWeek({
  schedules,
  plansByDate,
  contents,
  blocks,
  sequenceMap,
  expandedDates,
  onToggleDate,
}: {
  schedules: DailySchedule[];
  plansByDate: Map<string, Plan[]>;
  contents: Map<string, ContentData>;
  blocks: BlockData[];
  sequenceMap: Map<string, number>;
  expandedDates: Set<string>;
  onToggleDate: (date: string) => void;
}) {
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
        <WeekSection
          key={weekNum ?? "no-week"}
          weekNum={weekNum}
          schedules={weekSchedules}
          plansByDate={plansByDate}
          contents={contents}
          blocks={blocks}
          sequenceMap={sequenceMap}
          expandedDates={expandedDates}
          onToggleDate={onToggleDate}
        />
      ))}
    </div>
  );
}

// 주차 섹션 컴포넌트
function WeekSection({
  weekNum,
  schedules,
  plansByDate,
  contents,
  blocks,
  sequenceMap,
  expandedDates,
  onToggleDate,
}: {
  weekNum: number | undefined;
  schedules: DailySchedule[];
  plansByDate: Map<string, Plan[]>;
  contents: Map<string, ContentData>;
  blocks: BlockData[];
  sequenceMap: Map<string, number>;
  expandedDates: Set<string>;
  onToggleDate: (date: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

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
              isExpanded={expandedDates.has(schedule.date)}
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
  const weekReviewDays = schedules.filter((s) => s.day_type === "복습일").length;
  const weekExclusionDays = schedules.filter((s) => 
    s.day_type === "휴가" || s.day_type === "개인일정" || s.day_type === "지정휴일"
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
              <div className="mt-1 flex flex-col gap-1">
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span>
                    학습일 {weekStudyDays}일
                    {weekReviewDays > 0 && <> + 복습일 {weekReviewDays}일</>}
                  </span>
                  <span>학습시간 {formatNumber(weekTotalHours)}시간</span>
                  {weekSelfStudyHours > 0 && (
                    <span>자율학습시간 {formatNumber(weekSelfStudyHours)}시간</span>
                  )}
                  <span>총시간 {formatNumber(weekTotalHours + weekSelfStudyHours)}시간</span>
                </div>
                {weekStudyDays + weekReviewDays > 0 && (
                  <div className="text-xs text-gray-400">
                    평균: {formatNumber((weekTotalHours + weekSelfStudyHours) / (weekStudyDays + weekReviewDays))}시간/일
                    ({formatNumber(weekTotalHours + weekSelfStudyHours)}시간 ÷ {weekStudyDays + weekReviewDays}일)
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
                isExpanded={expandedDates.has(schedule.date)}
                onToggle={() => onToggleDate(schedule.date)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function calculateEstimatedTime(plan: Plan, contents: Map<string, ContentData>, dayType?: string): number {
  const content = contents.get(plan.content_id);

  if (
    plan.planned_start_page_or_time === null ||
    plan.planned_end_page_or_time === null
  ) {
    const baseTime = 60; // 기본값 1시간
    // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  const amount = plan.planned_end_page_or_time - plan.planned_start_page_or_time;
  if (amount <= 0) {
    const baseTime = 60;
    return dayType === "복습일" ? Math.round(baseTime * 0.5) : baseTime;
  }

  let baseTime = 0;

  if (plan.content_type === "book") {
    // 책: 1시간당 10페이지 가정
    const pagesPerHour = 10;
    const minutesPerPage = 60 / pagesPerHour;
    baseTime = Math.round(amount * minutesPerPage);
  } else if (plan.content_type === "lecture") {
    // 강의: duration 정보 사용
    if (content?.duration && content.duration > 0) {
      // 총 duration을 사용 (실제로는 episode별 duration이 필요할 수 있음)
      // 강의의 경우 planned_start_page_or_time과 planned_end_page_or_time이 회차를 나타냄
      // 예: 1강, 2강 -> duration을 회차 수로 나눠서 계산
      const episodeCount = amount; // 회차 수
      const totalDuration = content.duration;
      // 회차당 평균 시간 계산 (더 정확한 계산이 필요할 수 있음)
      baseTime = Math.round(totalDuration / Math.max(episodeCount, 1));
    } else {
      baseTime = 60; // 기본값
    }
  } else {
    baseTime = 60; // 기본값
  }

  // 복습일이면 소요시간 단축 (학습일 대비 50%로 단축)
  if (dayType === "복습일") {
    return Math.round(baseTime * 0.5);
  }

  return baseTime;
}

