/**
 * Virtual Schedule Preview V2
 *
 * 1730 플랜 로직을 반영한 가상 타임라인 미리보기 계산
 *
 * 핵심 개선:
 * - 취약과목: 모든 학습일에 배정 (매일 꾸준히)
 * - 전략과목: 주당 N일만 배정 (집중 학습)
 * - 복습일: 해당 주기의 학습 내용 복습
 * - 시간 계산: 타입/난이도/학생수준 반영
 */

import type { ContentSlot, SlotType } from "@/lib/types/content-selection";
import type { StudyReviewCycle, DailyScheduleInfo } from "@/lib/types/plan";

/**
 * 제외일 (간소화된 타입 - 위저드에서 사용)
 * calculateStudyReviewCycle은 exclusion_date만 필요
 */
export interface SimpleExclusion {
  exclusion_date: string;
  exclusion_type?: string;
  reason?: string;
}
import {
  calculateStudyReviewCycle,
  calculateSubjectAllocationDates,
  type CycleDayInfo,
  type SubjectAllocation,
  type StudentLevel,
} from "./1730TimetableLogic";
import {
  groupLinkedSlots,
  checkExclusiveConstraints,
  addMinutesToTime,
  SLOT_TYPE_DEFAULT_DURATION,
} from "./virtualSchedulePreview";

// ============================================================
// 타입 정의
// ============================================================

/**
 * V2 타임라인 옵션
 */
export interface VirtualTimelineOptionsV2 {
  /** 학습-복습 주기 설정 */
  studyReviewCycle: StudyReviewCycle;

  /** 기간 (시작일~종료일) */
  periodStart: string;
  periodEnd: string;

  /** 제외일 목록 */
  exclusions?: SimpleExclusion[];

  /** 학생 수준 */
  studentLevel?: StudentLevel;

  /** 블록 시간 (분) - 레거시 호환용 */
  blockDuration?: number;

  /** 일별 가용 시간 (시간) */
  dailyStudyHours?: number;

  /** Step 3에서 계산된 일별 스케줄 (time_slots 포함) */
  dailySchedule?: DailyScheduleInfo[];
}

/**
 * V2 플랜 아이템
 */
export interface VirtualPlanItemV2 {
  // 기존 필드
  slot_index: number;
  slot_type: SlotType | null;
  subject_category: string;
  title?: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  range_start?: number;
  range_end?: number;

  // 주기 정보 (신규)
  cycle_number: number;
  cycle_day_number: number;
  day_type: "study" | "review";

  // 과목 배분 정보 (신규)
  subject_type: "strategy" | "weakness" | null;
  allocation_reason?: string;

  // 관계 정보 (기존)
  linked_to_slot_index?: number;
  link_type?: "after" | "before";
  exclusive_with_indices?: number[];
  linked_group_id?: number;

  // 추정 범위 정보 (신규)
  /** 범위가 추정된 것인지 여부 */
  isEstimatedRange?: boolean;
  /** 추정 근거 설명 */
  estimationReason?: string;
  /** 추정된 일일 학습량 */
  dailyAmount?: number;

  // 일별 분배 정보 (신규)
  /** 전체 범위 중 몇 번째 분할인지 (1-based) */
  sequence?: number;
  /** 전체 분할 수 */
  total_sequences?: number;

  // 시간 슬롯 관련 (신규)
  /** 경고 메시지 (시간 부족 등) */
  warning?: string;
  /** 시간 슬롯 내에서 배치되었는지 여부 */
  withinTimeSlot?: boolean;
}

/**
 * 교과별 시간 분배
 */
export interface SubjectTimeDistributionV2 {
  subject_category: string;
  subject_type: "strategy" | "weakness" | null;
  total_minutes: number;
  study_minutes: number;
  review_minutes: number;
  percentage: number;
  study_day_count: number;
  weekly_days?: number;
}

/**
 * 주기별 요약
 */
export interface CycleSummaryV2 {
  cycle_number: number;
  study_day_count: number;
  review_day_count: number;
  total_study_minutes: number;
  total_review_minutes: number;
  subjects: string[];
}

/**
 * V2 타임라인 결과
 */
export interface VirtualTimelineResultV2 {
  /** 일별 계획 목록 */
  plans: VirtualPlanItemV2[];

  /** 교과별 시간 분배 */
  subjectDistribution: SubjectTimeDistributionV2[];

  /** 주기별 요약 */
  cycleSummaries: CycleSummaryV2[];

  /** 총 학습 시간 (분) */
  totalStudyMinutes: number;

  /** 총 복습 시간 (분) */
  totalReviewMinutes: number;

  /** 총 콘텐츠 수 */
  totalContents: number;

  /** 주기 정보 */
  cycleInfo: {
    totalCycles: number;
    studyDaysPerCycle: number;
    reviewDaysPerCycle: number;
  };

  /** 경고 메시지 */
  warnings: string[];
}

/**
 * 슬롯 날짜 배정 정보
 */
interface SlotDateAllocation {
  slot: ContentSlot;
  dates: string[];
  type: "strategy" | "weakness";
}

// ============================================================
// 상수
// ============================================================

const DEFAULT_DAILY_STUDY_HOURS = 4;
const REVIEW_TIME_FACTOR = 0.5; // 복습 시간 = 학습 시간 × 0.5

// 슬롯 타입별 기본 단위당 시간 (분)
const SLOT_TYPE_TIME_PER_UNIT = {
  book: 2,      // 페이지당 2분
  lecture: 30,  // 회차당 30분
  custom: 5,    // 단위당 5분
  self_study: 1,
  test: 1,
} as const;

// 슬롯 타입별 최소/최대 범위
const SLOT_TYPE_RANGE_LIMITS = {
  book: { min: 20, max: 500 },     // 20~500 페이지
  lecture: { min: 5, max: 100 },   // 5~100 회차
  custom: { min: 1, max: 50 },
  self_study: { min: 1, max: 1 },
  test: { min: 1, max: 1 },
} as const;

// ============================================================
// 미연결 슬롯 추천 범위 계산
// ============================================================

/**
 * 미연결 슬롯 추천 범위 옵션
 */
export interface EstimateSlotRangeOptions {
  /** 배정된 학습일 수 */
  studyDaysCount: number;
  /** 일일 학습 시간 (분) */
  dailyStudyMinutes: number;
  /** 해당 날짜의 슬롯 수 (시간 분배용) */
  slotsPerDay: number;
  /** 학생 수준 */
  studentLevel?: StudentLevel;
}

/**
 * 추천 범위 결과
 */
export interface EstimatedRange {
  start: number;
  end: number;
  /** 추정 여부 (true: 추정값, false: 실제값) */
  isEstimated: boolean;
  /** 추정 근거 설명 */
  estimationReason?: string;
  /** 추정된 일일 학습량 */
  dailyAmount?: number;
}

/**
 * 미연결 슬롯의 추천 범위 계산
 *
 * 계산 로직:
 * 1. 일일 슬롯당 가용 시간 = 일일 학습 시간 / 슬롯 수
 * 2. 단위당 학습 시간 = 슬롯 타입별 (교재: 2분/페이지, 강의: 30분/회차)
 * 3. 일일 학습량 = 슬롯당 가용 시간 / 단위당 시간
 * 4. 전체 범위 = 일일 학습량 × 학습일 수
 *
 * @param slot - 범위를 추정할 슬롯
 * @param options - 추정 옵션
 * @returns 추정된 범위
 */
export function estimateSlotRange(
  slot: ContentSlot,
  options: EstimateSlotRangeOptions
): EstimatedRange {
  const { studyDaysCount, dailyStudyMinutes, slotsPerDay, studentLevel = "medium" } = options;

  // 이미 범위가 설정된 경우 그대로 반환
  if (slot.start_range !== undefined && slot.end_range !== undefined) {
    return {
      start: slot.start_range,
      end: slot.end_range,
      isEstimated: false,
    };
  }

  // 슬롯 타입이 없거나 자습/테스트인 경우
  if (!slot.slot_type || slot.slot_type === "self_study" || slot.slot_type === "test") {
    return {
      start: 1,
      end: 1,
      isEstimated: true,
      estimationReason: "범위 설정이 필요하지 않은 슬롯 타입",
    };
  }

  // 학생 수준 보정 계수
  const levelFactors: Record<StudentLevel, number> = {
    high: 1.2,   // 상위: 20% 더 많이
    medium: 1.0, // 중위: 기준
    low: 0.8,    // 하위: 20% 적게
  };
  const levelFactor = levelFactors[studentLevel];

  // 유효한 슬롯 수 확인 (최소 1)
  const effectiveSlotsPerDay = Math.max(1, slotsPerDay);

  // 슬롯당 일일 할당 시간 (분)
  const minutesPerSlotPerDay = dailyStudyMinutes / effectiveSlotsPerDay;

  // 슬롯 타입별 단위당 시간
  const timePerUnit = SLOT_TYPE_TIME_PER_UNIT[slot.slot_type] || 5;

  // 일일 학습량 계산
  let dailyAmount = Math.floor((minutesPerSlotPerDay / timePerUnit) * levelFactor);

  // 최소값 보장
  dailyAmount = Math.max(1, dailyAmount);

  // 전체 범위 계산
  const totalRange = dailyAmount * studyDaysCount;

  // 범위 제한 적용
  const limits = SLOT_TYPE_RANGE_LIMITS[slot.slot_type] || { min: 1, max: 100 };
  const constrainedEnd = Math.min(Math.max(totalRange, limits.min), limits.max);

  // 단위 표시
  const unit = slot.slot_type === "book" ? "페이지" : "회차";

  return {
    start: 1,
    end: constrainedEnd,
    isEstimated: true,
    estimationReason: `${studyDaysCount}일 × ${dailyAmount}${unit}/일 = ${constrainedEnd}${unit}`,
    dailyAmount,
  };
}

/**
 * 여러 슬롯의 추천 범위 일괄 계산
 *
 * @param slots - 슬롯 배열
 * @param options - 추정 옵션 (slotsPerDay는 자동 계산됨)
 * @returns 슬롯 인덱스 → 추정 범위 맵
 */
export function estimateAllSlotRanges(
  slots: ContentSlot[],
  options: Omit<EstimateSlotRangeOptions, "slotsPerDay">
): Map<number, EstimatedRange> {
  const result = new Map<number, EstimatedRange>();

  // 콘텐츠가 필요한 슬롯만 필터 (자습/테스트 제외)
  const contentSlots = slots.filter(
    (s) => s.slot_type && s.slot_type !== "self_study" && s.slot_type !== "test"
  );

  const slotsPerDay = contentSlots.length || 1;

  for (const slot of slots) {
    const estimatedRange = estimateSlotRange(slot, {
      ...options,
      slotsPerDay,
    });
    result.set(slot.slot_index, estimatedRange);
  }

  return result;
}

/**
 * 슬롯에 추정 범위 적용
 *
 * 미연결 슬롯의 범위를 추정값으로 채워서 반환
 *
 * @param slots - 원본 슬롯 배열
 * @param estimatedRanges - 추정 범위 맵
 * @returns 범위가 적용된 슬롯 배열 (원본 수정 안 함)
 */
export function applySlotsWithEstimatedRanges(
  slots: ContentSlot[],
  estimatedRanges: Map<number, EstimatedRange>
): ContentSlot[] {
  return slots.map((slot) => {
    const estimated = estimatedRanges.get(slot.slot_index);

    // 이미 범위가 있거나 추정값이 없으면 그대로
    if (
      (slot.start_range !== undefined && slot.end_range !== undefined) ||
      !estimated ||
      !estimated.isEstimated
    ) {
      return slot;
    }

    // 추정 범위 적용
    return {
      ...slot,
      start_range: estimated.start,
      end_range: estimated.end,
      // 추정 범위임을 표시하는 메타데이터 (선택적)
      _estimatedRange: true,
    } as ContentSlot & { _estimatedRange?: boolean };
  });
}

// ============================================================
// 시간 슬롯 배치 (Step 3 연동)
// ============================================================

/**
 * 시간 문자열을 분 단위로 변환
 * @param time "HH:mm" 형식
 * @returns 분 단위 (0시 기준)
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * 분 단위를 시간 문자열로 변환
 * @param minutes 분 단위 (0시 기준)
 * @returns "HH:mm" 형식
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * 시간 슬롯 타입 (DailyScheduleInfo.time_slots의 요소)
 */
type TimeSlotInfo = NonNullable<DailyScheduleInfo["time_slots"]>[number];

/**
 * Step 3에서 계산된 time_slots를 활용하여 플랜 배치
 *
 * 학습시간 슬롯 내에서만 플랜을 배치하고, 시간이 부족하면 경고 추가
 *
 * @param plansForDate 해당 날짜의 플랜 목록
 * @param timeSlots 해당 날짜의 시간 슬롯 목록
 * @returns 시간이 조정된 플랜 목록
 */
export function placePlansWithinTimeSlots(
  plansForDate: VirtualPlanItemV2[],
  timeSlots: TimeSlotInfo[]
): VirtualPlanItemV2[] {
  // 학습시간 슬롯만 추출
  const studySlots = timeSlots.filter((s) => s.type === "학습시간");

  if (studySlots.length === 0) {
    // 시간 슬롯이 없으면 기본 시간(09:00)부터 오버플로우 배치
    let currentTimeMinutes = timeToMinutes("09:00");
    return plansForDate.map((p) => {
      const startTime = minutesToTime(currentTimeMinutes);
      const endTime = minutesToTime(currentTimeMinutes + p.duration_minutes);
      currentTimeMinutes += p.duration_minutes;
      return {
        ...p,
        start_time: startTime,
        end_time: endTime,
        warning: "해당 날짜에 학습 가능 시간이 없습니다",
        withinTimeSlot: false,
      };
    });
  }

  const result: VirtualPlanItemV2[] = [];
  let slotIndex = 0;
  let currentTimeMinutes = timeToMinutes(studySlots[0].start);
  // 마지막 슬롯의 종료 시간 (오버플로우 시 이 시간 이후로 계속 배치)
  const lastSlotEnd = timeToMinutes(studySlots[studySlots.length - 1].end);
  let isOverflow = false;
  let overflowTimeMinutes = lastSlotEnd;

  for (const plan of plansForDate) {
    // 시간 슬롯이 모두 사용된 경우 - 오버플로우 모드로 계속 배치
    if (slotIndex >= studySlots.length || isOverflow) {
      const startTime = minutesToTime(overflowTimeMinutes);
      const endTime = minutesToTime(overflowTimeMinutes + plan.duration_minutes);
      result.push({
        ...plan,
        start_time: startTime,
        end_time: endTime,
        warning: "가용 시간 초과 (오버플로우)",
        withinTimeSlot: false,
      });
      overflowTimeMinutes += plan.duration_minutes;
      isOverflow = true;
      continue;
    }

    // 현재 슬롯에 안 들어가면 다음 슬롯으로
    let currentSlot = studySlots[slotIndex];
    let slotEndMinutes = timeToMinutes(currentSlot.end);

    while (currentTimeMinutes + plan.duration_minutes > slotEndMinutes) {
      slotIndex++;
      if (slotIndex >= studySlots.length) {
        // 가용 시간 초과 - 오버플로우 모드로 전환
        isOverflow = true;
        overflowTimeMinutes = lastSlotEnd;
        break;
      }
      // 새 슬롯으로 이동 시 시간 정보 업데이트
      currentSlot = studySlots[slotIndex];
      slotEndMinutes = timeToMinutes(currentSlot.end);
      currentTimeMinutes = timeToMinutes(currentSlot.start);
    }

    // 오버플로우 모드면 오버플로우 시간으로 배치
    if (isOverflow) {
      const startTime = minutesToTime(overflowTimeMinutes);
      const endTime = minutesToTime(overflowTimeMinutes + plan.duration_minutes);
      result.push({
        ...plan,
        start_time: startTime,
        end_time: endTime,
        warning: "시간 부족 (오버플로우)",
        withinTimeSlot: false,
      });
      overflowTimeMinutes += plan.duration_minutes;
      continue;
    }

    // 시간 슬롯 내에서 배치
    result.push({
      ...plan,
      start_time: minutesToTime(currentTimeMinutes),
      end_time: minutesToTime(currentTimeMinutes + plan.duration_minutes),
      withinTimeSlot: true,
    });

    currentTimeMinutes += plan.duration_minutes;

    // 현재 슬롯 종료 시간 도달 시 다음 슬롯으로
    if (currentTimeMinutes >= slotEndMinutes && slotIndex < studySlots.length - 1) {
      slotIndex++;
      currentTimeMinutes = timeToMinutes(studySlots[slotIndex].start);
    }
  }

  return result;
}

/**
 * 날짜별로 time_slots를 적용하여 플랜 시간 조정
 *
 * @param plans 전체 플랜 목록
 * @param dailySchedule Step 3에서 계산된 일별 스케줄
 * @returns 시간이 조정된 플랜 목록
 */
export function applyTimeSlotsToPlans(
  plans: VirtualPlanItemV2[],
  dailySchedule: DailyScheduleInfo[]
): VirtualPlanItemV2[] {
  if (!dailySchedule || dailySchedule.length === 0) {
    return plans; // dailySchedule이 없으면 원본 반환
  }

  // 날짜별 플랜 그룹화
  const plansByDate = new Map<string, VirtualPlanItemV2[]>();
  for (const plan of plans) {
    if (!plansByDate.has(plan.date)) {
      plansByDate.set(plan.date, []);
    }
    plansByDate.get(plan.date)!.push(plan);
  }

  // 날짜별 스케줄 맵
  const scheduleByDate = new Map<string, DailyScheduleInfo>();
  for (const schedule of dailySchedule) {
    scheduleByDate.set(schedule.date, schedule);
  }

  // 각 날짜별로 time_slots 적용
  const result: VirtualPlanItemV2[] = [];
  for (const [date, datePlans] of plansByDate.entries()) {
    const schedule = scheduleByDate.get(date);
    const timeSlots = schedule?.time_slots ?? [];

    if (timeSlots.length > 0) {
      // time_slots가 있으면 적용
      const adjustedPlans = placePlansWithinTimeSlots(datePlans, timeSlots);
      result.push(...adjustedPlans);
    } else {
      // time_slots가 없으면 원본 유지
      result.push(...datePlans);
    }
  }

  // 날짜 및 시간 순 정렬
  return result.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start_time.localeCompare(b.start_time);
  });
}

// ============================================================
// 학습 범위 일별 분배
// ============================================================

/**
 * 일별 범위 할당 정보
 */
export interface DailyRangeAllocation {
  date: string;
  range_start: number;
  range_end: number;
  duration_minutes: number;
  /** 전체 범위 중 몇 번째 분할인지 (1-based) */
  sequence: number;
  /** 전체 분할 수 */
  total_sequences: number;
}

/**
 * 슬롯의 범위를 배정된 날짜에 분배
 *
 * 핵심: 전체 학습일이 아닌, 해당 슬롯이 배정된 날짜 수 기준으로 분배
 *
 * 예시:
 * - 취약과목 100페이지, 20일 배정 → 5페이지/일
 * - 전략과목 100페이지, 12일 배정 (주3일) → 약 8페이지/일
 *
 * @param slot - 범위를 분배할 슬롯
 * @param allocatedDates - 해당 슬롯이 배정된 날짜 목록
 * @param studentLevel - 학생 수준 (시간 계산에 사용)
 * @returns 날짜별 범위 할당 목록
 */
export function divideRangeAcrossAllocatedDates(
  slot: ContentSlot,
  allocatedDates: string[],
  studentLevel: StudentLevel = "medium"
): DailyRangeAllocation[] {
  // 범위가 없거나 배정 날짜가 없으면 빈 배열
  if (
    slot.start_range === undefined ||
    slot.end_range === undefined ||
    allocatedDates.length === 0
  ) {
    return [];
  }

  const totalRange = slot.end_range - slot.start_range + 1;

  // 학생 수준별 시간 계수
  const levelFactors: Record<StudentLevel, number> = {
    high: 0.8,
    medium: 1.0,
    low: 1.2,
  };
  const levelFactor = levelFactors[studentLevel];

  // 일일 최소 분량 계산 (슬롯 타입별)
  let minDailyAmount: number;
  if (slot.slot_type === "book") {
    minDailyAmount = 5; // 교재: 최소 5페이지/일
  } else if (slot.slot_type === "lecture") {
    minDailyAmount = 1; // 강의: 최소 1회/일
  } else {
    minDailyAmount = 1; // 기타: 최소 1단위/일
  }

  // 실제 필요한 날짜 수 계산 (최소 분량 기준)
  const actualDaysNeeded = Math.ceil(totalRange / minDailyAmount);
  // 실제 사용할 날짜 수 (배정된 날짜와 필요한 날짜 중 작은 값)
  const daysToUse = Math.min(allocatedDates.length, actualDaysNeeded);

  // 사용할 날짜만 추출
  const datesToUse = allocatedDates.slice(0, daysToUse);

  // 일일 분량 재계산
  const dailyRange = totalRange / daysToUse;

  const allocations: DailyRangeAllocation[] = [];
  let currentStart = slot.start_range;

  for (let i = 0; i < datesToUse.length; i++) {
    const date = datesToUse[i];
    const isLast = i === datesToUse.length - 1;

    // 마지막 날짜는 나머지 전부 할당
    const rangeSize = isLast
      ? slot.end_range - currentStart + 1
      : Math.max(1, Math.round(dailyRange));

    const currentEnd = Math.min(currentStart + rangeSize - 1, slot.end_range);

    // 시간 계산 (슬롯 타입별)
    let duration: number;
    if (slot.slot_type === "book") {
      duration = Math.round(rangeSize * 2 * levelFactor); // 페이지당 2분
    } else if (slot.slot_type === "lecture") {
      duration = Math.round(rangeSize * 30 * levelFactor); // 회차당 30분
    } else {
      duration = Math.round(rangeSize * 5 * levelFactor); // 기타: 단위당 5분
    }

    allocations.push({
      date,
      range_start: currentStart,
      range_end: currentEnd,
      duration_minutes: duration,
      sequence: i + 1,
      total_sequences: daysToUse, // 실제 사용된 날짜 수로 업데이트
    });

    currentStart = currentEnd + 1;

    // 범위를 초과하면 중단 (안전장치)
    if (currentStart > slot.end_range) break;
  }

  return allocations;
}

/**
 * 슬롯별 일별 범위 할당 맵 생성
 *
 * @param allocations - 슬롯별 배정 날짜 정보
 * @param studentLevel - 학생 수준
 * @returns 슬롯 인덱스 → (날짜 → 범위 할당) 맵
 */
export function createSlotDailyRangeMap(
  allocations: { slot: ContentSlot; dates: string[] }[],
  studentLevel: StudentLevel = "medium"
): Map<number, Map<string, DailyRangeAllocation>> {
  const result = new Map<number, Map<string, DailyRangeAllocation>>();

  for (const { slot, dates } of allocations) {
    const dailyAllocations = divideRangeAcrossAllocatedDates(slot, dates, studentLevel);
    const dateMap = new Map<string, DailyRangeAllocation>();

    for (const allocation of dailyAllocations) {
      dateMap.set(allocation.date, allocation);
    }

    result.set(slot.slot_index, dateMap);
  }

  return result;
}

// ============================================================
// 핵심 함수
// ============================================================

/**
 * 슬롯을 과목 유형별로 분류
 */
export function classifySlotsBySubjectType(slots: ContentSlot[]): {
  strategySlots: ContentSlot[];
  weaknessSlots: ContentSlot[];
} {
  const strategySlots: ContentSlot[] = [];
  const weaknessSlots: ContentSlot[] = [];

  for (const slot of slots) {
    if (slot.subject_type === "strategy") {
      strategySlots.push(slot);
    } else {
      // 미분류 또는 weakness는 취약과목으로 처리
      weaknessSlots.push(slot);
    }
  }

  return { strategySlots, weaknessSlots };
}

/**
 * 슬롯 소요 시간 계산
 */
export function calculateSlotDurationV2(
  slot: ContentSlot,
  studentLevel: StudentLevel = "medium",
  isReview: boolean = false
): number {
  // 기본 시간 (슬롯 타입별)
  const baseTime = slot.slot_type
    ? SLOT_TYPE_DEFAULT_DURATION[slot.slot_type] || 90
    : 90;

  // 학생 수준 계수
  const levelFactors: Record<StudentLevel, number> = {
    high: 0.8,
    medium: 1.0,
    low: 1.2,
  };
  const levelFactor = levelFactors[studentLevel];

  // 범위가 있으면 범위 기반 계산
  let duration = baseTime;
  if (slot.start_range !== undefined && slot.end_range !== undefined) {
    const range = slot.end_range - slot.start_range + 1;
    if (slot.slot_type === "book") {
      // 교재: 페이지당 2분
      duration = range * 2;
    } else if (slot.slot_type === "lecture") {
      // 강의: 회차당 30분
      duration = range * 30;
    }
  }

  // 학생 수준 반영
  duration = Math.round(duration * levelFactor);

  // 복습인 경우 50% 적용
  if (isReview) {
    duration = Math.round(duration * REVIEW_TIME_FACTOR);
  }

  return duration;
}

/**
 * 연속된 범위를 병합 (복습 효율성 향상)
 *
 * 같은 슬롯의 연속 학습 범위를 하나로 합쳐 복습 시 효율적으로 배치
 *
 * 예: [1-5p, 6-10p, 11-15p] → [1-15p]
 */
export function compressConsecutiveRanges(
  plans: VirtualPlanItemV2[]
): VirtualPlanItemV2[] {
  if (plans.length === 0) return [];

  // 날짜순 정렬 후 연속 범위 병합
  const sorted = [...plans].sort((a, b) => a.date.localeCompare(b.date));
  const result: VirtualPlanItemV2[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const plan = sorted[i];

    // 연속 범위면 병합 (range_end + 1 === next range_start)
    if (
      current.range_end !== undefined &&
      plan.range_start !== undefined &&
      plan.range_start === current.range_end + 1
    ) {
      // 범위 확장
      current.range_end = plan.range_end;
      // 시간 합산
      current.duration_minutes += plan.duration_minutes;
      // 마지막 sequence로 업데이트
      current.sequence = plan.sequence;
    } else {
      // 연속이 아니면 현재까지 결과에 추가하고 새로 시작
      result.push(current);
      current = { ...plan };
    }
  }
  // 마지막 항목 추가
  result.push(current);

  return result;
}

/**
 * 복습 계획 생성 V2 (콘텐츠별 그룹화 + 연속 범위 병합)
 *
 * 개선 사항:
 * 1. 콘텐츠(슬롯)별로 그룹화하여 연속 복습
 * 2. 연속된 학습 범위를 병합하여 효율적 복습
 * 3. 복습일 시간 균등 분배
 */
export function generateReviewPlansV2(
  cycleDays: CycleDayInfo[],
  studyPlans: VirtualPlanItemV2[],
  options: VirtualTimelineOptionsV2
): VirtualPlanItemV2[] {
  const reviewPlans: VirtualPlanItemV2[] = [];

  // 주기별로 복습일 추출
  const cycleReviewDays = new Map<number, CycleDayInfo[]>();
  for (const day of cycleDays) {
    if (day.day_type === "review") {
      if (!cycleReviewDays.has(day.cycle_number)) {
        cycleReviewDays.set(day.cycle_number, []);
      }
      cycleReviewDays.get(day.cycle_number)!.push(day);
    }
  }

  // 각 주기의 복습일에 해당 주기 학습 내용 복습 배정
  for (const [cycleNumber, reviewDays] of cycleReviewDays.entries()) {
    // 해당 주기의 학습 플랜 추출
    const cycleStudyPlans = studyPlans.filter(
      (p) => p.cycle_number === cycleNumber && p.day_type === "study"
    );

    if (cycleStudyPlans.length === 0 || reviewDays.length === 0) continue;

    // 콘텐츠(슬롯)별로 그룹화
    const plansBySlot = new Map<number, VirtualPlanItemV2[]>();
    for (const plan of cycleStudyPlans) {
      if (!plansBySlot.has(plan.slot_index)) {
        plansBySlot.set(plan.slot_index, []);
      }
      plansBySlot.get(plan.slot_index)!.push(plan);
    }

    // 각 슬롯의 연속 범위 압축
    const compressedBySlot = new Map<number, VirtualPlanItemV2[]>();
    for (const [slotIndex, slotPlans] of plansBySlot.entries()) {
      const compressed = compressConsecutiveRanges(slotPlans);
      compressedBySlot.set(slotIndex, compressed);
    }

    // 복습할 총 아이템 수 계산
    const allCompressedPlans: VirtualPlanItemV2[] = [];
    for (const plans of compressedBySlot.values()) {
      allCompressedPlans.push(...plans);
    }

    // 복습일당 플랜 수 계산
    const plansPerReviewDay = Math.ceil(
      allCompressedPlans.length / reviewDays.length
    );

    // 슬롯 순서대로 복습일에 배치
    let reviewDayIndex = 0;
    let currentTime = "09:00";
    let plansOnCurrentDay = 0;

    // 슬롯 인덱스 순서로 정렬하여 처리
    const sortedSlotIndices = [...compressedBySlot.keys()].sort((a, b) => a - b);

    for (const slotIndex of sortedSlotIndices) {
      const compressedPlans = compressedBySlot.get(slotIndex)!;

      for (const plan of compressedPlans) {
        // 현재 복습일이 꽉 찼으면 다음 복습일로
        if (plansOnCurrentDay >= plansPerReviewDay && reviewDayIndex < reviewDays.length - 1) {
          reviewDayIndex++;
          currentTime = "09:00";
          plansOnCurrentDay = 0;
        }

        // 복습일이 모두 사용되면 마지막 복습일에 계속 추가
        if (reviewDayIndex >= reviewDays.length) {
          reviewDayIndex = reviewDays.length - 1;
        }

        const reviewDay = reviewDays[reviewDayIndex];
        const reviewDuration = Math.round(plan.duration_minutes * REVIEW_TIME_FACTOR);

        // 점심시간 체크 (12:00-13:00)
        if (currentTime >= "12:00" && currentTime < "13:00") {
          currentTime = "13:00";
        }

        // 일일 종료 시간 체크 (17:00 이후면 다음 복습일로)
        if (currentTime >= "17:00" && reviewDayIndex < reviewDays.length - 1) {
          reviewDayIndex++;
          currentTime = "09:00";
          plansOnCurrentDay = 0;
        }

        const actualReviewDay = reviewDays[Math.min(reviewDayIndex, reviewDays.length - 1)];

        // 범위 표시 텍스트 생성
        let rangeText = "";
        if (plan.range_start !== undefined && plan.range_end !== undefined) {
          const unit = plan.slot_type === "book" ? "p" : "회";
          if (plan.range_start === plan.range_end) {
            rangeText = ` (${plan.range_start}${unit})`;
          } else {
            rangeText = ` (${plan.range_start}-${plan.range_end}${unit})`;
          }
        }

        reviewPlans.push({
          slot_index: plan.slot_index,
          slot_type: plan.slot_type,
          subject_category: plan.subject_category,
          title: plan.title ? `${plan.title} 복습${rangeText}` : `복습${rangeText}`,
          date: actualReviewDay.date,
          start_time: currentTime,
          end_time: addMinutesToTime(currentTime, reviewDuration),
          duration_minutes: reviewDuration,
          range_start: plan.range_start,
          range_end: plan.range_end,
          cycle_number: cycleNumber,
          cycle_day_number: actualReviewDay.cycle_day_number,
          day_type: "review",
          subject_type: plan.subject_type,
          allocation_reason: "복습",
          // 추정 범위 정보 (학습 플랜에서 상속)
          isEstimatedRange: plan.isEstimatedRange,
          estimationReason: plan.estimationReason,
          dailyAmount: plan.dailyAmount,
        });

        currentTime = addMinutesToTime(currentTime, reviewDuration);
        plansOnCurrentDay++;
      }
    }
  }

  return reviewPlans;
}

/**
 * 복습 계획 생성 (레거시 - 하위 호환성 유지)
 * @deprecated generateReviewPlansV2 사용 권장
 */
export function generateReviewPlans(
  cycleDays: CycleDayInfo[],
  studyPlans: VirtualPlanItemV2[],
  options: VirtualTimelineOptionsV2
): VirtualPlanItemV2[] {
  // V2 로직 사용
  return generateReviewPlansV2(cycleDays, studyPlans, options);
}

/**
 * 교과별 시간 분배 계산
 */
export function calculateSubjectDistributionV2(
  plans: VirtualPlanItemV2[]
): SubjectTimeDistributionV2[] {
  const distribution = new Map<
    string,
    {
      subject_type: "strategy" | "weakness" | null;
      study_minutes: number;
      review_minutes: number;
      study_days: Set<string>;
      weekly_days?: number;
    }
  >();

  for (const plan of plans) {
    const key = plan.subject_category;
    if (!distribution.has(key)) {
      distribution.set(key, {
        subject_type: plan.subject_type,
        study_minutes: 0,
        review_minutes: 0,
        study_days: new Set(),
        weekly_days: undefined,
      });
    }

    const entry = distribution.get(key)!;
    if (plan.day_type === "study") {
      entry.study_minutes += plan.duration_minutes;
      entry.study_days.add(plan.date);
    } else {
      entry.review_minutes += plan.duration_minutes;
    }
  }

  const totalMinutes = plans.reduce((sum, p) => sum + p.duration_minutes, 0);

  return Array.from(distribution.entries()).map(([category, data]) => ({
    subject_category: category,
    subject_type: data.subject_type,
    total_minutes: data.study_minutes + data.review_minutes,
    study_minutes: data.study_minutes,
    review_minutes: data.review_minutes,
    percentage:
      totalMinutes > 0
        ? Math.round(
            ((data.study_minutes + data.review_minutes) / totalMinutes) * 100
          )
        : 0,
    study_day_count: data.study_days.size,
    weekly_days: data.weekly_days,
  }));
}

/**
 * 주기별 요약 계산
 */
export function calculateCycleSummaries(
  plans: VirtualPlanItemV2[],
  cycleDays: CycleDayInfo[]
): CycleSummaryV2[] {
  const summaries = new Map<
    number,
    {
      study_day_count: number;
      review_day_count: number;
      study_minutes: number;
      review_minutes: number;
      subjects: Set<string>;
    }
  >();

  // 주기별 일자 수 계산
  for (const day of cycleDays) {
    if (!summaries.has(day.cycle_number)) {
      summaries.set(day.cycle_number, {
        study_day_count: 0,
        review_day_count: 0,
        study_minutes: 0,
        review_minutes: 0,
        subjects: new Set(),
      });
    }

    const entry = summaries.get(day.cycle_number)!;
    if (day.day_type === "study") {
      entry.study_day_count++;
    } else if (day.day_type === "review") {
      entry.review_day_count++;
    }
  }

  // 플랜별 시간 및 과목 집계
  for (const plan of plans) {
    const entry = summaries.get(plan.cycle_number);
    if (!entry) continue;

    entry.subjects.add(plan.subject_category);
    if (plan.day_type === "study") {
      entry.study_minutes += plan.duration_minutes;
    } else {
      entry.review_minutes += plan.duration_minutes;
    }
  }

  return Array.from(summaries.entries())
    .map(([cycleNumber, data]) => ({
      cycle_number: cycleNumber,
      study_day_count: data.study_day_count,
      review_day_count: data.review_day_count,
      total_study_minutes: data.study_minutes,
      total_review_minutes: data.review_minutes,
      subjects: Array.from(data.subjects),
    }))
    .sort((a, b) => a.cycle_number - b.cycle_number);
}

/**
 * V2 가상 타임라인 계산 (메인 함수)
 */
export function calculateVirtualTimelineV2(
  slots: ContentSlot[],
  options: VirtualTimelineOptionsV2
): VirtualTimelineResultV2 {
  const warnings: string[] = [];
  const dailyStudyHours = options.dailyStudyHours ?? DEFAULT_DAILY_STUDY_HOURS;

  // 1. 유효 슬롯 필터링
  const validSlots = slots.filter(
    (slot) => slot.slot_type && slot.subject_category
  );

  if (validSlots.length === 0) {
    return {
      plans: [],
      subjectDistribution: [],
      cycleSummaries: [],
      totalStudyMinutes: 0,
      totalReviewMinutes: 0,
      totalContents: 0,
      cycleInfo: {
        totalCycles: 0,
        studyDaysPerCycle: options.studyReviewCycle.study_days,
        reviewDaysPerCycle: options.studyReviewCycle.review_days,
      },
      warnings: ["유효한 슬롯이 없습니다."],
    };
  }

  // 2. 주기 일자 생성
  // SimpleExclusion을 PlanExclusion으로 캐스트 (calculateStudyReviewCycle은 exclusion_date만 사용)
  const exclusionsForCycle = (options.exclusions ?? []).map((e) => ({
    ...e,
    id: "",
    tenant_id: "",
    student_id: "",
    plan_group_id: null,
    created_at: "",
    reason: e.reason ?? null,
    exclusion_type: (e.exclusion_type as "휴가" | "개인사정" | "휴일지정" | "기타") ?? "기타",
  }));
  const cycleDays = calculateStudyReviewCycle(
    options.periodStart,
    options.periodEnd,
    options.studyReviewCycle,
    exclusionsForCycle
  );

  const studyDays = cycleDays.filter((d) => d.day_type === "study");
  const reviewDays = cycleDays.filter((d) => d.day_type === "review");

  if (studyDays.length === 0) {
    return {
      plans: [],
      subjectDistribution: [],
      cycleSummaries: [],
      totalStudyMinutes: 0,
      totalReviewMinutes: 0,
      totalContents: validSlots.length,
      cycleInfo: {
        totalCycles: 0,
        studyDaysPerCycle: options.studyReviewCycle.study_days,
        reviewDaysPerCycle: options.studyReviewCycle.review_days,
      },
      warnings: ["학습 가능한 날짜가 없습니다."],
    };
  }

  // 3. 슬롯 과목 분류
  const { strategySlots, weaknessSlots } =
    classifySlotsBySubjectType(validSlots);

  // 4. 과목별 배정 날짜 계산
  const allocations: SlotDateAllocation[] = [];

  // 4-1. 취약과목 배정 (모든 학습일에 배정)
  for (const slot of weaknessSlots) {
    const subjectId = slot.subject_id ?? slot.subject_category ?? "unknown";
    const subjectName = slot.subject_category ?? "미지정";
    const allocation: SubjectAllocation = {
      subject_id: subjectId,
      subject_name: subjectName,
      subject_type: "weakness",
    };

    const dates = calculateSubjectAllocationDates(cycleDays, allocation);
    allocations.push({ slot, dates, type: "weakness" });
  }

  // 4-2. 전략과목 배정 (주 N일만 배정)
  for (const slot of strategySlots) {
    const subjectId = slot.subject_id ?? slot.subject_category ?? "unknown";
    const subjectName = slot.subject_category ?? "미지정";
    const allocation: SubjectAllocation = {
      subject_id: subjectId,
      subject_name: subjectName,
      subject_type: "strategy",
      weekly_days: slot.weekly_days ?? 3,
    };

    const dates = calculateSubjectAllocationDates(cycleDays, allocation);
    allocations.push({ slot, dates, type: "strategy" });
  }

  // 4-3. 미연결 슬롯에 추정 범위 계산 및 적용
  const slotEstimatedRanges = new Map<number, EstimatedRange>();
  const dailyStudyMinutes = dailyStudyHours * 60;

  for (const allocation of allocations) {
    const slot = allocation.slot;

    // 이미 범위가 설정된 경우 스킵
    if (slot.start_range !== undefined && slot.end_range !== undefined) {
      continue;
    }

    // 추정 범위 계산
    const estimatedRange = estimateSlotRange(slot, {
      studyDaysCount: allocation.dates.length,
      dailyStudyMinutes,
      slotsPerDay: validSlots.length,
      studentLevel: options.studentLevel,
    });

    if (estimatedRange.isEstimated) {
      slotEstimatedRanges.set(slot.slot_index, estimatedRange);

      // 경고 메시지 추가
      warnings.push(
        `슬롯 ${slot.slot_index + 1} (${slot.subject_category}): 범위 자동 추정 - ${estimatedRange.estimationReason}`
      );
    }
  }

  // 4-4. 추정 범위가 적용된 슬롯으로 allocations 업데이트
  const allocationsWithRanges = allocations.map((alloc) => {
    const estimated = slotEstimatedRanges.get(alloc.slot.slot_index);
    if (estimated?.isEstimated) {
      return {
        ...alloc,
        slot: {
          ...alloc.slot,
          start_range: estimated.start,
          end_range: estimated.end,
        },
      };
    }
    return alloc;
  });

  // 4-5. 일별 범위 분배 맵 생성
  const slotDailyRangeMap = createSlotDailyRangeMap(
    allocationsWithRanges,
    options.studentLevel ?? "medium"
  );

  // 5. 학습 플랜 생성
  const studyPlans: VirtualPlanItemV2[] = [];
  const dateTimeTracker = new Map<string, string>(); // date -> current time
  const assignedSlots = new Map<string, string>(); // slotId -> date

  // 날짜별로 슬롯 그룹화 (추정 범위가 적용된 슬롯 사용)
  const dateSlotMap = new Map<string, { slot: ContentSlot; type: "strategy" | "weakness" }[]>();

  for (const allocation of allocationsWithRanges) {
    for (const date of allocation.dates) {
      if (!dateSlotMap.has(date)) {
        dateSlotMap.set(date, []);
      }
      dateSlotMap.get(date)!.push({
        slot: allocation.slot,
        type: allocation.type,
      });
    }
  }

  // 날짜별로 플랜 생성
  for (const [date, slotsForDate] of dateSlotMap.entries()) {
    const cycleDay = cycleDays.find((d) => d.date === date);
    if (!cycleDay || cycleDay.day_type !== "study") continue;

    let currentTime = dateTimeTracker.get(date) ?? "09:00";

    // 연계/배타 슬롯 처리를 위한 그룹화
    const slotObjects = slotsForDate.map((s) => s.slot);
    const linkedGroups = groupLinkedSlots(slotObjects);

    for (const group of linkedGroups) {
      for (const slot of group) {
        const slotInfo = slotsForDate.find((s) => s.slot === slot);
        if (!slotInfo) continue;

        const slotId = slot.id ?? `slot-${slot.slot_index}`;

        // 배타적 제약 조건 체크
        const exclusiveCheck = checkExclusiveConstraints(
          slot,
          date,
          assignedSlots,
          validSlots
        );

        if (!exclusiveCheck.canPlace) {
          warnings.push(
            `슬롯 ${slot.slot_index + 1}: ${date}에 배타적 슬롯과 충돌하여 건너뜀`
          );
          continue;
        }

        // 일별 범위 분배 정보 가져오기
        const slotDateMap = slotDailyRangeMap.get(slot.slot_index);
        const dailyAllocation = slotDateMap?.get(date);

        // 추정 범위 정보 가져오기
        const estimatedRange = slotEstimatedRanges.get(slot.slot_index);

        // 범위가 정의된 슬롯인데 일별 분배가 없으면 → 해당 날짜는 콘텐츠 완료됨
        // 이 경우 학습 플랜을 생성하지 않고 건너뜀
        const hasDefinedRange = slot.start_range !== undefined && slot.end_range !== undefined;
        if (hasDefinedRange && !dailyAllocation && !estimatedRange?.isEstimated) {
          // 콘텐츠가 이미 완료되어 해당 날짜에 할당할 범위 없음
          continue;
        }

        // 범위 결정: 일별 분배 > 추정 범위 > 기본값
        let rangeStart: number | undefined;
        let rangeEnd: number | undefined;
        let duration: number;

        if (dailyAllocation) {
          // 일별 분배된 범위 사용
          rangeStart = dailyAllocation.range_start;
          rangeEnd = dailyAllocation.range_end;
          duration = dailyAllocation.duration_minutes;
        } else if (estimatedRange?.isEstimated) {
          // 추정 범위 사용 (미연결 슬롯)
          rangeStart = estimatedRange.start;
          rangeEnd = estimatedRange.end;
          duration = calculateSlotDurationV2(
            slot,
            options.studentLevel ?? "medium",
            false
          );
        } else {
          // 범위 없는 슬롯 (자습, 테스트 등) - 기본 시간 사용
          rangeStart = undefined;
          rangeEnd = undefined;
          duration = calculateSlotDurationV2(
            slot,
            options.studentLevel ?? "medium",
            false
          );
        }

        // 점심시간 체크 (12:00-13:00)
        if (currentTime >= "12:00" && currentTime < "13:00") {
          currentTime = "13:00";
        }

        const endTime = addMinutesToTime(currentTime, duration);

        studyPlans.push({
          slot_index: slot.slot_index,
          slot_type: slot.slot_type,
          subject_category: slot.subject_category ?? "미지정",
          title: slot.title ?? undefined,
          date,
          start_time: currentTime,
          end_time: endTime,
          duration_minutes: duration,
          range_start: rangeStart,
          range_end: rangeEnd,
          cycle_number: cycleDay.cycle_number,
          cycle_day_number: cycleDay.cycle_day_number,
          day_type: "study",
          subject_type: slotInfo.type,
          allocation_reason:
            slotInfo.type === "strategy"
              ? `전략과목 주 ${slot.weekly_days ?? 3}일`
              : "취약과목 매일",
          linked_to_slot_index: slot.linked_slot_id
            ? validSlots.find((s) => s.id === slot.linked_slot_id)?.slot_index
            : undefined,
          link_type: slot.link_type ?? undefined,
          exclusive_with_indices: slot.exclusive_with
            ?.map((id: string) => validSlots.find((s) => s.id === id)?.slot_index)
            .filter((idx: number | undefined): idx is number => idx !== undefined),
          // 추정 범위 정보
          isEstimatedRange: estimatedRange?.isEstimated,
          estimationReason: estimatedRange?.estimationReason,
          dailyAmount: estimatedRange?.dailyAmount,
          // 일별 분배 정보
          sequence: dailyAllocation?.sequence,
          total_sequences: dailyAllocation?.total_sequences,
        });

        assignedSlots.set(slotId, date);
        currentTime = endTime;
      }
    }

    dateTimeTracker.set(date, currentTime);
  }

  // 6. 복습 플랜 생성
  const reviewPlans = generateReviewPlans(cycleDays, studyPlans, options);

  // 7. 전체 플랜 병합 및 정렬
  let allPlans = [...studyPlans, ...reviewPlans].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.start_time.localeCompare(b.start_time);
  });

  // 7-1. Step 3의 time_slots 적용 (dailySchedule이 있는 경우)
  if (options.dailySchedule && options.dailySchedule.length > 0) {
    allPlans = applyTimeSlotsToPlans(allPlans, options.dailySchedule);

    // 시간 부족 경고 집계
    const timeWarnings = allPlans.filter((p) => p.warning);
    if (timeWarnings.length > 0) {
      const warningDates = [...new Set(timeWarnings.map((p) => p.date))];
      warnings.push(
        `${warningDates.length}개 날짜에서 시간 부족으로 일부 플랜 배치 불가`
      );
    }
  }

  // 8. 통계 계산
  const subjectDistribution = calculateSubjectDistributionV2(allPlans);
  const cycleSummaries = calculateCycleSummaries(allPlans, cycleDays);

  const totalStudyMinutes = studyPlans.reduce(
    (sum, p) => sum + p.duration_minutes,
    0
  );
  const totalReviewMinutes = reviewPlans.reduce(
    (sum, p) => sum + p.duration_minutes,
    0
  );

  // 주기 수 계산
  const totalCycles = Math.max(...cycleDays.map((d) => d.cycle_number), 0);

  return {
    plans: allPlans,
    subjectDistribution,
    cycleSummaries,
    totalStudyMinutes,
    totalReviewMinutes,
    totalContents: validSlots.filter((s) => s.content_id).length,
    cycleInfo: {
      totalCycles,
      studyDaysPerCycle: options.studyReviewCycle.study_days,
      reviewDaysPerCycle: options.studyReviewCycle.review_days,
    },
    warnings,
  };
}

/**
 * 날짜별로 플랜 그룹화
 */
export function groupPlansByDateV2(
  result: VirtualTimelineResultV2
): Map<string, VirtualPlanItemV2[]> {
  const grouped = new Map<string, VirtualPlanItemV2[]>();

  for (const plan of result.plans) {
    if (!grouped.has(plan.date)) {
      grouped.set(plan.date, []);
    }
    grouped.get(plan.date)!.push(plan);
  }

  return grouped;
}

/**
 * 주기별로 플랜 그룹화
 */
export function groupPlansByCycleV2(
  result: VirtualTimelineResultV2
): Map<number, VirtualPlanItemV2[]> {
  const grouped = new Map<number, VirtualPlanItemV2[]>();

  for (const plan of result.plans) {
    if (!grouped.has(plan.cycle_number)) {
      grouped.set(plan.cycle_number, []);
    }
    grouped.get(plan.cycle_number)!.push(plan);
  }

  return grouped;
}

/**
 * 주차별로 플랜 그룹화
 * 주차 번호를 ISO 주차 기준으로 계산
 */
export function groupPlansByWeekV2(
  result: VirtualTimelineResultV2
): Map<string, VirtualPlanItemV2[]> {
  const grouped = new Map<string, VirtualPlanItemV2[]>();

  for (const plan of result.plans) {
    const date = new Date(plan.date);
    // ISO 주차 계산 (간단 버전: 년도-주차 형식)
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const days = Math.floor(
      (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000)
    );
    const weekNumber = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, "0")}`;

    if (!grouped.has(weekKey)) {
      grouped.set(weekKey, []);
    }
    grouped.get(weekKey)!.push(plan);
  }

  return grouped;
}
