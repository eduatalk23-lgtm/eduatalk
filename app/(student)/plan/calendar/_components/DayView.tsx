"use client";

import React, { useMemo, memo, useState, useCallback } from "react";
import { Clock } from "lucide-react";
import type { PlanWithContent } from "../_types/plan";
import type { PlanExclusion, AcademySchedule } from "@/lib/types/plan";
import type { AdHocPlanForCalendar } from "./PlanCalendarView";
import { getContentTypeIcon } from "../../_shared/utils/contentTypeUtils";
import { formatDateString, formatDateFull } from "@/lib/date/calendarUtils";
import type { DayTypeInfo } from "@/lib/date/calendarDayTypes";
import type { DailyScheduleInfo } from "@/lib/types/plan";
import { getTimeSlotColorClass, getTimeSlotIcon, timeToMinutes, type TimeSlotType } from "../_utils/timelineUtils";
import { StatCard } from "./StatCard";
import { CalendarPlanCard } from "./CalendarPlanCard";
import { TimelineItem } from "./TimelineItem";
import { ContentLinkingModal } from "./ContentLinkingModal";
import { ProgressBar } from "@/components/atoms/ProgressBar";
import { ContainerSection, AdHocPlanListItem } from "@/components/plan";
import { cn } from "@/lib/cn";
import { getDayTypeStyling } from "../_hooks/useDayTypeStyling";
import { getTimelineSlots } from "../_hooks/useTimelineSlots";
import { usePlanConnections } from "../_hooks/usePlanConnections";
import {
  textPrimary,
  textSecondary,
  textTertiary,
  textMuted,
  bgSurface,
  borderDefault,
  bgStyles,
} from "@/lib/utils/darkMode";

type VirtualPlanInfo = {
  planId: string;
  slotIndex: number;
  subjectCategory?: string | null;
  description?: string | null;
  slotType?: "book" | "lecture" | "custom" | null;
};

type DayViewProps = {
  plans: PlanWithContent[];
  adHocPlans?: AdHocPlanForCalendar[];
  currentDate: Date;
  exclusions: PlanExclusion[];
  academySchedules: AcademySchedule[];
  dayTypes: Map<string, DayTypeInfo>;
  dailyScheduleMap: Map<string, DailyScheduleInfo>;
  showOnlyStudyTime?: boolean;
  studentId?: string;
  tenantId?: string;
  onPlansUpdated?: () => void;
};

function DayViewComponent({ plans, adHocPlans = [], currentDate, exclusions, academySchedules, dayTypes, dailyScheduleMap, showOnlyStudyTime = false, studentId, tenantId, onPlansUpdated }: DayViewProps) {
  const dateStr = formatDateString(currentDate);
  const dayTypeInfo = dayTypes.get(dateStr);

  // 콘텐츠 연결 모달 상태
  const [linkingModalOpen, setLinkingModalOpen] = useState(false);
  const [selectedVirtualPlan, setSelectedVirtualPlan] = useState<VirtualPlanInfo | null>(null);

  // 콘텐츠 연결 핸들러
  const handleLinkContent = useCallback((planId: string, slotIndex: number) => {
    // 해당 플랜의 가상 정보 찾기
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    const virtualPlan: VirtualPlanInfo = {
      planId,
      slotIndex,
      subjectCategory: (plan as { virtual_subject_category?: string | null }).virtual_subject_category,
      description: (plan as { virtual_description?: string | null }).virtual_description,
      slotType: (plan as { content_type?: "book" | "lecture" | "custom" | null }).content_type || null,
    };

    setSelectedVirtualPlan(virtualPlan);
    setLinkingModalOpen(true);
  }, [plans]);

  // 모달 닫기 핸들러
  const handleCloseModal = useCallback(() => {
    setLinkingModalOpen(false);
    setSelectedVirtualPlan(null);
  }, []);

  // 콘텐츠 연결 성공 핸들러
  const handleLinkSuccess = useCallback(() => {
    onPlansUpdated?.();
  }, [onPlansUpdated]);
  const dayType = dayTypeInfo?.type || "normal";
  
  // 해당 날짜의 daily_schedule 가져오기
  const dailySchedule = dailyScheduleMap.get(dateStr);
  
  // 해당 날짜의 플랜만 필터링 (메모이제이션)
  const dayPlans = useMemo(
    () => plans.filter((plan) => plan.plan_date === dateStr),
    [plans, dateStr]
  );

  // 해당 날짜의 ad-hoc 플랜 필터링
  const dayAdHocPlans = useMemo(
    () => adHocPlans.filter((plan) => plan.plan_date === dateStr),
    [adHocPlans, dateStr]
  );

  // 플랜 연결 그룹화 (공통 훅 사용)
  const { planConnections, connectedPlanIds } = usePlanConnections(plans);

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
    dayTypeBadgeClass,
  } = getDayTypeStyling(currentDate, dayTypeInfo, dayExclusions);

  // 플랜 통계 계산 (ad-hoc 플랜 포함)
  const totalPlans = dayPlans.length + dayAdHocPlans.length;
  const completedPlans = dayPlans.filter((p) => p.progress != null && p.progress >= 100).length
    + dayAdHocPlans.filter((p) => p.status === "completed" || !!p.completed_at).length;
  const activePlans = dayPlans.filter((p) => p.actual_start_time && !p.actual_end_time).length
    + dayAdHocPlans.filter((p) => p.status === "in_progress" && !!p.started_at).length;
  const averageProgress = dayPlans.length > 0
    ? Math.round(
        dayPlans.reduce((sum, p) => sum + (p.progress || 0), 0) / dayPlans.length
      )
    : 0;

  // 컨테이너별 플랜 그룹화
  const plansByContainer = useMemo(() => {
    type ContainerType = "unfinished" | "daily" | "weekly";
    const containers: Record<ContainerType, { plans: PlanWithContent[]; adHocPlans: AdHocPlanForCalendar[] }> = {
      unfinished: { plans: [], adHocPlans: [] },
      daily: { plans: [], adHocPlans: [] },
      weekly: { plans: [], adHocPlans: [] },
    };

    dayPlans.forEach((plan) => {
      const containerType = (plan as { container_type?: string }).container_type as ContainerType | undefined;
      if (containerType && containers[containerType]) {
        containers[containerType].plans.push(plan);
      } else {
        containers.daily.plans.push(plan); // 기본값은 daily
      }
    });

    dayAdHocPlans.forEach((plan) => {
      const containerType = plan.container_type as ContainerType | undefined;
      if (containerType && containers[containerType]) {
        containers[containerType].adHocPlans.push(plan);
      } else {
        containers.daily.adHocPlans.push(plan);
      }
    });

    return containers;
  }, [dayPlans, dayAdHocPlans]);

  // 가용 시간 계산 (학습시간 슬롯의 총 시간)
  const availableMinutes = useMemo(() => {
    let total = 0;
    timelineSlots.forEach((slot) => {
      if (slot.type === "학습시간") {
        const startMins = timeToMinutes(slot.start);
        const endMins = timeToMinutes(slot.end);
        total += endMins - startMins;
      }
    });
    return total;
  }, [timelineSlots]);

  // 예상 소요시간 계산 (각 플랜의 범위 기반)
  const estimatedMinutes = useMemo(() => {
    let total = 0;
    dayPlans.forEach((plan) => {
      if (plan.planned_start_page_or_time != null && plan.planned_end_page_or_time != null) {
        // 교재는 페이지당 5분, 강의는 분 단위
        const range = plan.planned_end_page_or_time - plan.planned_start_page_or_time + 1;
        total += plan.content_type === "book" ? range * 5 : range;
      }
    });
    dayAdHocPlans.forEach((plan) => {
      if (plan.estimated_minutes) {
        total += plan.estimated_minutes;
      }
    });
    return total;
  }, [dayPlans, dayAdHocPlans]);

  // 시간 초과 여부
  const isTimeExceeded = estimatedMinutes > availableMinutes;

  return (
    <div className="flex w-full flex-col gap-6 md:gap-8">
      {/* 날짜 헤더 및 요약 정보 - 개선된 패딩 */}
      <div className={cn("rounded-xl border-2 p-6 md:p-8 shadow-[var(--elevation-8)]", bgColorClass)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <h2 className={`text-3xl font-bold ${textColorClass}`}>
              {formatDateFull(currentDate)}
            </h2>
            {/* 날짜 타입 배지 - 학습일/복습일과 동일한 구조로 통일 */}
            {dayTypeInfo && dayType !== "normal" && (
              <div className="flex items-center gap-2 flex-wrap">
                {dayTypeInfo.icon && (
                  <dayTypeInfo.icon className="w-4 h-4 shrink-0" />
                )}
                <span className={cn("text-sm font-bold", textColorClass)}>
                  {dayTypeInfo.label}
                </span>
                {/* 제외일 상세 정보는 유지 */}
                {dayExclusions.length > 0 && dayExclusions[0].exclusion_type && (
                  <span className={cn("text-sm font-medium", textTertiary)}>
                    ({dayExclusions[0].exclusion_type})
                  </span>
                )}
                {dayExclusions.length > 0 && dayExclusions[0].reason && (
                  <span className={cn("text-sm font-medium", textTertiary)}>
                    - {dayExclusions[0].reason}
                  </span>
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

          {/* 가용시간 지표 */}
          {availableMinutes > 0 && (
            <div className={cn(
              "mt-4 flex items-center gap-4 rounded-lg border p-3",
              isTimeExceeded
                ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20"
                : "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20"
            )}>
              <Clock className={cn(
                "h-5 w-5 shrink-0",
                isTimeExceeded ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
              )} />
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn("font-medium", textSecondary)}>가용시간</span>
                  <span className={cn("font-bold", textPrimary)}>
                    {Math.floor(availableMinutes / 60)}시간 {availableMinutes % 60}분
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className={cn("font-medium", textSecondary)}>예상 소요</span>
                  <span className={cn(
                    "font-bold",
                    isTimeExceeded ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                  )}>
                    {Math.floor(estimatedMinutes / 60)}시간 {estimatedMinutes % 60}분
                    {isTimeExceeded && " (초과!)"}
                  </span>
                </div>
              </div>
              {/* 진행 바 */}
              <div className="w-24">
                <ProgressBar
                  value={Math.min(100, (estimatedMinutes / availableMinutes) * 100)}
                  variant={isTimeExceeded ? "error" : "success"}
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 컨테이너 기반 플랜 목록 */}
      {totalPlans > 0 && (
        <div className="flex flex-col gap-4">
          {/* 미완료 컨테이너 */}
          <ContainerSection
            type="unfinished"
            count={plansByContainer.unfinished.plans.length + plansByContainer.unfinished.adHocPlans.length}
          >
            {plansByContainer.unfinished.plans.map((plan) => (
              <CalendarPlanCard
                key={plan.id}
                plan={plan}
                isConnected={connectedPlanIds.has(plan.id)}
                onLinkContent={handleLinkContent}
              />
            ))}
            {plansByContainer.unfinished.adHocPlans.map((plan) => (
              <AdHocPlanListItem
                key={plan.id}
                id={plan.id}
                title={plan.title}
                icon={plan.icon || undefined}
                estimatedMinutes={plan.estimated_minutes || undefined}
                status={plan.status || undefined}
                borderClass="border-red-200 dark:border-red-800"
              />
            ))}
          </ContainerSection>

          {/* 오늘 할 일 컨테이너 */}
          <ContainerSection
            type="daily"
            count={plansByContainer.daily.plans.length + plansByContainer.daily.adHocPlans.length}
          >
            {plansByContainer.daily.plans.map((plan) => (
              <CalendarPlanCard
                key={plan.id}
                plan={plan}
                isConnected={connectedPlanIds.has(plan.id)}
                onLinkContent={handleLinkContent}
              />
            ))}
            {plansByContainer.daily.adHocPlans.map((plan) => (
              <AdHocPlanListItem
                key={plan.id}
                id={plan.id}
                title={plan.title}
                icon={plan.icon || undefined}
                estimatedMinutes={plan.estimated_minutes || undefined}
                status={plan.status || undefined}
                borderClass="border-blue-200 dark:border-blue-800"
              />
            ))}
          </ContainerSection>

          {/* 주간 유동 컨테이너 */}
          <ContainerSection
            type="weekly"
            count={plansByContainer.weekly.plans.length + plansByContainer.weekly.adHocPlans.length}
          >
            {plansByContainer.weekly.plans.map((plan) => (
              <CalendarPlanCard
                key={plan.id}
                plan={plan}
                isConnected={connectedPlanIds.has(plan.id)}
                onLinkContent={handleLinkContent}
              />
            ))}
            {plansByContainer.weekly.adHocPlans.map((plan) => (
              <AdHocPlanListItem
                key={plan.id}
                id={plan.id}
                title={plan.title}
                icon={plan.icon || undefined}
                estimatedMinutes={plan.estimated_minutes || undefined}
                status={plan.status || undefined}
                borderClass="border-green-200 dark:border-green-800"
              />
            ))}
          </ContainerSection>
        </div>
      )}

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
                    onLinkContent={handleLinkContent}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 빠른 추가 플랜 섹션 */}
      {dayAdHocPlans.length > 0 && (
        <div className={cn("rounded-xl border-2 shadow-[var(--elevation-4)]", borderDefault, bgSurface)}>
          <div className={cn("border-b-2 px-6 md:px-8 py-4 md:py-5 bg-gradient-to-r", borderDefault, "from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-800")}>
            <h3 className={cn("text-xl md:text-2xl font-bold flex items-center gap-2", textPrimary)}>
              <span className="text-lg">⚡</span>
              빠른 추가 플랜
            </h3>
          </div>
          <div className="p-6 md:p-8">
            <div className="flex flex-col gap-3">
              {dayAdHocPlans.map((plan) => {
                const isCompleted = plan.status === "completed" || !!plan.completed_at;
                const isInProgress = plan.status === "in_progress" && !!plan.started_at;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border p-4",
                      isCompleted
                        ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20"
                        : isInProgress
                        ? "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    )}
                  >
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg",
                      plan.color
                        ? `bg-${plan.color}-100 dark:bg-${plan.color}-900/30`
                        : "bg-amber-100 dark:bg-amber-900/30"
                    )}>
                      {plan.icon || "⚡"}
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <span className={cn(
                        "font-medium",
                        textPrimary,
                        isCompleted && "line-through opacity-70"
                      )}>
                        {plan.title}
                      </span>
                      {plan.estimated_minutes && (
                        <span className={cn("text-sm", textSecondary)}>
                          예상 시간: {plan.estimated_minutes}분
                          {plan.actual_minutes && ` (실제: ${plan.actual_minutes}분)`}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isCompleted && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                          ✓ 완료
                        </span>
                      )}
                      {isInProgress && (
                        <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          ▶ 진행중
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 레거시 테이블 뷰는 DayViewTableLegacy.tsx로 분리됨 */}

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

      {/* 콘텐츠 연결 모달 */}
      {studentId && (
        <ContentLinkingModal
          isOpen={linkingModalOpen}
          onClose={handleCloseModal}
          virtualPlan={selectedVirtualPlan}
          studentId={studentId}
          onSuccess={handleLinkSuccess}
        />
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
    prevProps.dailyScheduleMap.size === nextProps.dailyScheduleMap.size &&
    prevProps.studentId === nextProps.studentId &&
    prevProps.onPlansUpdated === nextProps.onPlansUpdated
  );
});
