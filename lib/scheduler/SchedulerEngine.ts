/**
 * SchedulerEngine - 1730 타임테이블 스케줄링 엔진
 *
 * 1730 타임테이블 로직을 클래스로 캡슐화하여 응집도를 높이고 유지보수성을 향상시킵니다.
 *
 * 주요 기능:
 * - 학습일/복습일 주기 계산
 * - 콘텐츠별 날짜 배정 (전략과목/취약과목 로직 포함)
 * - 학습 범위 분할
 * - 시간 슬롯 배정 (Bin Packing 알고리즘 유사)
 */

import {
  PlanExclusion,
  AcademySchedule,
  StudyReviewCycle,
  SchedulerOptions,
} from "@/lib/types/plan";
import {
  calculateStudyReviewCycle,
  getContentAllocation,
  calculateSubjectAllocationDates,
  divideContentRange,
  type CycleDayInfo,
  type SubjectAllocation,
} from "@/lib/plan/1730TimetableLogic";
import { validateAllocations } from "@/lib/utils/subjectAllocation";
import type {
  BlockInfo,
  ContentInfo,
  ScheduledPlan,
  DateAvailableTimeRanges,
  DateTimeSlots,
  ContentDurationMap,
} from "@/lib/plan/scheduler";
import type { PlanGenerationFailureReason } from "@/lib/errors/planGenerationErrors";
import {
  calculateWeekNumber,
  getDayOfWeekName,
} from "@/lib/errors/planGenerationErrors";
import { timeToMinutes, minutesToTime } from "@/lib/utils/time";
import { calculateContentDuration as calculateContentDurationUnified } from "@/lib/plan/contentDuration";

/**
 * SchedulerEngine 컨텍스트 타입
 */
export type SchedulerContext = {
  periodStart: string;
  periodEnd: string;
  exclusions: PlanExclusion[];
  blocks: BlockInfo[];
  academySchedules: AcademySchedule[];
  contents: ContentInfo[];
  options?: SchedulerOptions;
  riskIndexMap?: Map<string, { riskScore: number }>;
  dateAvailableTimeRanges?: DateAvailableTimeRanges;
  dateTimeSlots?: DateTimeSlots;
  contentDurationMap?: ContentDurationMap;
  contentSubjects?: Map<
    string,
    { subject?: string | null; subject_category?: string | null }
  >;
};


/**
 * 콘텐츠의 특정 범위에 대한 소요시간 계산 (분 단위)
 * 통합 함수를 사용하도록 변경
 */
function calculateContentDuration(
  content: ContentInfo,
  startPageOrTime: number,
  endPageOrTime: number,
  durationMap?: ContentDurationMap
): number {
  const durationInfo = durationMap?.get(content.content_id);
  
  if (!durationInfo) {
    // duration 정보가 없으면 기본값 반환
    const amount = endPageOrTime - startPageOrTime;
    if (content.content_type === "lecture") {
      return amount * 30; // 회차당 30분
    } else {
      return amount * 2; // 페이지당 2분
    }
  }
  
  return calculateContentDurationUnified(
    {
      content_type: content.content_type,
      content_id: content.content_id,
      start_range: startPageOrTime,
      end_range: endPageOrTime,
    },
    durationInfo
  );
}

/**
 * SchedulerEngine 클래스
 *
 * 1730 타임테이블 스케줄링 로직을 캡슐화합니다.
 */
export class SchedulerEngine {
  private context: SchedulerContext;
  private cycleDays: CycleDayInfo[] | null = null;
  private contentAllocationMap: Map<string, string[]> | null = null;
  private contentRangeMap: Map<
    string,
    Map<string, { start: number; end: number }>
  > | null = null;
  private filteredContents: ContentInfo[] | null = null;
  private failureReasons: PlanGenerationFailureReason[] = [];

  constructor(context: SchedulerContext) {
    this.context = context;
  }

  /**
   * 수집된 실패 원인 반환
   */
  public getFailureReasons(): PlanGenerationFailureReason[] {
    return [...this.failureReasons];
  }

  /**
   * 실패 원인 추가
   */
  private addFailureReason(reason: PlanGenerationFailureReason): void {
    this.failureReasons.push(reason);
  }

  /**
   * 주기 계산 (학습일/복습일)
   * 제외일을 고려하여 학습일과 복습일을 분류합니다.
   */
  public calculateCycle(): CycleDayInfo[] {
    if (this.cycleDays) return this.cycleDays;

    const { periodStart, periodEnd, exclusions, options } = this.context;
    const cycle: StudyReviewCycle = {
      study_days: options?.study_days ?? 6,
      review_days: options?.review_days ?? 1,
    };

    this.cycleDays = calculateStudyReviewCycle(
      periodStart,
      periodEnd,
      cycle,
      exclusions
    );

    return this.cycleDays;
  }

  /**
   * 콘텐츠 필터링 (취약과목 집중 모드)
   */
  private filterContents(): ContentInfo[] {
    if (this.filteredContents) return this.filteredContents;

    const { contents, options, riskIndexMap } = this.context;
    const weakSubjectFocus =
      options?.weak_subject_focus === "high" ||
      options?.weak_subject_focus === true;

    if (weakSubjectFocus && riskIndexMap) {
      const filtered = contents.filter((content) => {
        const subject = content.subject?.toLowerCase().trim() || "";
        const risk = riskIndexMap.get(subject);
        return risk && risk.riskScore >= 30;
      });

      // 필터링 결과가 없으면 전체 콘텐츠 사용
      this.filteredContents = filtered.length > 0 ? filtered : contents;
    } else {
      this.filteredContents = contents;
    }

    return this.filteredContents;
  }

  /**
   * 콘텐츠별 날짜 배정 (전략/취약 과목 로직 포함)
   * 각 콘텐츠를 학습일에 배정합니다.
   */
  public allocateContentDates(): Map<string, string[]> {
    if (this.contentAllocationMap) return this.contentAllocationMap;

    const cycleDays = this.calculateCycle();
    const contents = this.filterContents();
    const { options } = this.context;

    // 전략과목/취약과목 설정 추출
    const subjectAllocations = options?.subject_allocations as
      | Array<{
          subject_id?: string;
          subject_name: string;
          subject_type: "strategy" | "weakness";
          weekly_days?: number;
        }>
      | undefined;
    const contentAllocations = options?.content_allocations as
      | Array<{
          content_type: "book" | "lecture" | "custom";
          content_id: string;
          subject_type: "strategy" | "weakness";
          weekly_days?: number;
        }>
      | undefined;

    // 데이터 검증
    const validation = validateAllocations(
      contentAllocations,
      subjectAllocations
    );
    if (!validation.valid) {
      console.warn("[SchedulerEngine] 전략과목/취약과목 설정 검증 실패:", {
        errors: validation.errors,
        subjectAllocations,
        contentAllocations,
      });
    }

    this.contentAllocationMap = new Map();

    contents.forEach((content) => {
      const allocation = getContentAllocation(
        {
          content_type: content.content_type,
          content_id: content.content_id,
          subject_category: content.subject_category || undefined,
          subject: content.subject || undefined,
        },
        contentAllocations,
        subjectAllocations
      );

      const subjectAlloc: SubjectAllocation = {
        subject_id: content.content_id,
        subject_name: content.subject_category || content.subject || "",
        subject_type: allocation.subject_type,
        weekly_days: allocation.weekly_days,
      };

      const allocatedDates = calculateSubjectAllocationDates(
        cycleDays,
        subjectAlloc
      );

      // 학습일 배정 검증
      const studyDatesSet = new Set(
        cycleDays.filter((d) => d.day_type === "study").map((d) => d.date)
      );
      const validAllocatedDates = allocatedDates.filter((date) =>
        studyDatesSet.has(date)
      );

      if (validAllocatedDates.length === 0) {
        const reason = allocation.subject_type === "strategy"
          ? "전략과목 설정에 따라 학습일이 배정되지 않았습니다"
          : allocation.subject_type === "weakness"
            ? "취약과목 설정에 따라 학습일이 배정되지 않았습니다"
            : "학습일이 배정되지 않았습니다";

        this.addFailureReason({
          type: "content_allocation_failed",
          contentId: content.content_id,
          contentType: content.content_type,
          reason,
        });

        console.warn("[SchedulerEngine] 학습일 배정 실패:", {
          content_id: content.content_id,
          content_type: content.content_type,
          subject_type: allocation.subject_type,
          weekly_days: allocation.weekly_days,
          message:
            "학습일이 배정되지 않았습니다. 이 콘텐츠는 플랜이 생성되지 않습니다.",
        });
        if (this.contentAllocationMap) {
          this.contentAllocationMap.set(content.content_id, []);
        }
        return;
      }

      if (validAllocatedDates.length !== allocatedDates.length) {
        console.warn("[SchedulerEngine] 일부 날짜가 학습일이 아님, 필터링:", {
          content_id: content.content_id,
          originalCount: allocatedDates.length,
          validCount: validAllocatedDates.length,
        });
      }

      if (this.contentAllocationMap) {
        this.contentAllocationMap.set(content.content_id, validAllocatedDates);
      }
    });

    return this.contentAllocationMap;
  }

  /**
   * 학습 범위 분할
   * 배정된 날짜에 학습 범위를 분배합니다.
   */
  private divideContentRanges(): Map<
    string,
    Map<string, { start: number; end: number }>
  > {
    if (this.contentRangeMap) return this.contentRangeMap;

    const allocationMap = this.allocateContentDates();
    const contents = this.filterContents();

    this.contentRangeMap = new Map();

    contents.forEach((content) => {
      const allocatedDates = allocationMap.get(content.content_id) || [];
      if (allocatedDates.length === 0) {
        console.warn("[SchedulerEngine] 학습 범위 분할 스킵 (학습일 없음):", {
          content_id: content.content_id,
          content_type: content.content_type,
        });
        return;
      }

      const rangeMap = divideContentRange(
        content.total_amount,
        allocatedDates,
        content.content_id
      );

      if (rangeMap.size === 0) {
        this.addFailureReason({
          type: "range_division_failed",
          contentId: content.content_id,
          contentType: content.content_type,
          totalAmount: content.total_amount,
          allocatedDates: allocatedDates.length,
        });

        console.warn("[SchedulerEngine] 학습 범위 분할 결과 없음:", {
          content_id: content.content_id,
          allocatedDatesCount: allocatedDates.length,
          total_amount: content.total_amount,
        });
        return;
      }

      // start_range 오프셋 적용
      const adjustedRangeMap = new Map<
        string,
        { start: number; end: number }
      >();
      rangeMap.forEach((range, date) => {
        adjustedRangeMap.set(date, {
          start: content.start_range + range.start,
          end: content.start_range + range.end,
        });
      });

      if (this.contentRangeMap) {
        this.contentRangeMap.set(content.content_id, adjustedRangeMap);
      }
    });

    return this.contentRangeMap;
  }

  /**
   * 주차별로 그룹화
   */
  private groupByWeek(cycleDays: CycleDayInfo[]): Map<
    number,
    {
      studyDays: string[];
      reviewDays: string[];
      allDays: string[];
    }
  > {
    const weeks = new Map<
      number,
      {
        studyDays: string[];
        reviewDays: string[];
        allDays: string[];
      }
    >();

    cycleDays.forEach((cycleDay) => {
      if (cycleDay.day_type === "exclusion") {
        return;
      }

      const cycleNumber = cycleDay.cycle_number;
      if (!weeks.has(cycleNumber)) {
        weeks.set(cycleNumber, {
          studyDays: [],
          reviewDays: [],
          allDays: [],
        });
      }

      const week = weeks.get(cycleNumber)!;
      week.allDays.push(cycleDay.date);

      if (cycleDay.day_type === "study") {
        week.studyDays.push(cycleDay.date);
      } else if (cycleDay.day_type === "review") {
        week.reviewDays.push(cycleDay.date);
      }
    });

    return weeks;
  }

  /**
   * 학습일 플랜 생성
   *
   * @returns 플랜 배열과 studyPlansByDate 맵을 반환합니다.
   */
  private generateStudyDayPlans(
    studyDaysList: string[],
    contents: ContentInfo[],
    rangeMap: Map<string, Map<string, { start: number; end: number }>>,
    dateAvailableTimeRanges?: DateAvailableTimeRanges,
    dateTimeSlots?: DateTimeSlots,
    contentDurationMap?: ContentDurationMap,
    riskIndexMap?: Map<string, { riskScore: number }>
  ): {
    plans: ScheduledPlan[];
    studyPlansByDate: Map<
      string,
      Array<{ content: ContentInfo; start: number; end: number }>
    >;
  } {
    const plans: ScheduledPlan[] = [];

    // 취약과목 우선 배정 (정렬)
    const sortedContents = [...contents].sort((a, b) => {
      const aSubject = a.subject?.toLowerCase().trim() || "";
      const bSubject = b.subject?.toLowerCase().trim() || "";
      const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
      const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
      return bRisk - aRisk;
    });

    // 배정된 날짜별로 플랜 생성
    const studyPlansByDate = new Map<
      string,
      Array<{
        content: ContentInfo;
        start: number;
        end: number;
      }>
    >();

    // studyPlansByDate 구성
    sortedContents.forEach((content) => {
      const contentRangeMap = rangeMap.get(content.content_id);
      if (!contentRangeMap) return;

      contentRangeMap.forEach((range, date) => {
        if (!studyDaysList.includes(date)) return;

        if (!studyPlansByDate.has(date)) {
          studyPlansByDate.set(date, []);
        }
        studyPlansByDate.get(date)!.push({
          content,
          start: range.start,
          end: range.end,
        });
      });
    });

    // 학습일 플랜이 없는 경우 경고
    if (studyPlansByDate.size === 0) {
      console.warn("[SchedulerEngine] 학습일 플랜이 생성되지 않음:", {
        studyDaysList,
        totalContentsCount: sortedContents.length,
        contentsWithRangeMap: Array.from(rangeMap.keys()).length,
      });
    }

    studyPlansByDate.forEach((datePlans, date) => {
      const availableRanges = dateAvailableTimeRanges?.get(date) || [];
      const timeSlots = dateTimeSlots?.get(date) || [];
      const studyTimeSlots = timeSlots.filter(
        (slot) => slot.type === "학습시간"
      );

      // Best Fit 알고리즘을 위한 플랜 정렬: 소요시간 내림차순 (큰 것부터 배치)
      const plansWithDuration = datePlans.map(({ content, start, end: endAmount }) => ({
        content,
        start,
        end: endAmount,
        requiredMinutes: calculateContentDuration(
          content,
          start,
          endAmount,
          contentDurationMap
        ),
        remainingMinutes: calculateContentDuration(
          content,
          start,
          endAmount,
          contentDurationMap
        ),
      })).sort((a, b) => b.requiredMinutes - a.requiredMinutes); // 소요시간 내림차순

      let blockIndex = 1;
      let totalAvailableMinutes = 0;

      // 학습시간 슬롯이 있으면 사용, 없으면 available_time_ranges 사용
      if (studyTimeSlots.length > 0) {
        // 사용 가능한 총 시간 계산
        studyTimeSlots.forEach((slot) => {
          const slotStart = timeToMinutes(slot.start);
          const slotEnd = timeToMinutes(slot.end);
          totalAvailableMinutes += slotEnd - slotStart;
        });

        // 슬롯별 사용 가능한 시간 추적
        const slotAvailability: Array<{ slot: typeof studyTimeSlots[0]; usedTime: number }> = studyTimeSlots.map((slot) => ({
          slot,
          usedTime: 0,
        }));

        // Best Fit 알고리즘: 각 플랜을 가장 적합한 슬롯에 배치
        for (const planInfo of plansWithDuration) {
          if (planInfo.remainingMinutes <= 0) continue;

          // Best Fit: 남은 시간이 가장 적은 슬롯 찾기 (하지만 플랜이 들어갈 수 있어야 함)
          let bestSlotIndex = -1;
          let bestRemainingSpace = Infinity;

          for (let i = 0; i < slotAvailability.length; i++) {
            const { slot, usedTime } = slotAvailability[i];
            const slotStart = timeToMinutes(slot.start);
            const slotEnd = timeToMinutes(slot.end);
            const slotDuration = slotEnd - slotStart;
            const availableTime = slotDuration - usedTime;

            // 플랜이 들어갈 수 있고, 남은 공간이 가장 적은 슬롯 선택
            if (availableTime >= planInfo.remainingMinutes && availableTime < bestRemainingSpace) {
              bestSlotIndex = i;
              bestRemainingSpace = availableTime;
            }
          }

          // Best Fit 슬롯을 찾지 못한 경우, First Fit으로 폴백
          if (bestSlotIndex === -1) {
            for (let i = 0; i < slotAvailability.length; i++) {
              const { slot, usedTime } = slotAvailability[i];
              const slotStart = timeToMinutes(slot.start);
              const slotEnd = timeToMinutes(slot.end);
              const slotDuration = slotEnd - slotStart;
              const availableTime = slotDuration - usedTime;

              if (availableTime > 0) {
                bestSlotIndex = i;
                break;
              }
            }
          }

          // 플랜 배치
          while (planInfo.remainingMinutes > 0 && bestSlotIndex >= 0) {
            const { slot, usedTime } = slotAvailability[bestSlotIndex];
            const slotStart = timeToMinutes(slot.start);
            const slotEnd = timeToMinutes(slot.end);
            const slotDuration = slotEnd - slotStart;
            const availableTime = slotDuration - usedTime;
            const slotUsed = Math.min(planInfo.remainingMinutes, availableTime);

            if (slotUsed > 0) {
              const planStartTime = minutesToTime(slotStart + usedTime);
              const planEndTime = minutesToTime(slotStart + usedTime + slotUsed);

              plans.push({
                plan_date: date,
                block_index: blockIndex,
                content_type: planInfo.content.content_type,
                content_id: planInfo.content.content_id,
                planned_start_page_or_time: planInfo.start,
                planned_end_page_or_time: planInfo.end,
                is_reschedulable: true,
                start_time: planStartTime,
                end_time: planEndTime,
              });

              planInfo.remainingMinutes -= slotUsed;
              slotAvailability[bestSlotIndex].usedTime += slotUsed;
              blockIndex++;

              // 슬롯이 가득 찬 경우 다음 슬롯 찾기
              if (slotAvailability[bestSlotIndex].usedTime >= slotDuration) {
                bestSlotIndex = -1;
                // 다음 사용 가능한 슬롯 찾기
                for (let i = 0; i < slotAvailability.length; i++) {
                  const { slot: nextSlot, usedTime: nextUsedTime } = slotAvailability[i];
                  const nextSlotStart = timeToMinutes(nextSlot.start);
                  const nextSlotEnd = timeToMinutes(nextSlot.end);
                  const nextSlotDuration = nextSlotEnd - nextSlotStart;
                  const nextAvailableTime = nextSlotDuration - nextUsedTime;

                  if (nextAvailableTime > 0) {
                    bestSlotIndex = i;
                    break;
                  }
                }
              }
            } else {
              break;
            }
          }

          // 시간 부족 감지
          if (planInfo.remainingMinutes > 0) {
            const week = calculateWeekNumber(date, this.context.periodStart);
            const dayOfWeek = getDayOfWeekName(new Date(date).getDay());

            this.addFailureReason({
              type: "insufficient_time",
              week,
              dayOfWeek,
              date,
              requiredMinutes: planInfo.requiredMinutes,
              availableMinutes: totalAvailableMinutes,
            });
          }
        }
      } else {
        // 학습시간 슬롯이 없으면 available_time_ranges 사용 (First Fit 유지)
        let slotIndex = 0;
        let currentSlotPosition = 0;

        // 사용 가능한 총 시간 계산
        availableRanges.forEach((range) => {
          const startMinutes = timeToMinutes(range.start);
          const endMinutes = timeToMinutes(range.end);
          totalAvailableMinutes +=
            endMinutes > startMinutes ? endMinutes - startMinutes : 60;
        });

        for (const planInfo of plansWithDuration) {
          let remainingMinutes = planInfo.remainingMinutes;

          while (remainingMinutes > 0 && slotIndex < availableRanges.length) {
            const timeRange = availableRanges[slotIndex] || {
              start: "10:00",
              end: "19:00",
            };
            const startMinutes = timeToMinutes(timeRange.start);
            const endMinutes = timeToMinutes(timeRange.end);
            const rangeDuration =
              endMinutes > startMinutes ? endMinutes - startMinutes : 60;
            const slotAvailable = rangeDuration - currentSlotPosition;
            const actualDuration = Math.min(remainingMinutes, slotAvailable);
            const planStartTime = minutesToTime(
              startMinutes + currentSlotPosition
            );
            const planEndTime = minutesToTime(
              startMinutes + currentSlotPosition + actualDuration
            );

            plans.push({
              plan_date: date,
              block_index: blockIndex,
              content_type: planInfo.content.content_type,
              content_id: planInfo.content.content_id,
              planned_start_page_or_time: planInfo.start,
              planned_end_page_or_time: planInfo.end,
              is_reschedulable: true,
              start_time: planStartTime,
              end_time: planEndTime,
            });

            remainingMinutes -= actualDuration;
            currentSlotPosition += actualDuration;
            blockIndex++;

            if (currentSlotPosition >= rangeDuration) {
              slotIndex++;
              currentSlotPosition = 0;
            }
          }

          // 시간 부족 감지
          if (remainingMinutes > 0) {
            const week = calculateWeekNumber(date, this.context.periodStart);
            const dayOfWeek = getDayOfWeekName(new Date(date).getDay());

            this.addFailureReason({
              type: "insufficient_time",
              week,
              dayOfWeek,
              date,
              requiredMinutes: planInfo.requiredMinutes,
              availableMinutes: totalAvailableMinutes,
            });
          }
        }
      }
    });

    return { plans, studyPlansByDate };
  }

  /**
   * 복습일 플랜 생성
   */
  private generateReviewDayPlans(
    reviewDaysList: string[],
    studyDaysList: string[],
    contents: ContentInfo[],
    rangeMap: Map<string, Map<string, { start: number; end: number }>>,
    dateAvailableTimeRanges?: DateAvailableTimeRanges,
    studyPlansByDate?: Map<
      string,
      Array<{ content: ContentInfo; start: number; end: number }>
    >
  ): ScheduledPlan[] {
    const plans: ScheduledPlan[] = [];

    // 학습일에 실제로 플랜이 생성되었는지 확인
    const hasStudyPlans = studyPlansByDate && studyPlansByDate.size > 0;
    const studyPlansCount = studyPlansByDate
      ? Array.from(studyPlansByDate.values()).reduce(
          (sum, plans) => sum + plans.length,
          0
        )
      : 0;

    if (
      reviewDaysList.length > 0 &&
      (!hasStudyPlans || studyPlansCount === 0)
    ) {
      console.warn(
        "[SchedulerEngine] 복습일 플랜 생성 불가 (학습일 플랜 없음):",
        {
          reviewDaysList,
          studyPlansCount,
        }
      );
      return plans;
    }

    // 이번 주 학습일에 배정된 콘텐츠 범위 저장 (복습용)
    const weekContentRanges = new Map<
      string,
      {
        startAmount: number;
        endAmount: number;
      }
    >();

    if (studyPlansByDate) {
      studyPlansByDate.forEach((datePlans, date) => {
        if (!studyDaysList.includes(date)) return;

        datePlans.forEach(({ content, start, end: endAmount }) => {
          if (!weekContentRanges.has(content.content_id)) {
            weekContentRanges.set(content.content_id, {
              startAmount: start,
              endAmount: endAmount,
            });
          } else {
            const existing = weekContentRanges.get(content.content_id)!;
            existing.startAmount = Math.min(existing.startAmount, start);
            existing.endAmount = Math.max(existing.endAmount, endAmount);
          }
        });
      });
    }

    reviewDaysList.forEach((reviewDay) => {
      if (
        !reviewDay ||
        weekContentRanges.size === 0 ||
        !hasStudyPlans ||
        studyPlansCount === 0
      ) {
        return;
      }

      // 복습 콘텐츠 목록 생성 (이번 주에 학습한 콘텐츠만)
      const reviewContents = contents.filter((content) =>
        weekContentRanges.has(content.content_id)
      );

      if (reviewContents.length === 0) {
        console.warn(
          "[SchedulerEngine] 복습일 플랜 생성 스킵 (복습 콘텐츠 없음):",
          {
            reviewDay,
            weekContentRangesCount: weekContentRanges.size,
          }
        );
        return;
      }

      const availableRanges = dateAvailableTimeRanges?.get(reviewDay) || [];
      let rangeIndex = 0;
      let blockIndex = 1;

      reviewContents.forEach((content) => {
        const range = weekContentRanges.get(content.content_id);
        if (!range) return;

        if (rangeIndex >= availableRanges.length) {
          rangeIndex = availableRanges.length - 1;
        }

        const timeRange = availableRanges[rangeIndex] || {
          start: "10:00",
          end: "19:00",
        };

        plans.push({
          plan_date: reviewDay,
          block_index: blockIndex,
          content_type: content.content_type,
          content_id: content.content_id,
          planned_start_page_or_time: range.startAmount,
          planned_end_page_or_time: range.endAmount,
          is_reschedulable: true,
          start_time: timeRange.start,
          end_time: timeRange.end,
        });

        blockIndex++;
        rangeIndex++;
      });
    });

    return plans;
  }

  /**
   * 시간 슬롯 배정 (Bin Packing 알고리즘 유사 로직)
   * 주차별로 학습일과 복습일 플랜을 생성합니다.
   */
  public assignTimeSlots(): ScheduledPlan[] {
    const cycleDays = this.calculateCycle();
    const rangeMap = this.divideContentRanges();
    const contents = this.filterContents();
    const {
      dateAvailableTimeRanges,
      dateTimeSlots,
      contentDurationMap,
      riskIndexMap,
    } = this.context;

    const plans: ScheduledPlan[] = [];

    // 주차별로 그룹화
    const weeks = this.groupByWeek(cycleDays);

    weeks.forEach((week, cycleNumber) => {
      const studyDaysList = week.studyDays;
      const reviewDaysList = week.reviewDays;

      // 취약과목 우선 배정 (정렬)
      const sortedContents = [...contents].sort((a, b) => {
        const aSubject = a.subject?.toLowerCase().trim() || "";
        const bSubject = b.subject?.toLowerCase().trim() || "";
        const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
        const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
        return bRisk - aRisk;
      });

      // 학습일 플랜 생성
      const { plans: studyPlans, studyPlansByDate } =
        this.generateStudyDayPlans(
          studyDaysList,
          sortedContents,
          rangeMap,
          dateAvailableTimeRanges,
          dateTimeSlots,
          contentDurationMap,
          riskIndexMap
        );
      plans.push(...studyPlans);

      // 복습일 플랜 생성
      const reviewPlans = this.generateReviewDayPlans(
        reviewDaysList,
        studyDaysList,
        sortedContents,
        rangeMap,
        dateAvailableTimeRanges,
        studyPlansByDate
      );
      plans.push(...reviewPlans);
    });

    return plans;
  }

  /**
   * 최종 실행
   * 모든 단계를 순차적으로 실행하여 최종 플랜을 생성합니다.
   * 
   * @returns 생성된 플랜 배열
   */
  public generate(): ScheduledPlan[] {
    const plans = this.assignTimeSlots();

    // 플랜이 생성되지 않은 경우 원인 분석
    if (plans.length === 0) {
      const cycleDays = this.calculateCycle();
      const studyDays = cycleDays.filter((d) => d.day_type === "study");
      
      if (studyDays.length === 0) {
        this.addFailureReason({
          type: "no_study_days",
          period: `${this.context.periodStart} ~ ${this.context.periodEnd}`,
          totalDays: cycleDays.length,
          excludedDays: this.context.exclusions.length,
        });
      } else {
        this.addFailureReason({
          type: "no_plans_generated",
          reason: "플랜이 생성되지 않았습니다. 콘텐츠 배정 또는 시간 슬롯 설정을 확인해주세요.",
        });
      }
    }

    return plans;
  }
}
