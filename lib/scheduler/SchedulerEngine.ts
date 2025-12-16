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
import { calculateContentDuration } from "@/lib/plan/contentDuration";

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
   * Capacity-based Content Distribution (Capacity-Aware Scheduling)
   * Distributes content based on available time capacity of each day.
   */
  private distributeContentWithCapacity(
    content: ContentInfo,
    allocatedDates: string[],
    durationInfo: {
      content_type: "book" | "lecture" | "custom";
      content_id: string;
      total_pages?: number | null;
      duration?: number | null;
      total_page_or_time?: number | null;
      episodes?: Array<{
        episode_number: number;
        duration: number | null;
      }> | null;
    }
  ): Map<string, { start: number; end: number }> {
    const result = new Map<string, { start: number; end: number }>();
    if (allocatedDates.length === 0) return result;

    const { dateAvailableTimeRanges, dateTimeSlots } = this.context;
    
    // 1. Calculate available duration for each day (in minutes)
    const dailyCapacities = new Map<string, number>();
    
    allocatedDates.forEach(date => {
      let capacity = 0;
      
      // Use time_slots (Step 2.5) if available
      const timeSlots = dateTimeSlots?.get(date);
      const studyTimeSlots = timeSlots?.filter(slot => slot.type === "학습시간");
      
      if (studyTimeSlots && studyTimeSlots.length > 0) {
        studyTimeSlots.forEach(slot => {
          capacity += timeToMinutes(slot.end) - timeToMinutes(slot.start);
        });
      } else {
        // Fallback to available_time_ranges
        const ranges = dateAvailableTimeRanges?.get(date) || [];
        ranges.forEach(range => {
          capacity += timeToMinutes(range.end) - timeToMinutes(range.start);
        });
        
        // If no ranges defined, assume default (e.g., 2 hours)
        if (capacity === 0) capacity = 120;
      }
      
      dailyCapacities.set(date, capacity);
    });

    // 2. Distribute content units
    let currentStart = content.start_range;
    const totalEnd = content.end_range;
    const totalRange = totalEnd - currentStart; // 총 회차/페이지 수
    
    // Sort dates chronologically
    const sortedDates = [...allocatedDates].sort();
    const totalStudyDays = sortedDates.length;
    
    // 강의 콘텐츠의 경우: 학습일 수에 맞춰 균등 분배
    // 학습일이 30일이고 회차가 30개면 하루 1개씩 분배
    if (content.content_type === "lecture" && durationInfo.episodes && totalStudyDays > 0 && totalRange > 0) {
      // 각 날짜의 배정 범위를 직접 계산하여 오차 누적 방지
      const dailyRange = totalRange / totalStudyDays;
      
      for (let i = 0; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const isLastDay = i === sortedDates.length - 1;
        
        // 각 날짜의 시작 위치와 끝 위치를 직접 계산 (누적 오차 방지)
        const dayStartPos = Math.round(i * dailyRange);
        const dayEndPos = isLastDay
          ? totalRange
          : Math.round((i + 1) * dailyRange);
        
        // 실제 회차 범위 (start_range 오프셋 적용)
        const actualStart = content.start_range + dayStartPos;
        const actualEnd = content.start_range + dayEndPos;
        
        // 회차가 있는 경우만 배정
        if (actualEnd > actualStart) {
          result.set(date, { start: actualStart, end: actualEnd });
        }
      }
      
      return result;
    }
    
    // 교재 및 커스텀 콘텐츠: Capacity-Aware 배치 (기존 로직)
    for (let i = 0; i < sortedDates.length; i++) {
      const date = sortedDates[i];
      const isLastDay = i === sortedDates.length - 1;
      
      if (currentStart >= totalEnd) break;
      
      if (isLastDay) {
        // Last day takes all remaining content
        result.set(date, { start: currentStart, end: totalEnd });
        break;
      }
      
      const dayCapacity = dailyCapacities.get(date) || 120;
      let usedTime = 0;
      let dayEnd = currentStart;
      
      // Capacity-Aware Filling
      while (dayEnd < totalEnd) {
        // Determine unit size and duration
        let unitSize = 1; 
        let unitDuration = 0;
        
        if (content.content_type === "book") {
          // Book pages
          unitSize = 1; // 1 page
          unitDuration = 2; // default 2 mins/page
          if (durationInfo.total_pages && durationInfo.duration) {
             unitDuration = durationInfo.duration / durationInfo.total_pages;
          }
        } else {
          // Custom / Fallback
          unitDuration = 1; // 1 min per unit
        }
        
        // Check fit
        if (usedTime + unitDuration <= dayCapacity) {
          usedTime += unitDuration;
          dayEnd += unitSize;
        } else {
          // Ensure at least one unit progress per allocated day if empty
          if (usedTime === 0) {
             usedTime += unitDuration;
             dayEnd += unitSize;
          }
          break; // Day full
        }
      }
      
      result.set(date, { start: currentStart, end: dayEnd });
      currentStart = dayEnd;
    }

    return result;
  }

  /**
   * 전역 배치 조율 (Global Coordination)
   *
   * 모든 콘텐츠를 함께 고려하여 전체 기간에 고르게 분산 배정합니다.
   * 기존의 독립적 배정 방식 대신 Round-Robin 방식으로 분산 배정합니다.
   *
   * @param contents - 필터링된 콘텐츠 배열
   * @param allocationMap - 콘텐츠별 배정 날짜 맵
   * @returns 콘텐츠별 날짜별 범위 맵
   */
  private coordinateGlobalDistribution(
    contents: ContentInfo[],
    allocationMap: Map<string, string[]>
  ): Map<string, Map<string, { start: number; end: number }>> {
    const { dateTimeSlots, dateAvailableTimeRanges, contentDurationMap, riskIndexMap } = this.context;
    const result = new Map<string, Map<string, { start: number; end: number }>>();

    // 1. 날짜별 총 capacity 계산
    const allDates = new Set<string>();
    allocationMap.forEach((dates) => dates.forEach((d) => allDates.add(d)));

    const dateCapacities = new Map<string, number>();
    const dateUsage = new Map<string, number>(); // 날짜별 사용량 추적

    allDates.forEach((date) => {
      let capacity = 0;
      const timeSlots = dateTimeSlots?.get(date);
      const studyTimeSlots = timeSlots?.filter((slot) => slot.type === "학습시간");

      if (studyTimeSlots && studyTimeSlots.length > 0) {
        studyTimeSlots.forEach((slot) => {
          capacity += timeToMinutes(slot.end) - timeToMinutes(slot.start);
        });
      } else {
        const ranges = dateAvailableTimeRanges?.get(date) || [];
        ranges.forEach((range) => {
          capacity += timeToMinutes(range.end) - timeToMinutes(range.start);
        });
        if (capacity === 0) capacity = 120; // 기본값: 2시간
      }

      dateCapacities.set(date, capacity);
      dateUsage.set(date, 0);
    });

    // 2. 콘텐츠 우선순위 정렬 (취약과목 우선, Risk Index 높은 순)
    const sortedContents = [...contents].sort((a, b) => {
      const aSubject = a.subject?.toLowerCase().trim() || "";
      const bSubject = b.subject?.toLowerCase().trim() || "";
      const aRisk = riskIndexMap?.get(aSubject)?.riskScore || 0;
      const bRisk = riskIndexMap?.get(bSubject)?.riskScore || 0;
      // Risk Index 내림차순, 같으면 총량 내림차순
      if (bRisk !== aRisk) return bRisk - aRisk;
      return b.total_amount - a.total_amount;
    });

    // 3. 콘텐츠별 단위당 소요시간 계산 헬퍼
    const getUnitDuration = (
      content: ContentInfo,
      unitIndex: number
    ): number => {
      const durationInfo = contentDurationMap?.get(content.content_id);

      if (content.content_type === "lecture" && durationInfo?.episodes) {
        const ep = durationInfo.episodes.find(
          (e) => e.episode_number === unitIndex
        );
        return ep?.duration || 30;
      } else if (content.content_type === "book") {
        if (durationInfo?.total_pages && durationInfo?.duration) {
          return durationInfo.duration / durationInfo.total_pages;
        }
        return 2; // 페이지당 기본 2분
      }
      return 1; // 커스텀: 단위당 1분
    };

    // 4. 각 콘텐츠를 전역 조율하여 배정 (Round-Robin 방식)
    for (const content of sortedContents) {
      const allocatedDates = allocationMap.get(content.content_id) || [];
      if (allocatedDates.length === 0) continue;

      const sortedDates = [...allocatedDates].sort();

      let currentUnit = content.start_range;
      const totalEnd = content.end_range;

      // Round-Robin 분산 배정: 각 날짜에 최소 1단위씩 배정 후, 남은 용량에 맞게 추가 배정
      const dateAssignments = new Map<string, { start: number; end: number }>();

      // 4.1 먼저 각 날짜에 배정 가능한 단위 수 계산 (사용률 기반)
      const getDateScore = (date: string): number => {
        const capacity = dateCapacities.get(date) || 120;
        const used = dateUsage.get(date) || 0;
        const remaining = capacity - used;
        // 남은 용량이 많을수록 높은 점수
        return remaining;
      };

      // 4.2 균등 분산을 위해 날짜별로 순환하며 배정
      let dateIndex = 0;
      const totalUnits = totalEnd - content.start_range;
      const unitsPerDate = Math.ceil(totalUnits / sortedDates.length);

      for (const date of sortedDates) {
        if (currentUnit >= totalEnd) break;

        const isLastDate = dateIndex === sortedDates.length - 1;
        const dateCapacity = dateCapacities.get(date) || 120;
        const dateCurrentUsage = dateUsage.get(date) || 0;
        const remainingCapacity = dateCapacity - dateCurrentUsage;

        // 목표 단위 수: 균등 분산 또는 마지막 날짜는 나머지 전부
        const targetUnits = isLastDate
          ? totalEnd - currentUnit
          : Math.min(unitsPerDate, totalEnd - currentUnit);

        // 용량 제한 확인
        let usedTime = 0;
        let actualUnits = 0;

        while (actualUnits < targetUnits && currentUnit + actualUnits < totalEnd) {
          const unitDuration = getUnitDuration(content, currentUnit + actualUnits);

          if (usedTime + unitDuration <= remainingCapacity || actualUnits === 0) {
            usedTime += unitDuration;
            actualUnits++;
          } else {
            break;
          }
        }

        // 최소 1단위는 배정 (빈 날짜 방지)
        if (actualUnits === 0 && currentUnit < totalEnd) {
          actualUnits = 1;
          usedTime = getUnitDuration(content, currentUnit);
        }

        if (actualUnits > 0) {
          dateAssignments.set(date, {
            start: currentUnit,
            end: currentUnit + actualUnits,
          });

          // 사용량 업데이트
          dateUsage.set(date, dateCurrentUsage + usedTime);
          currentUnit += actualUnits;
        }

        dateIndex++;
      }

      // 4.3 남은 단위가 있으면 용량이 남은 날짜에 추가 배정
      if (currentUnit < totalEnd) {
        // 남은 용량이 많은 날짜 순으로 정렬
        const datesWithCapacity = sortedDates
          .filter((date) => {
            const capacity = dateCapacities.get(date) || 120;
            const used = dateUsage.get(date) || 0;
            return capacity - used > 0;
          })
          .sort((a, b) => getDateScore(b) - getDateScore(a));

        for (const date of datesWithCapacity) {
          if (currentUnit >= totalEnd) break;

          const existing = dateAssignments.get(date);
          const dateCapacity = dateCapacities.get(date) || 120;
          const dateCurrentUsage = dateUsage.get(date) || 0;
          const remainingCapacity = dateCapacity - dateCurrentUsage;

          let usedTime = 0;
          let additionalUnits = 0;

          while (currentUnit + additionalUnits < totalEnd) {
            const unitDuration = getUnitDuration(content, currentUnit + additionalUnits);
            if (usedTime + unitDuration <= remainingCapacity) {
              usedTime += unitDuration;
              additionalUnits++;
            } else {
              break;
            }
          }

          if (additionalUnits > 0) {
            if (existing) {
              // 기존 배정에 추가
              dateAssignments.set(date, {
                start: existing.start,
                end: existing.end + additionalUnits,
              });
            } else {
              dateAssignments.set(date, {
                start: currentUnit,
                end: currentUnit + additionalUnits,
              });
            }

            dateUsage.set(date, dateCurrentUsage + usedTime);
            currentUnit += additionalUnits;
          }
        }
      }

      // 4.4 결과 저장
      result.set(content.content_id, dateAssignments);
    }

    return result;
  }

  /**
   * 학습 범위 분할
   * 배정된 날짜에 학습 범위를 분배합니다.
   * 개선: 전역 배치 조율(Global Coordination)을 사용하여 분산 배정
   */
  private divideContentRanges(): Map<
    string,
    Map<string, { start: number; end: number }>
  > {
    if (this.contentRangeMap) return this.contentRangeMap;

    const allocationMap = this.allocateContentDates();
    const contents = this.filterContents();
    const { contentDurationMap } = this.context;

    // 전역 배치 조율 사용 (모든 콘텐츠를 함께 고려)
    const hasMultipleContents = contents.length > 1;
    const hasDurationInfo = contents.some(
      (c) => contentDurationMap?.get(c.content_id)
    );

    if (hasMultipleContents && hasDurationInfo) {
      // 전역 배치 조율 사용
      this.contentRangeMap = this.coordinateGlobalDistribution(
        contents,
        allocationMap
      );

      // 실패한 콘텐츠 체크
      contents.forEach((content) => {
        const rangeMap = this.contentRangeMap?.get(content.content_id);
        if (!rangeMap || rangeMap.size === 0) {
          this.addFailureReason({
            type: "range_division_failed",
            contentId: content.content_id,
            contentType: content.content_type,
            totalAmount: content.total_amount,
            allocatedDates: allocationMap.get(content.content_id)?.length || 0,
          });
        }
      });

      return this.contentRangeMap;
    }

    // 단일 콘텐츠이거나 duration 정보가 없는 경우 기존 로직 사용
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

      // Check if we have duration info for Capacity-Aware Scheduling
      const durationInfo = contentDurationMap?.get(content.content_id);

      let rangeMap: Map<string, { start: number; end: number }>;

      // Use Capacity-Aware Logic if duration info exists (especially for Lectures)
      if (durationInfo && (content.content_type === "lecture" || content.content_type === "book")) {
         rangeMap = this.distributeContentWithCapacity(content, allocatedDates, durationInfo);
      } else {
         // Fallback to Naive Logic
         rangeMap = divideContentRange(
          content.total_amount,
          allocatedDates,
          content.content_id
        );
      }

      if (rangeMap.size === 0) {
        this.addFailureReason({
          type: "range_division_failed",
          contentId: content.content_id,
          contentType: content.content_type,
          totalAmount: content.total_amount,
          allocatedDates: allocatedDates.length,
        });
        return;
      }

      // start_range 오프셋 적용
      const adjustedRangeMap = new Map<
        string,
        { start: number; end: number }
      >();
      rangeMap.forEach((range, date) => {
        // range.start is 0-based offset from distribute logic?
        // divideContentRange returns 0-based offset usually?
        // checking divideContentRange impl: it uses currentStart=0.
        // distributeContentWithCapacity logic above used currentStart=content.start_range.
        // So for distributeContentWithCapacity, we don't need to add content.start_range again if it already tracked absolute pos.

        if (durationInfo && (content.content_type === "lecture" || content.content_type === "book")) {
             // Already absolute
             adjustedRangeMap.set(date, range);
        } else {
             // Naive logic returns relative offset
             adjustedRangeMap.set(date, {
              start: content.start_range + range.start,
              end: content.start_range + range.end,
            });
        }
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

    // 날짜 배열에서 가장 가까운 날짜 찾기 (헬퍼 함수)
    const findClosestDate = (targetDate: string, dateList: string[]): string | null => {
      if (dateList.length === 0) return null;
      
      const target = new Date(targetDate).getTime();
      let closestDate = dateList[0];
      let minDiff = Math.abs(new Date(closestDate).getTime() - target);
      
      for (const date of dateList) {
        const diff = Math.abs(new Date(date).getTime() - target);
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = date;
        }
      }
      
      return closestDate;
    };

    // studyPlansByDate 구성
    sortedContents.forEach((content) => {
      const contentRangeMap = rangeMap.get(content.content_id);
      if (!contentRangeMap) {
        console.warn("[SchedulerEngine] 콘텐츠에 rangeMap이 없음:", {
          content_id: content.content_id,
          content_type: content.content_type,
        });
        return;
      }

      const rangeMapDates = Array.from(contentRangeMap.keys());
      const matchedDates: string[] = [];
      const unmatchedDates: string[] = [];
      const adjustedDates: Map<string, string> = new Map(); // 원본 날짜 -> 조정된 날짜

      contentRangeMap.forEach((range, date) => {
        if (!studyDaysList.includes(date)) {
          unmatchedDates.push(date);
          
          // 가장 가까운 학습일로 자동 조정
          const closestDate = findClosestDate(date, studyDaysList);
          if (closestDate) {
            adjustedDates.set(date, closestDate);
            
            // 조정된 날짜에 플랜 추가
            if (!studyPlansByDate.has(closestDate)) {
              studyPlansByDate.set(closestDate, []);
            }
            studyPlansByDate.get(closestDate)!.push({
              content,
              start: range.start,
              end: range.end,
            });
            
            matchedDates.push(closestDate);
          }
          return;
        }

        matchedDates.push(date);
        if (!studyPlansByDate.has(date)) {
          studyPlansByDate.set(date, []);
        }
        studyPlansByDate.get(date)!.push({
          content,
          start: range.start,
          end: range.end,
        });
      });

      // 디버깅: 날짜 불일치 감지 및 조정 로그
      if (unmatchedDates.length > 0) {
        const adjustmentLog: Record<string, string> = {};
        adjustedDates.forEach((adjusted, original) => {
          adjustmentLog[original] = adjusted;
        });
        
        console.warn("[SchedulerEngine] rangeMap 날짜가 studyDaysList에 없어 자동 조정:", {
          content_id: content.content_id,
          rangeMapDates,
          unmatchedDates,
          adjustedDates: adjustmentLog,
          studyDaysListSample: studyDaysList.slice(0, 5),
          studyDaysListLength: studyDaysList.length,
        });
      }
    });

    // 학습일 플랜이 없는 경우 경고
    if (studyPlansByDate.size === 0) {
      const allRangeMapDates = new Set<string>();
      rangeMap.forEach((contentRangeMap) => {
        contentRangeMap.forEach((_, date) => {
          allRangeMapDates.add(date);
        });
      });

      console.warn("[SchedulerEngine] 학습일 플랜이 생성되지 않음:", {
        studyDaysList,
        studyDaysListLength: studyDaysList.length,
        totalContentsCount: sortedContents.length,
        contentsWithRangeMap: Array.from(rangeMap.keys()).length,
        allRangeMapDates: Array.from(allRangeMapDates),
        rangeMapDatesNotInStudyDays: Array.from(allRangeMapDates).filter(
          (date) => !studyDaysList.includes(date)
        ),
      });
    }

    studyPlansByDate.forEach((datePlans, date) => {
      const availableRanges = dateAvailableTimeRanges?.get(date) || [];
      const timeSlots = dateTimeSlots?.get(date) || [];
      const studyTimeSlots = timeSlots.filter(
        (slot) => slot.type === "학습시간"
      );

      // Best Fit 알고리즘을 위한 플랜 정렬: 소요시간 내림차순 (큰 것부터 배치)
      // If Content Type is Lecture, we might need to SPLIT the range into individual episodes here.
      // The user wants "1 episode per learning history".
      
      const expandedPlans: Array<{
          content: ContentInfo;
          start: number;
          end: number;
      }> = [];

      datePlans.forEach(dp => {
         if (dp.content.content_type === "lecture") {
             // Split range into individual episodes
             for (let ep = dp.start; ep < dp.end; ep++) {
                 expandedPlans.push({
                     content: dp.content,
                     start: ep,
                     end: ep + 1
                 });
             }
         } else {
             // Keep as range
             expandedPlans.push(dp);
         }
      });

      // Episode Map 캐싱 (성능 최적화: 같은 콘텐츠의 episode 정보를 재사용)
      const episodeMapCache = new Map<string, Map<number, number>>();
      
      const plansWithDuration = expandedPlans.map(({ content, start, end: endAmount }) => {
        const durationInfo = contentDurationMap?.get(content.content_id);
        const amount = endAmount - start;
        
        let requiredMinutes: number;
        
        // duration 정보가 있으면 통합 함수 사용, 없으면 기본값 계산
        if (durationInfo) {
          // 강의이고 episode 정보가 있는 경우, 캐시된 Map 사용
          if (content.content_type === "lecture" && durationInfo.episodes) {
            // Episode Map 캐싱 확인
            let episodeMap = episodeMapCache.get(content.content_id);
            if (!episodeMap) {
              // Map 생성 및 캐싱
              episodeMap = new Map<number, number>();
              for (const ep of durationInfo.episodes) {
                if (
                  ep.duration !== null &&
                  ep.duration !== undefined &&
                  ep.duration > 0 &&
                  ep.episode_number > 0
                ) {
                  episodeMap.set(ep.episode_number, ep.duration);
                }
              }
              episodeMapCache.set(content.content_id, episodeMap);
            }
            
            // 단일 episode인 경우 직접 Map에서 조회 (calculateContentDuration 호출 생략)
            if (amount === 1) {
              const episodeDuration = episodeMap.get(start);
              requiredMinutes = episodeDuration !== undefined && episodeDuration > 0
                ? episodeDuration
                : 30; // 기본값: 30분
            } else {
              // 범위인 경우 calculateContentDuration 사용
              requiredMinutes = calculateContentDuration(
                {
                  content_type: content.content_type,
                  content_id: content.content_id,
                  start_range: start,
                  end_range: endAmount - 1, // Convert Exclusive to Inclusive for calculation
                },
                durationInfo
              );
            }
          } else {
            // 강의가 아니거나 episode 정보가 없는 경우 기존 로직 사용
            requiredMinutes = calculateContentDuration(
              {
                content_type: content.content_type,
                content_id: content.content_id,
                start_range: start,
                end_range: endAmount - 1, // Convert Exclusive to Inclusive for calculation
              },
              durationInfo
            );
          }
        } else {
          // duration 정보가 없으면 기본값 계산
          requiredMinutes = amount > 0
            ? content.content_type === "lecture"
              ? amount * 30 // 강의: 회차당 30분
              : amount * 2 // 책/커스텀: 페이지당 2분
            : 60; // 기본값: 1시간
        }

        return {
          content,
          start,
          end: endAmount,
          requiredMinutes,
          remainingMinutes: requiredMinutes,
        };
      }).sort((a, b) => a.start - b.start); // 순서대로 배치 (페이지/회차 순)

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
                planned_end_page_or_time: planInfo.end - 1, // Convert Exclusive to Inclusive for DB
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
              planned_end_page_or_time: planInfo.end - 1, // Convert Exclusive to Inclusive for DB
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
          planned_end_page_or_time: range.endAmount - 1, // Convert Exclusive to Inclusive for DB
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
