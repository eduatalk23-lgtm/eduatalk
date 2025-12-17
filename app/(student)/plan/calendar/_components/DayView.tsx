"use client";

import React, { useMemo, memo } from "react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import { CONTENT_TYPE_EMOJIS } from "../_constants/contentIcons";
import { formatDateString, formatDateFull } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import { getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes, type TimeSlotType } from "../_utils/timelineUtils";
import { StatCard } from "./StatCard";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { TimelineItem } from "./TimelineItem";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { cn } from "@/lib/cn";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import {
  textPrimary,
  textSecondary,
  textTertiary,
  textMuted,
  bgSurface,
  borderDefault,
  bgStyles,
} from "@/lib/utils/darkMode";

type PlanConnection = {
  planIds: string[];
  groupKey: string;
};

type DayViewProps = {
  plans: PlanWithContent[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
};

function DayViewComponent({ plans, currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false }: DayViewProps) {
  const dateStr = formatDateString(currentDate);
  const dayTypeInfo = dayTypes.get(dateStr);
  const dayType = dayTypeInfo?.type || "normal";
  
  // 해당 날짜의 daily_schedule 가져오기
  const dailySchedule = dailyScheduleMap.get(dateStr);
  
  // 해당 날짜의 플랜만 필터링 (메모이제이션)
  const dayPlans = useMemo(
    () => plans.filter((plan) => plan.plan_date === dateStr),
    [plans, dateStr]
  );

  // 같은 플랜의 동일 회차를 그룹화 (plan_number 또는 content_id + sequence 기준)
  const planConnections = useMemo(() => {
    const connectionMap = new Map<string, PlanConnection>();
    
    plans.forEach((plan) => {
      // 그룹 키 생성: plan_number가 있으면 사용, 없으면 content_id + sequence 조합
      const groupKey = plan.plan_number !== null && plan.plan_number !== undefined
        ? `plan_number_${plan.plan_number}`
        : plan.sequence !== null && plan.sequence !== undefined
        ? `content_${plan.content_id}_seq_${plan.sequence}`
        : null;
      
      if (!groupKey) return;
      
      if (!connectionMap.has(groupKey)) {
        connectionMap.set(groupKey, {
          planIds: [],
          groupKey,
        });
      }
      
      connectionMap.get(groupKey)!.planIds.push(plan.id);
    });
    
    // 2개 이상의 플랜이 있는 그룹만 반환
    return Array.from(connectionMap.values()).filter(
      (conn) => conn.planIds.length >= 2
    );
  }, [plans]);

  // 연결된 플랜 ID Set 생성 (빠른 조회를 위해)
  const connectedPlanIds = useMemo(() => {
    const ids = new Set<string>();
    planConnections.forEach((conn) => {
      conn.planIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [planConnections]);

  // 해당 날짜의 학원일정 (요일 기반)
  const dayAcademySchedules = useMemo(() => {
    const dayOfWeek = currentDate.getDay();
    return academySchedules.filter((schedule) => schedule.day_of_week === dayOfWeek);
  }, [academySchedules, currentDate]);

  // 해당 날짜의 휴일
  const dayExclusions = useMemo(
    () => exclusions.filter((exclusion) => exclusion.exclusion_date === dateStr),
    [exclusions, dateStr]
  );

  // 타임라인 슬롯 생성 및 정렬/필터링 (공통 유틸리티 사용)
  const { sortedSlots: timelineSlots } = useMemo(() => {
    return getTimelineSlots(
      dateStr,
      dailySchedule,
      dayPlans,
      dayAcademySchedules,
      dayExclusions,
      false // DayView에서는 항상 전체 표시
    );
  }, [dateStr, dailySchedule, dayPlans, dayAcademySchedules, dayExclusions]);

  // TIME_BLOCKS와 plansByBlock 생성 (타임라인 슬롯 기반)
  // 모든 타임슬롯을 시간 순서대로 포함 (학습시간, 점심시간, 학원일정 등)
  // showOnlyStudyTime이 true면 학습시간만 필터링
  // 시간 순서대로 정렬 (타입 무관)
  const { TIME_BLOCKS, plansByBlock, slotTypes, academyByBlock } = useMemo(() => {
    // 시간 순서대로 정렬 (start 시간 기준)
    const sortedSlots = [...timelineSlots].sort((a, b) => {
      const aStart = timeToMinutes(a.start);
      const bStart = timeToMinutes(b.start);
      return aStart - bStart;
    });
    
    const filteredSlots = showOnlyStudyTime
      ? sortedSlots.filter((slot) => slot.type === "학습시간")
      : sortedSlots;
    
    const blocks = filteredSlots.map((slot, index) => ({
      index,
      label: slot.label || `${slot.start} ~ ${slot.end}`,
      time: `${slot.start} ~ ${slot.end}`,
      startTime: slot.start,
      endTime: slot.end,
    }));

    const plansMap = new Map<number, PlanWithContent[]>();
    const typesMap = new Map<number, TimeSlotType>();
    const academyMap = new Map<number, AcademySchedule>();
    
    filteredSlots.forEach((slot, index) => {
      typesMap.set(index, slot.type);
      if (slot.type === "학습시간" && slot.plans && slot.plans.length > 0) {
        plansMap.set(index, slot.plans);
      }
      if (slot.type === "학원일정" && slot.academy) {
        academyMap.set(index, slot.academy);
      }
    });

    return {
      TIME_BLOCKS: blocks,
      plansByBlock: plansMap,
      slotTypes: typesMap,
      academyByBlock: academyMap,
    };
  }, [timelineSlots, showOnlyStudyTime]);

  // 날짜 타입별 스타일링 (공통 유틸리티 사용)
  const {
    bgColorClass,
    textColorClass,
    subtitleColorClass,
    dayTypeBadgeClass,
  } = getDayTypeStyling(currentDate, dayTypeInfo, dayExclusions);

  // 플랜 통계 계산
  const totalPlans = dayPlans.length;
  const completedPlans = dayPlans.filter((p) => p.progress != null && p.progress >= 100).length;
  const activePlans = dayPlans.filter((p) => p.actual_start_time && !p.actual_end_time).length;
  const averageProgress = totalPlans > 0
    ? Math.round(
        dayPlans.reduce((sum, p) => sum + (p.progress || 0), 0) / totalPlans
      )
    : 0;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      {/* 날짜 헤더 및 요약 정보 - 개선된 패딩 */}
      <div className={cn("rounded-xl border-2 p-6 md:p-8 shadow-[var(--elevation-8)]", bgColorClass)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className={`text-3xl font-bold ${textColorClass}`}>
              {formatDateFull(currentDate)}
            </h2>
            {/* 날짜 타입 배지 */}
            {dayTypeInfo && dayType !== "normal" && (
              <div className="flex items-center gap-2 flex-wrap">
                <span 
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-bold border-2 shadow-[var(--elevation-1)]",
                    dayTypeBadgeClass,
                    // "기타" 제외일은 더 강조 (지정휴일과 구분)
                    dayExclusions.length > 0 && dayExclusions[0].exclusion_type === "기타" && 
                    "ring-2 ring-red-500 ring-offset-2",
                    // 다른 제외일은 기존 스타일 유지
                    (dayType === "지정휴일" || dayType === "휴가" || dayType === "개인일정") && 
                    dayExclusions.length > 0 && dayExclusions[0].exclusion_type !== "기타" &&
                    "ring-2 ring-offset-2"
                  )}
                  title={
                    dayTypeInfo.exclusion 
                      ? `${dayTypeInfo.label}${dayTypeInfo.exclusion.exclusion_type ? ` - ${dayTypeInfo.exclusion.exclusion_type}` : ""}${dayTypeInfo.exclusion.reason ? `: ${dayTypeInfo.exclusion.reason}` : ""}`
                      : dayTypeInfo.label
                  }
                >
                  {dayTypeInfo.icon} {dayTypeInfo.label}
                </span>
                {dayExclusions.length > 0 && dayExclusions[0].exclusion_type && (
                  <span className={cn("text-sm font-medium", textTertiary)}>
                    ({dayExclusions[0].exclusion_type})
                  </span>
                )}
                {dayExclusions.length > 0 && dayExclusions[0].reason && (
                  <span className={cn("text-sm font-medium", textTertiary)}>- {dayExclusions[0].reason}</span>
                )}
              </div>
            )}
          </div>

          {/* 통계 대시보드 */}
          {(totalPlans > 0 || dayAcademySchedules.length > 0) && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {totalPlans > 0 && (
                <>
                  <StatCard label="총 플랜" value={totalPlans} color="gray" />
                  <StatCard label="완료" value={completedPlans} color="green" />
                  {activePlans > 0 && (
                    <StatCard label="진행중" value={activePlans} color="blue" />
                  )}
                  {averageProgress > 0 && (
                    <StatCard label="평균 진행률" value={`${averageProgress}%`} color="indigo" />
                  )}
                </>
              )}
              {dayAcademySchedules.length > 0 && (
                <StatCard label="학원 일정" value={dayAcademySchedules.length} color="purple" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 타임라인 뷰 (시간 순서대로) - 개선된 패딩 */}
      <div className={cn("rounded-xl border-2 shadow-[var(--elevation-4)]", borderDefault, bgSurface)}>
        <div className={cn("border-b-2 px-6 md:px-8 py-4 md:py-5 bg-gradient-to-r", borderDefault, bgStyles.gray, "to-white dark:to-gray-800")}>
          <h3 className={cn("text-xl md:text-2xl font-bold", textPrimary)}>학습 플랜 타임라인</h3>
        </div>
        <div className="p-6 md:p-8">
          {TIME_BLOCKS.length === 0 ? (
            <div className={cn("flex flex-col gap-2 py-12 text-center", textMuted)}>
              <div className="text-4xl">📅</div>
              <div className="text-lg font-medium">이 날짜에는 플랜이 없습니다</div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {TIME_BLOCKS.map((block, index) => {
                const slotType = slotTypes.get(block.index);
                const blockPlans = (plansByBlock.get(block.index) || [])
                  .sort((a, b) => a.block_index - b.block_index);
                const blockAcademy = academyByBlock.get(block.index);

                // 타임라인 슬롯 생성
                const slot = {
                  start: block.startTime,
                  end: block.endTime,
                  type: slotType || "학습시간",
                  label: block.label,
                  plans: slotType === "학습시간" ? blockPlans : undefined,
                  academy: slotType === "학원일정" ? blockAcademy : undefined,
                };

                return (
                  <TimelineItem
                    key={block.index}
                    slot={slot}
                    isLast={index === TIME_BLOCKS.length - 1}
                    connectedPlanIds={connectedPlanIds}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 기존 테이블 뷰 (숨김 처리 - 필요시 주석 해제) */}
      {false && (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h3 className="text-lg font-semibold text-gray-900">학습 플랜</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">시간대</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">콘텐츠</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">교과/과목</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">범위/시간</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">상태</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">진행률/시간</th>
              </tr>
            </thead>
            <tbody>
              {TIME_BLOCKS.map((block) => {
                const slotType = slotTypes.get(block.index);
                const blockPlans = (plansByBlock.get(block.index) || [])
                  .sort((a, b) => a.block_index - b.block_index);
                const blockAcademy = academyByBlock.get(block.index);

                // 학원일정 처리
                if (slotType === "학원일정" && blockAcademy) {
                  const colorClass = getTimeSlotColorClass(slotType);
                  const icon = getTimeSlotIcon(slotType);
                  
                  return (
                    <tr key={block.index} className={`border-b border-gray-100 ${colorClass}`}>
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{block.label}</span>
                          <span className="text-xs opacity-75">{block.time}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <span>{icon}</span>
                          <span>{blockAcademy.academy_name || "학원"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {blockAcademy.subject || "-"}
                      </td>
                      <td colSpan={3} className="px-4 py-3 text-center text-sm text-gray-400">
                        학원일정
                      </td>
                    </tr>
                  );
                }

                // 점심시간, 이동시간, 자율학습 등 특수 타임슬롯 처리
                if (slotType && slotType !== "학습시간" && slotType !== "학원일정") {
                  const colorClass = getTimeSlotColorClass(slotType);
                  const icon = getTimeSlotIcon(slotType);
                  
                  return (
                    <tr key={block.index} className={`border-b border-gray-100 ${colorClass}`}>
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span>{block.label}</span>
                          <span className="text-xs opacity-75">{block.time}</span>
                        </div>
                      </td>
                      <td colSpan={5} className="px-4 py-3 text-center text-sm font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <span>{icon}</span>
                          <span>{slotType}</span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // 학습시간 처리
                return (
                  <React.Fragment key={block.index}>
                    {/* 플랜 행들 */}
                    {blockPlans.length > 0 ? (
                      blockPlans.map((plan, planIndex) => {
                        const contentTypeIcon = CONTENT_TYPE_EMOJIS[plan.content_type];
                        const isCompleted = plan.progress != null && plan.progress >= 100;
                        const isActive = plan.actual_start_time && !plan.actual_end_time;
                        const progressPercentage = plan.progress != null ? Math.round(plan.progress) : null;

                        return (
                          <tr
                            key={plan.id}
                            className={`border-b border-gray-100 hover:bg-gray-50 ${
                              isCompleted
                                ? "bg-green-50/50"
                                : isActive
                                ? "bg-blue-50/50"
                                : ""
                            }`}
                          >
                            {/* 시간대 (첫 번째 플랜만 표시) */}
                            {planIndex === 0 && (
                              <td
                                className="px-4 py-3 align-top text-sm font-medium text-gray-700"
                                rowSpan={blockPlans.length}
                              >
                                <div className="flex flex-col gap-0.5">
                                  <span>{block.label}</span>
                                  <span className="text-xs text-gray-500">{block.time}</span>
                                </div>
                              </td>
                            )}
                            {/* 콘텐츠 */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{contentTypeIcon}</span>
                                <div className="flex flex-col gap-0.5">
                                  <span className={cn("font-medium", textPrimary)}>
                                    {plan.contentTitle}
                                  </span>
                                  {plan.contentCategory && (
                                    <span className={cn("text-xs", textMuted)}>
                                      {plan.contentCategory}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* 교과/과목 */}
                            <td className={cn("px-4 py-3 align-top text-sm", textSecondary)}>
                              <div className="flex flex-col gap-1">
                                {plan.contentSubjectCategory && (
                                  <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-medium", bgStyles.gray, textSecondary)}>
                                    {plan.contentSubjectCategory}
                                  </span>
                                )}
                                {plan.contentSubject && (
                                  <span className={cn("text-xs", textTertiary)}>
                                    {plan.contentSubject}
                                  </span>
                                )}
                                {!plan.contentSubjectCategory && !plan.contentSubject && (
                                  <span className={cn("text-xs", textMuted)}>-</span>
                                )}
                              </div>
                            </td>
                            {/* 범위 */}
                            <td className={cn("px-4 py-3 align-top text-sm", textSecondary)}>
                              <div className="flex flex-col gap-1">
                                {plan.planned_start_page_or_time !== null &&
                                plan.planned_end_page_or_time !== null ? (
                                  <>
                                    {plan.content_type === "book" ? (
                                      <span>📖 {plan.planned_start_page_or_time}-{plan.planned_end_page_or_time}페이지</span>
                                    ) : (
                                      <span>🎧 {plan.planned_start_page_or_time}강</span>
                                    )}
                                    {plan.chapter && (
                                      <span className={cn("text-xs", textMuted)}>
                                        챕터: {plan.chapter}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className={cn("text-xs", textMuted)}>-</span>
                                )}
                                {/* 시간 정보 */}
                                {plan.start_time && plan.end_time && (
                                  <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                    <span>⏰</span>
                                    <span>{plan.start_time} ~ {plan.end_time}</span>
                                  </div>
                                )}
                                {/* 블록 인덱스 */}
                                <div className={cn("text-xs", textMuted)}>
                                  블록 {plan.block_index}
                                </div>
                              </div>
                            </td>
                            {/* 상태 */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                {isCompleted && (
                                  <span className="inline-block w-fit rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                                    ✅ 완료
                                  </span>
                                )}
                                {isActive && (
                                  <span className="inline-block w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                                    ⏱️ 학습 중
                                  </span>
                                )}
                                {!isCompleted && !isActive && (
                                  <span className={cn("text-xs", textMuted)}>대기</span>
                                )}
                              </div>
                            </td>
                            {/* 진행률 */}
                            <td className="px-4 py-3 align-top">
                              <div className="flex flex-col gap-1">
                                {progressPercentage !== null ? (
                                  <>
                                    <span className={cn("text-sm font-medium", textSecondary)}>
                                      {progressPercentage}%
                                    </span>
                                    <div className="w-20">
                                      <ProgressBar
                                        value={progressPercentage}
                                        variant={isCompleted ? "success" : isActive ? "default" : undefined}
                                        color={isCompleted ? undefined : isActive ? "blue" : undefined}
                                        size="xs"
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <span className={cn("text-xs", textMuted)}>-</span>
                                )}
                                {/* 완료량 */}
                                {plan.completed_amount !== null && plan.planned_end_page_or_time !== null && (
                                  <div className={cn("text-xs", textMuted)}>
                                    완료: {plan.completed_amount} / {plan.planned_end_page_or_time}
                                  </div>
                                )}
                                {/* 실제 시간 정보 */}
                                {plan.actual_start_time && (
                                  <div className={cn("text-xs", textMuted)}>
                                    시작: {new Date(plan.actual_start_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                {plan.actual_end_time && (
                                  <div className={cn("text-xs", textMuted)}>
                                    종료: {new Date(plan.actual_end_time).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                )}
                                {/* 소요 시간 */}
                                {plan.total_duration_seconds != null && (
                                  <div className={cn("text-xs", textMuted)}>
                                    소요: {Math.floor(plan.total_duration_seconds / 60)}분
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      // 플랜이 없는 학습시간대
                      <tr className="border-b border-gray-100">
                        <td className="px-4 py-3 text-sm font-medium text-gray-700">
                          <div className="flex flex-col gap-0.5">
                            <span>{block.label}</span>
                            <span className="text-xs text-gray-500">{block.time}</span>
                          </div>
                        </td>
                        <td colSpan={5} className="px-4 py-3 text-center text-sm text-gray-400">
                          플랜 없음
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* 플랜이 없는 경우 */}
      {dayPlans.length === 0 && dayAcademySchedules.length === 0 && (
        <div className={cn("rounded-lg border-2 border-dashed p-12 text-center", borderDefault, bgStyles.gray)}>
          <div className="flex flex-col gap-4">
            <div className="text-4xl">📅</div>
            <div className="flex flex-col gap-2">
              <div className={cn("text-lg font-semibold", textPrimary)}>
                이 날짜에는 플랜이 없습니다
              </div>
              <div className={cn("text-sm", textTertiary)}>
                다른 날짜를 선택하거나 새로운 플랜을 추가해주세요
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DayView = memo(DayViewComponent, (prevProps, nextProps) => {
  // currentDate 비교 (날짜 문자열로 변환하여 비교)
  const prevDateStr = prevProps.currentDate.toISOString().slice(0, 10);
  const nextDateStr = nextProps.currentDate.toISOString().slice(0, 10);
  
  // plans 배열의 길이 비교
  if (prevProps.plans.length !== nextProps.plans.length) {
    return false;
  }
  
  // 해당 날짜의 플랜만 비교
  const prevDayPlans = prevProps.plans.filter(p => p.plan_date === prevDateStr);
  const nextDayPlans = nextProps.plans.filter(p => p.plan_date === nextDateStr);
  
  if (prevDayPlans.length !== nextDayPlans.length) {
    return false;
  }
  
  return (
    prevDateStr === nextDateStr &&
    prevProps.showOnlyStudyTime === nextProps.showOnlyStudyTime &&
    prevProps.exclusions.length === nextProps.exclusions.length &&
    prevProps.academySchedules.length === nextProps.academySchedules.length &&
    prevProps.dayTypes.size === nextProps.dayTypes.size &&
    prevProps.dailyScheduleMap.size === nextProps.dailyScheduleMap.size
  );
});
