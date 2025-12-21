/**
 * 스케줄 프로세서
 *
 * 플랜 생성/미리보기에서 공통으로 사용하는 스케줄 처리 기능을 제공합니다.
 * - 시간 세그먼트 처리
 * - 플랜 번호 계산
 * - 주차별 일차 계산
 *
 * @module lib/plan/scheduleProcessor
 */

import { assignPlanTimes } from "@/lib/plan/assignPlanTimes";
import type {
  DateTimeSlotsMap,
  DateMetadataMap,
  WeekDatesMap,
  ContentIdMap,
  ContentMetadataMap,
  ContentDurationMap,
  DayType,
  PlanNumberMap,
  UsedBlockIndicesByDateMap,
  GeneratePlanPayload,
  PreviewPlanPayload,
} from "@/lib/types/plan-generation";
import type { ScheduledPlan } from "@/lib/plan/scheduler";
import type { PlanGroup } from "@/lib/types/plan";

// ============================================
// 타입 정의
// ============================================

/**
 * 시간 세그먼트 처리 결과
 */
export type TimeSegmentResult = {
  plan: {
    content_id: string;
    content_type: "book" | "lecture" | "custom";
    planned_start_page_or_time: number;
    planned_end_page_or_time: number;
    chapter: string | null;
    block_index?: number;
  };
  start: string;
  end: string;
  isPartial: boolean;
  isContinued: boolean;
  originalEstimatedTime: number;
};

/**
 * 날짜별 처리 컨텍스트
 */
export type DateProcessingContext = {
  date: string;
  dateMetadata: {
    day_type: DayType;
    week_number: number | null;
  };
  studyTimeSlots: Array<{ start: string; end: string }>;
  totalStudyHours: number;
};

// ============================================
// 유틸리티 함수
// ============================================
// 
// @deprecated timeToMinutes와 minutesToTime 함수는 제거되었습니다.
// 대신 @/lib/utils/time에서 직접 import하여 사용하세요:
// import { timeToMinutes, minutesToTime } from "@/lib/utils/time"

/**
 * 학습 시간 슬롯을 추출하고 정렬합니다.
 */
export function extractStudyTimeSlots(
  dateTimeSlots: DateTimeSlotsMap,
  date: string
): Array<{ start: string; end: string }> {
  const timeSlots = dateTimeSlots.get(date) || [];
  return timeSlots
    .filter((slot) => slot.type === "학습시간")
    .map((slot) => ({ start: slot.start, end: slot.end }))
    .sort((a, b) => {
      const aStart = a.start.split(":").map(Number);
      const bStart = b.start.split(":").map(Number);
      const aMinutes = aStart[0] * 60 + aStart[1];
      const bMinutes = bStart[0] * 60 + bStart[1];
      return aMinutes - bMinutes;
    });
}

/**
 * 주차별 일차(day)를 계산합니다.
 */
export function calculateWeekDay(
  date: string,
  weekNumber: number | null,
  weekDatesMap: WeekDatesMap,
  periodStart: string,
  schedulerType?: string | null
): number | null {
  if (!weekNumber) {
    return null;
  }

  if (schedulerType === "1730_timetable") {
    const weekDates = weekDatesMap.get(weekNumber) || [];
    const dayIndex = weekDates.indexOf(date);
    if (dayIndex >= 0) {
      return dayIndex + 1;
    }
  }

  // 기본 계산: 기간 기준 단순 계산
  const start = new Date(periodStart);
  const current = new Date(date);
  start.setHours(0, 0, 0, 0);
  current.setHours(0, 0, 0, 0);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return (diffDays % 7) + 1;
}

// ============================================
// 플랜 번호 계산
// ============================================

/**
 * 플랜 키를 생성합니다.
 */
export function createPlanKey(
  date: string,
  contentId: string,
  startPageOrTime: number,
  endPageOrTime: number
): string {
  return `${date}:${contentId}:${startPageOrTime}:${endPageOrTime}`;
}

/**
 * 플랜 번호를 할당합니다.
 */
export function assignPlanNumber(
  planKey: string,
  planNumberMap: PlanNumberMap,
  nextPlanNumber: { value: number }
): number {
  if (planNumberMap.has(planKey)) {
    return planNumberMap.get(planKey)!;
  }

  const planNumber = nextPlanNumber.value;
  planNumberMap.set(planKey, planNumber);
  nextPlanNumber.value++;
  return planNumber;
}

// ============================================
// 시간 세그먼트 처리
// ============================================

/**
 * 날짜별로 플랜을 그룹화합니다.
 */
export function groupPlansByDate(
  scheduledPlans: ScheduledPlan[]
): Map<string, ScheduledPlan[]> {
  const plansByDate = new Map<string, ScheduledPlan[]>();
  scheduledPlans.forEach((plan) => {
    if (!plansByDate.has(plan.plan_date)) {
      plansByDate.set(plan.plan_date, []);
    }
    plansByDate.get(plan.plan_date)!.push(plan);
  });
  return plansByDate;
}

/**
 * 날짜별 플랜을 시간 세그먼트로 변환합니다.
 */
export function processDatePlans(
  date: string,
  datePlans: ScheduledPlan[],
  contentIdMap: ContentIdMap,
  context: DateProcessingContext,
  contentDurationMap: ContentDurationMap
): TimeSegmentResult[] {
  // 플랜 준비 (마스터 콘텐츠 ID를 학생 콘텐츠 ID로 변환)
  const plansForAssign = datePlans.map((plan) => {
    const finalContentId =
      contentIdMap.get(plan.content_id) || plan.content_id;
    return {
      content_id: finalContentId,
      content_type: plan.content_type,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      chapter: plan.chapter || null,
      block_index: plan.block_index,
    };
  });

  // assignPlanTimes 호출하여 시간 세그먼트 계산
  const dayType = context.dateMetadata.day_type || "학습일";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const durationMap = contentDurationMap as Map<string, any>;
  const segments = assignPlanTimes(
    plansForAssign,
    context.studyTimeSlots,
    durationMap,
    dayType,
    context.totalStudyHours
  );
  
  // 반환 타입 변환
  return segments.map((seg): TimeSegmentResult => ({
    plan: {
      content_id: seg.plan.content_id,
      content_type: seg.plan.content_type as "book" | "lecture" | "custom",
      planned_start_page_or_time: seg.plan.planned_start_page_or_time,
      planned_end_page_or_time: seg.plan.planned_end_page_or_time,
      chapter: seg.plan.chapter || null,
      block_index: seg.plan.block_index,
    },
    start: seg.start,
    end: seg.end,
    isPartial: seg.isPartial,
    isContinued: seg.isContinued,
    originalEstimatedTime: seg.originalEstimatedTime,
  }));
}

// ============================================
// 미리보기 플랜 생성
// ============================================

/**
 * 미리보기 플랜 페이로드를 생성합니다.
 */
export function createPreviewPlanPayload(
  date: string,
  blockIndex: number,
  segment: TimeSegmentResult,
  originalContentId: string,
  contentMetadataMap: ContentMetadataMap,
  dateMetadata: { day_type: DayType; week_number: number | null },
  weekDay: number | null,
  planNumber: number
): PreviewPlanPayload {
  const metadata = contentMetadataMap.get(originalContentId) || {};

  return {
    plan_date: date,
    block_index: blockIndex,
    content_type: segment.plan.content_type,
    content_id: segment.plan.content_id,
    content_title: metadata.title || null,
    content_subject: metadata.subject || null,
    content_subject_category: metadata.subject_category || null,
    content_category: metadata.category || null,
    planned_start_page_or_time: segment.plan.planned_start_page_or_time,
    planned_end_page_or_time: segment.plan.planned_end_page_or_time,
    chapter: segment.plan.chapter || null,
    start_time: segment.start,
    end_time: segment.end,
    day_type: dateMetadata.day_type,
    week: dateMetadata.week_number,
    day: weekDay,
    is_partial: segment.isPartial,
    is_continued: segment.isContinued,
    plan_number: planNumber,
  };
}

// ============================================
// 생성 플랜 페이로드
// ============================================

/**
 * 생성 플랜 페이로드를 생성합니다.
 */
export function createGeneratePlanPayload(
  tenantId: string,
  studentId: string,
  groupId: string,
  date: string,
  blockIndex: number,
  segment: TimeSegmentResult,
  originalContentId: string,
  originalPlan: ScheduledPlan | undefined,
  contentMetadataMap: ContentMetadataMap,
  dateMetadata: { day_type: DayType; week_number: number | null },
  weekDay: number | null,
  planNumber: number
): GeneratePlanPayload {
  const metadata = contentMetadataMap.get(originalContentId) || {};

  return {
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: groupId,
    plan_date: date,
    block_index: blockIndex,
    content_type: segment.plan.content_type,
    content_id: segment.plan.content_id,
    chapter: segment.plan.chapter || null,
    planned_start_page_or_time: segment.plan.planned_start_page_or_time,
    planned_end_page_or_time: segment.plan.planned_end_page_or_time,
    is_reschedulable: originalPlan?.is_reschedulable ?? true,
    // Denormalized 필드
    content_title: metadata.title || null,
    content_subject: metadata.subject || null,
    content_subject_category: metadata.subject_category || null,
    content_category: metadata.category || null,
    // 시간 정보
    start_time: segment.start,
    end_time: segment.end,
    // 날짜 유형 및 주차 정보
    day_type: dateMetadata.day_type,
    week: dateMetadata.week_number,
    day: weekDay,
    // 상태뱃지 정보
    is_partial: segment.isPartial,
    is_continued: segment.isContinued,
    // 플랜 번호
    plan_number: planNumber,
    // 회차 (나중에 계산하여 업데이트)
    sequence: null,
    // 전략/취약 정보
    subject_type: originalPlan?.subject_type || null,
  };
}

// ============================================
// 블록 인덱스 관리
// ============================================

/**
 * 사용 가능한 다음 블록 인덱스를 찾습니다.
 */
export function findNextAvailableBlockIndex(
  usedIndices: Set<number>,
  currentIndex: number
): number {
  let nextIndex = currentIndex;
  while (usedIndices.has(nextIndex)) {
    nextIndex++;
  }
  return nextIndex;
}

/**
 * 블록 인덱스를 사용된 것으로 등록합니다.
 */
export function markBlockIndexAsUsed(
  usedBlockIndicesByDate: UsedBlockIndicesByDateMap,
  date: string,
  blockIndex: number
): void {
  if (!usedBlockIndicesByDate.has(date)) {
    usedBlockIndicesByDate.set(date, new Set());
  }
  usedBlockIndicesByDate.get(date)!.add(blockIndex);
}

// ============================================
// 원본 콘텐츠 ID 찾기
// ============================================

/**
 * 세그먼트에 해당하는 원본 콘텐츠 ID를 찾습니다.
 */
export function findOriginalContentId(
  segment: TimeSegmentResult,
  datePlans: ScheduledPlan[],
  contentIdMap: ContentIdMap
): string {
  const found = datePlans.find(
    (p) =>
      p.content_id === segment.plan.content_id ||
      contentIdMap.get(p.content_id) === segment.plan.content_id
  );
  return found?.content_id || segment.plan.content_id;
}

/**
 * 원본 플랜을 찾습니다.
 */
export function findOriginalPlan(
  segment: TimeSegmentResult,
  datePlans: ScheduledPlan[],
  contentIdMap: ContentIdMap
): ScheduledPlan | undefined {
  return datePlans.find(
    (p) =>
      p.content_id === segment.plan.content_id ||
      contentIdMap.get(p.content_id) === segment.plan.content_id
  );
}
