/**
 * 가상 타임라인 미리보기 로직
 *
 * 2단계 콘텐츠 선택 시스템 v2.0
 * 슬롯 구성 시점에 가상 배치 미리보기를 제공합니다.
 */

import type { ContentSlot } from "@/lib/types/content-selection";
import { SCHEDULER_CONFIG } from "@/lib/config/schedulerConfig";

// ============================================================================
// 타입 정의
// ============================================================================

/**
 * 일별 스케줄 정보 (WizardData에서 가져옴)
 */
export type DailyScheduleInfo = {
  date: string;
  day_type: "학습일" | "복습일" | "지정휴일" | "휴가" | "개인일정";
  study_hours: number;
  week_number?: number;
};

/**
 * 가상 플랜 아이템
 */
export type VirtualPlanItem = {
  /** 슬롯 인덱스 */
  slot_index: number;
  /** 슬롯 타입 */
  slot_type: ContentSlot["slot_type"];
  /** 교과 */
  subject_category: string;
  /** 콘텐츠 제목 (있는 경우) */
  title?: string;
  /** 배정 날짜 */
  date: string;
  /** 시작 시간 (HH:MM) */
  start_time: string;
  /** 종료 시간 (HH:MM) */
  end_time: string;
  /** 소요 시간 (분) */
  duration_minutes: number;
  /** 배정 범위 시작 */
  range_start?: number;
  /** 배정 범위 종료 */
  range_end?: number;
  /** 주차 */
  week_number: number;
  /** 일 유형 */
  day_type: DailyScheduleInfo["day_type"];
};

/**
 * 가상 타임라인 결과
 */
export type VirtualTimelineResult = {
  /** 가상 플랜 아이템 목록 */
  plans: VirtualPlanItem[];
  /** 교과별 시간 분배 */
  subjectDistribution: SubjectTimeDistribution[];
  /** 주차별 요약 */
  weekSummaries: WeekSummary[];
  /** 총 학습 시간 (분) */
  totalStudyMinutes: number;
  /** 총 콘텐츠 수 */
  totalContents: number;
  /** 경고 메시지 */
  warnings: string[];
};

/**
 * 교과별 시간 분배
 */
export type SubjectTimeDistribution = {
  subject_category: string;
  /** 총 시간 (분) */
  total_minutes: number;
  /** 비율 (0-100) */
  percentage: number;
  /** 슬롯 수 */
  slot_count: number;
  /** 플랜 수 */
  plan_count: number;
};

/**
 * 주차별 요약
 */
export type WeekSummary = {
  week_number: number;
  /** 학습일 수 */
  study_days: number;
  /** 복습일 수 */
  review_days: number;
  /** 총 학습 시간 (분) */
  total_minutes: number;
  /** 교과별 시간 */
  subjects: Record<string, number>;
};

// ============================================================================
// 상수
// ============================================================================

/**
 * 기본 블록 시간 (분)
 */
const DEFAULT_BLOCK_DURATION = 90;

// ============================================================================
// 슬롯 관계 처리 함수
// ============================================================================

/**
 * 연계 슬롯 그룹화
 *
 * 연계된 슬롯들을 그룹으로 묶고, 각 그룹 내 순서를 결정합니다.
 * - linked_slot_id가 있는 슬롯들을 하나의 그룹으로 묶음
 * - link_type (before/after)에 따라 순서 정렬
 *
 * @param slots - 콘텐츠 슬롯 배열
 * @returns 그룹화된 슬롯 배열
 */
function groupLinkedSlots(slots: ContentSlot[]): ContentSlot[][] {
  const slotById = new Map<string, ContentSlot>();
  const visited = new Set<string>();
  const groups: ContentSlot[][] = [];
  const slotsWithoutId: ContentSlot[] = [];

  // ID가 있는 슬롯만 매핑
  slots.forEach((slot) => {
    if (slot.id) {
      slotById.set(slot.id, slot);
    } else {
      slotsWithoutId.push(slot);
    }
  });

  // 연계된 슬롯들 그룹화
  slots.forEach((slot) => {
    if (!slot.id || visited.has(slot.id)) return;

    const group: ContentSlot[] = [];
    const queue: ContentSlot[] = [slot];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (!current.id || visited.has(current.id)) continue;

      visited.add(current.id);
      group.push(current);

      // 연결된 슬롯 찾기
      if (current.linked_slot_id) {
        const linked = slotById.get(current.linked_slot_id);
        if (linked && linked.id && !visited.has(linked.id)) {
          queue.push(linked);
        }
      }

      // 이 슬롯을 참조하는 다른 슬롯 찾기
      slots.forEach((other) => {
        if (
          other.linked_slot_id === current.id &&
          other.id &&
          !visited.has(other.id)
        ) {
          queue.push(other);
        }
      });
    }

    // 그룹 내 순서 결정
    const orderedGroup = orderLinkedGroup(group);
    groups.push(orderedGroup);
  });

  // ID가 없는 슬롯들은 개별 그룹으로 추가
  slotsWithoutId.forEach((slot) => {
    groups.push([slot]);
  });

  return groups;
}

/**
 * 연계 그룹 내 순서 결정 (위상 정렬)
 *
 * - A.link_type === "after" && A.linked_slot_id === B → A는 B 다음에 배치
 * - A.link_type === "before" && A.linked_slot_id === B → A는 B 이전에 배치
 *
 * @param group - 연계된 슬롯 그룹
 * @returns 순서가 결정된 슬롯 배열
 */
function orderLinkedGroup(group: ContentSlot[]): ContentSlot[] {
  if (group.length <= 1) return group;

  // 의존성 그래프 구성: slotId → 이 슬롯 이전에 와야 하는 슬롯 ID 목록
  const dependencies = new Map<string, string[]>();

  group.forEach((slot) => {
    if (slot.id) {
      dependencies.set(slot.id, []);
    }
  });

  group.forEach((slot) => {
    if (!slot.id || !slot.linked_slot_id) return;

    // linked_slot_id가 그룹 내에 있는지 확인
    const linkedInGroup = group.some((s) => s.id === slot.linked_slot_id);
    if (!linkedInGroup) return;

    if (slot.link_type === "after") {
      // 이 슬롯은 linked_slot_id 다음에 와야 함
      // 즉, linked_slot_id가 이 슬롯의 선행 조건
      const deps = dependencies.get(slot.id) || [];
      deps.push(slot.linked_slot_id);
      dependencies.set(slot.id, deps);
    } else if (slot.link_type === "before") {
      // 이 슬롯은 linked_slot_id 이전에 와야 함
      // 즉, 이 슬롯이 linked_slot_id의 선행 조건
      const deps = dependencies.get(slot.linked_slot_id) || [];
      deps.push(slot.id);
      dependencies.set(slot.linked_slot_id, deps);
    }
  });

  // 위상 정렬
  const result: ContentSlot[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(slotId: string): boolean {
    if (visited.has(slotId)) return true;
    if (visiting.has(slotId)) return false; // 순환 참조

    visiting.add(slotId);
    const deps = dependencies.get(slotId) || [];
    for (const dep of deps) {
      if (!visit(dep)) return false;
    }
    visiting.delete(slotId);
    visited.add(slotId);

    const slot = group.find((s) => s.id === slotId);
    if (slot) result.push(slot);
    return true;
  }

  group.forEach((slot) => {
    if (slot.id && !visited.has(slot.id)) {
      visit(slot.id);
    }
  });

  // 정렬 실패 시 (순환 참조 등) 원래 순서 반환
  if (result.length !== group.length) {
    return group;
  }

  return result;
}

/**
 * 배타적 제약 조건 체크
 *
 * 해당 날짜에 exclusive_with에 지정된 슬롯이 이미 배치되어 있는지 확인합니다.
 *
 * @param slot - 현재 슬롯
 * @param date - 배치하려는 날짜
 * @param assignedSlots - 이미 배치된 슬롯들 (slotId → date)
 * @param slots - 전체 슬롯 배열
 * @returns 배치 가능 여부 및 충돌 슬롯 ID
 */
function checkExclusiveConstraints(
  slot: ContentSlot,
  date: string,
  assignedSlots: Map<string, string>,
  slots: ContentSlot[]
): { canPlace: boolean; conflictingSlotId?: string } {
  // slot.id가 없으면 체크 불가
  if (!slot.id) {
    return { canPlace: true };
  }

  // 순방향 체크: 이 슬롯이 배타적으로 지정한 슬롯들
  if (slot.exclusive_with?.length) {
    for (const excludedId of slot.exclusive_with) {
      const excludedDate = assignedSlots.get(excludedId);
      if (excludedDate === date) {
        return { canPlace: false, conflictingSlotId: excludedId };
      }
    }
  }

  // 역방향 체크: 다른 슬롯이 이 슬롯을 exclusive_with에 포함하고 있는 경우
  for (const otherSlot of slots) {
    if (
      otherSlot.id &&
      otherSlot.exclusive_with?.includes(slot.id) &&
      assignedSlots.get(otherSlot.id) === date
    ) {
      return { canPlace: false, conflictingSlotId: otherSlot.id };
    }
  }

  return { canPlace: true };
}

/**
 * 슬롯 타입별 기본 소요 시간 (분)
 */
const SLOT_TYPE_DEFAULT_DURATION: Record<string, number> = {
  book: 90, // 교재: 1.5시간
  lecture: 60, // 강의: 1시간
  custom: 60, // 커스텀: 1시간
  self_study: 60, // 자습: 1시간
  test: 90, // 테스트: 1.5시간
};

// ============================================================================
// 메인 함수
// ============================================================================

/**
 * 가상 타임라인 계산
 *
 * 슬롯 구성과 일별 스케줄을 기반으로 가상 플랜을 생성합니다.
 * 연계 슬롯 및 배타적 슬롯 관계를 반영합니다.
 *
 * @param slots - 콘텐츠 슬롯 배열
 * @param dailySchedules - 일별 스케줄 정보
 * @param options - 계산 옵션
 * @returns 가상 타임라인 결과
 */
export function calculateVirtualTimeline(
  slots: ContentSlot[],
  dailySchedules: DailyScheduleInfo[],
  options: {
    /** 학습일만 사용할지 여부 */
    studyDaysOnly?: boolean;
    /** 블록 시간 (분) */
    blockDuration?: number;
  } = {}
): VirtualTimelineResult {
  const { studyDaysOnly = false, blockDuration = DEFAULT_BLOCK_DURATION } =
    options;

  const warnings: string[] = [];
  const plans: VirtualPlanItem[] = [];

  // 유효한 슬롯만 필터링
  const validSlots = slots.filter(
    (slot) => slot.slot_type && slot.subject_category
  );

  if (validSlots.length === 0) {
    return {
      plans: [],
      subjectDistribution: [],
      weekSummaries: [],
      totalStudyMinutes: 0,
      totalContents: 0,
      warnings: ["유효한 슬롯이 없습니다."],
    };
  }

  // 학습 가능한 날짜 필터링
  const availableDays = dailySchedules.filter((day) => {
    if (studyDaysOnly) {
      return day.day_type === "학습일";
    }
    return day.day_type === "학습일" || day.day_type === "복습일";
  });

  if (availableDays.length === 0) {
    return {
      plans: [],
      subjectDistribution: calculateSubjectTimeDistribution(validSlots, []),
      weekSummaries: [],
      totalStudyMinutes: 0,
      totalContents: validSlots.length,
      warnings: ["학습 가능한 날짜가 없습니다."],
    };
  }

  // 슬롯별 소요 시간 미리 계산
  const slotDurationMap = new Map<number, number>();
  validSlots.forEach((slot) => {
    slotDurationMap.set(slot.slot_index, calculateSlotDuration(slot, blockDuration));
  });

  // 총 필요 시간
  const totalRequiredMinutes = Array.from(slotDurationMap.values()).reduce(
    (sum, d) => sum + d,
    0
  );

  // 총 가용 시간
  const totalAvailableMinutes = availableDays.reduce(
    (sum, day) => sum + day.study_hours * 60,
    0
  );

  if (totalRequiredMinutes > totalAvailableMinutes) {
    warnings.push(
      `필요 시간(${Math.round(totalRequiredMinutes / 60)}시간)이 가용 시간(${Math.round(totalAvailableMinutes / 60)}시간)을 초과합니다.`
    );
  }

  // 연계 슬롯 그룹화
  const linkedGroups = groupLinkedSlots(validSlots);

  // 배치 상태 추적
  let dayIndex = 0;
  let remainingMinutesInDay = availableDays[0]?.study_hours * 60 || 0;
  let currentStartTime = "09:00";
  const assignedSlots = new Map<string, string>(); // slotId → date

  // 그룹 단위로 배치
  for (const group of linkedGroups) {
    // 연계 그룹은 같은 날 연속 배치 시도
    const isLinkedGroup = group.length > 1 && group.some((s) => s.linked_slot_id);

    for (const slot of group) {
      const duration = slotDurationMap.get(slot.slot_index) || blockDuration;

      // 현재 날짜에 시간이 부족하면 다음 날로 이동
      while (
        remainingMinutesInDay < duration &&
        dayIndex < availableDays.length - 1
      ) {
        dayIndex++;
        remainingMinutesInDay = availableDays[dayIndex].study_hours * 60;
        currentStartTime = "09:00";
      }

      // 배타적 제약 조건 체크
      let currentDayIndex = dayIndex;
      let foundValidDay = false;
      let exclusiveAdjusted = false;

      while (currentDayIndex < availableDays.length && !foundValidDay) {
        const checkResult = checkExclusiveConstraints(
          slot,
          availableDays[currentDayIndex].date,
          assignedSlots,
          validSlots
        );

        if (checkResult.canPlace) {
          foundValidDay = true;
          if (currentDayIndex !== dayIndex) {
            exclusiveAdjusted = true;
            dayIndex = currentDayIndex;
            remainingMinutesInDay = availableDays[dayIndex].study_hours * 60;
            currentStartTime = "09:00";
          }
        } else {
          currentDayIndex++;
        }
      }

      if (!foundValidDay) {
        warnings.push(
          `슬롯 ${slot.slot_index + 1}: 배타적 제약으로 인해 배치할 수 없습니다.`
        );
        continue;
      }

      if (exclusiveAdjusted) {
        warnings.push(
          `슬롯 ${slot.slot_index + 1}: 배타적 슬롯 관계로 인해 다른 날로 조정되었습니다.`
        );
      }

      if (dayIndex >= availableDays.length) {
        warnings.push(`슬롯 ${slot.slot_index + 1}: 배치 가능한 날짜가 없습니다.`);
        continue;
      }

      const currentDay = availableDays[dayIndex];
      const endTime = addMinutesToTime(currentStartTime, duration);

      // 플랜 아이템 생성
      plans.push({
        slot_index: slot.slot_index,
        slot_type: slot.slot_type,
        subject_category: slot.subject_category,
        title: slot.title,
        date: currentDay.date,
        start_time: currentStartTime,
        end_time: endTime,
        duration_minutes: duration,
        range_start: slot.start_range,
        range_end: slot.end_range,
        week_number: currentDay.week_number || 1,
        day_type: currentDay.day_type,
      });

      // 배치 상태 업데이트
      if (slot.id) {
        assignedSlots.set(slot.id, currentDay.date);
      }

      // 시간 업데이트
      remainingMinutesInDay -= duration;
      currentStartTime = endTime;

      // 점심시간 고려 (12:00-13:00)
      if (currentStartTime >= "12:00" && currentStartTime < "13:00") {
        currentStartTime = "13:00";
      }
    }

    // 연계 그룹이 같은 날에 배치되지 못한 경우 경고
    if (isLinkedGroup) {
      const groupDates = new Set<string>();
      group.forEach((slot) => {
        const plan = plans.find((p) => p.slot_index === slot.slot_index);
        if (plan) groupDates.add(plan.date);
      });

      if (groupDates.size > 1) {
        warnings.push(
          `연계된 슬롯이 같은 날에 배치되지 못했습니다. (슬롯 인덱스: ${group.map((s) => s.slot_index + 1).join(", ")})`
        );
      }
    }
  }

  // 교과별 시간 분배 계산
  const subjectDistribution = calculateSubjectTimeDistribution(
    validSlots,
    plans
  );

  // 주차별 요약 계산
  const weekSummaries = calculateWeekSummaries(plans, availableDays);

  return {
    plans,
    subjectDistribution,
    weekSummaries,
    totalStudyMinutes: plans.reduce((sum, p) => sum + p.duration_minutes, 0),
    totalContents: validSlots.filter((s) => s.content_id).length,
    warnings,
  };
}

// ============================================================================
// 교과별 시간 분배 계산
// ============================================================================

/**
 * 교과별 시간 분배 계산
 *
 * @param slots - 콘텐츠 슬롯 배열
 * @param plans - 가상 플랜 아이템 배열
 * @returns 교과별 시간 분배
 */
export function calculateSubjectTimeDistribution(
  slots: ContentSlot[],
  plans: VirtualPlanItem[]
): SubjectTimeDistribution[] {
  const subjectMap = new Map<
    string,
    { total_minutes: number; slot_count: number; plan_count: number }
  >();

  // 슬롯에서 교과 정보 수집
  slots.forEach((slot) => {
    if (!slot.subject_category) return;

    const existing = subjectMap.get(slot.subject_category) || {
      total_minutes: 0,
      slot_count: 0,
      plan_count: 0,
    };

    existing.slot_count++;
    subjectMap.set(slot.subject_category, existing);
  });

  // 플랜에서 시간 정보 수집
  plans.forEach((plan) => {
    if (!plan.subject_category) return;

    const existing = subjectMap.get(plan.subject_category) || {
      total_minutes: 0,
      slot_count: 0,
      plan_count: 0,
    };

    existing.total_minutes += plan.duration_minutes;
    existing.plan_count++;
    subjectMap.set(plan.subject_category, existing);
  });

  // 총 시간 계산
  const totalMinutes = Array.from(subjectMap.values()).reduce(
    (sum, v) => sum + v.total_minutes,
    0
  );

  // 결과 생성
  return Array.from(subjectMap.entries())
    .map(([subject, data]) => ({
      subject_category: subject,
      total_minutes: data.total_minutes,
      percentage:
        totalMinutes > 0
          ? Math.round((data.total_minutes / totalMinutes) * 100)
          : 0,
      slot_count: data.slot_count,
      plan_count: data.plan_count,
    }))
    .sort((a, b) => b.total_minutes - a.total_minutes);
}

// ============================================================================
// 주차별 요약 계산
// ============================================================================

/**
 * 주차별 요약 계산
 *
 * @param plans - 가상 플랜 아이템 배열
 * @param dailySchedules - 일별 스케줄 정보
 * @returns 주차별 요약
 */
export function calculateWeekSummaries(
  plans: VirtualPlanItem[],
  dailySchedules: DailyScheduleInfo[]
): WeekSummary[] {
  const weekMap = new Map<
    number,
    {
      study_days: Set<string>;
      review_days: Set<string>;
      total_minutes: number;
      subjects: Record<string, number>;
    }
  >();

  // 플랜에서 주차 정보 수집
  plans.forEach((plan) => {
    const weekNumber = plan.week_number;

    const existing = weekMap.get(weekNumber) || {
      study_days: new Set<string>(),
      review_days: new Set<string>(),
      total_minutes: 0,
      subjects: {},
    };

    if (plan.day_type === "학습일") {
      existing.study_days.add(plan.date);
    } else if (plan.day_type === "복습일") {
      existing.review_days.add(plan.date);
    }

    existing.total_minutes += plan.duration_minutes;
    existing.subjects[plan.subject_category] =
      (existing.subjects[plan.subject_category] || 0) + plan.duration_minutes;

    weekMap.set(weekNumber, existing);
  });

  // 결과 생성
  return Array.from(weekMap.entries())
    .map(([weekNumber, data]) => ({
      week_number: weekNumber,
      study_days: data.study_days.size,
      review_days: data.review_days.size,
      total_minutes: data.total_minutes,
      subjects: data.subjects,
    }))
    .sort((a, b) => a.week_number - b.week_number);
}

// ============================================================================
// 헬퍼 함수
// ============================================================================

/**
 * 슬롯 소요 시간 계산
 *
 * @param slot - 콘텐츠 슬롯
 * @param blockDuration - 블록 시간 (분)
 * @returns 소요 시간 (분)
 */
function calculateSlotDuration(
  slot: ContentSlot,
  blockDuration: number
): number {
  // 콘텐츠가 연결된 경우: 범위 기반 계산
  if (slot.content_id && slot.start_range !== undefined && slot.end_range !== undefined) {
    const rangeCount = slot.end_range - slot.start_range;

    if (slot.slot_type === "book") {
      // 교재: DEFAULT_PAGE 분 per 페이지
      const minutesPerPage = SCHEDULER_CONFIG.DURATION.DEFAULT_PAGE;
      return rangeCount * minutesPerPage;
    } else if (slot.slot_type === "lecture") {
      // 강의: 회차당 30분
      return rangeCount * SCHEDULER_CONFIG.DURATION.DEFAULT_EPISODE;
    }
  }

  // 기본 소요 시간 사용
  const slotType = slot.slot_type || "book";
  return SLOT_TYPE_DEFAULT_DURATION[slotType] || blockDuration;
}

/**
 * 시간에 분 추가
 *
 * @param time - 시작 시간 (HH:MM)
 * @param minutes - 추가할 분
 * @returns 종료 시간 (HH:MM)
 */
function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

// ============================================================================
// 뷰 변환 함수
// ============================================================================

/**
 * 일별 뷰로 변환
 *
 * @param result - 가상 타임라인 결과
 * @returns 일별로 그룹화된 플랜
 */
export function groupPlansByDate(
  result: VirtualTimelineResult
): Record<string, VirtualPlanItem[]> {
  const grouped: Record<string, VirtualPlanItem[]> = {};

  result.plans.forEach((plan) => {
    if (!grouped[plan.date]) {
      grouped[plan.date] = [];
    }
    grouped[plan.date].push(plan);
  });

  // 날짜순 정렬
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  );
}

/**
 * 주차별 뷰로 변환
 *
 * @param result - 가상 타임라인 결과
 * @returns 주차별로 그룹화된 플랜
 */
export function groupPlansByWeek(
  result: VirtualTimelineResult
): Record<number, VirtualPlanItem[]> {
  const grouped: Record<number, VirtualPlanItem[]> = {};

  result.plans.forEach((plan) => {
    const week = plan.week_number;
    if (!grouped[week]) {
      grouped[week] = [];
    }
    grouped[week].push(plan);
  });

  return grouped;
}

/**
 * 교과별 뷰로 변환
 *
 * @param result - 가상 타임라인 결과
 * @returns 교과별로 그룹화된 플랜
 */
export function groupPlansBySubject(
  result: VirtualTimelineResult
): Record<string, VirtualPlanItem[]> {
  const grouped: Record<string, VirtualPlanItem[]> = {};

  result.plans.forEach((plan) => {
    const subject = plan.subject_category;
    if (!grouped[subject]) {
      grouped[subject] = [];
    }
    grouped[subject].push(plan);
  });

  return grouped;
}
