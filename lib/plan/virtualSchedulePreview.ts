/**
 * Virtual Schedule Preview (V1 - Legacy Adapter)
 *
 * V2에서 사용하는 유틸리티 함수 제공
 * 실제 V1 로직은 V2로 마이그레이션됨
 * 레거시 호환성을 위한 어댑터 함수 포함
 */

import type { ContentSlot, SlotType } from "@/lib/types/content-selection";
import type { DailyScheduleInfo, StudyReviewCycle } from "@/lib/types/plan";
import {
  calculateVirtualTimelineV2,
  groupPlansByDateV2,
  groupPlansByWeekV2,
  type VirtualTimelineResultV2,
  type VirtualPlanItemV2,
  type SubjectTimeDistributionV2,
  type CycleSummaryV2,
} from "./virtualSchedulePreviewV2";

// V2 타입 re-export
export type { VirtualPlanItemV2, VirtualTimelineResultV2 };

// DailyScheduleInfo 타입 re-export
export type { DailyScheduleInfo };

// ============================================================================
// 레거시 호환 타입 정의
// ============================================================================

/**
 * 레거시 VirtualPlanItem (V1 호환)
 */
export type VirtualPlanItem = VirtualPlanItemV2;

/**
 * 레거시 주간 요약 타입 (V1 호환)
 */
export interface WeekSummary {
  week_number: number;
  total_minutes: number;
  study_days: number;
  review_days: number;
  subjects: Record<string, boolean>;
}

/**
 * 레거시 교과별 분배 타입 (V1 호환)
 */
export interface SubjectDistribution {
  subject_category: string;
  total_minutes: number;
  percentage: number;
}

/**
 * 레거시 VirtualTimelineResult (V1 호환)
 */
export interface VirtualTimelineResult {
  plans: VirtualPlanItem[];
  subjectDistribution: SubjectDistribution[];
  weekSummaries: WeekSummary[];
  totalStudyMinutes: number;
  totalContents: number;
  warnings: string[];
}

// ============================================================================
// 레거시 어댑터 함수
// ============================================================================

/**
 * CycleSummaryV2를 WeekSummary로 변환
 */
function convertCycleSummaryToWeekSummary(cycle: CycleSummaryV2): WeekSummary {
  const subjects: Record<string, boolean> = {};
  for (const subject of cycle.subjects) {
    subjects[subject] = true;
  }

  return {
    week_number: cycle.cycle_number,
    total_minutes: cycle.total_study_minutes + cycle.total_review_minutes,
    study_days: cycle.study_day_count,
    review_days: cycle.review_day_count,
    subjects,
  };
}

/**
 * SubjectTimeDistributionV2를 SubjectDistribution으로 변환
 */
function convertSubjectDistribution(
  dist: SubjectTimeDistributionV2
): SubjectDistribution {
  return {
    subject_category: dist.subject_category,
    total_minutes: dist.total_minutes,
    percentage: dist.percentage,
  };
}

/**
 * VirtualTimelineResultV2를 VirtualTimelineResult로 변환
 */
function convertV2ResultToV1(result: VirtualTimelineResultV2): VirtualTimelineResult {
  return {
    plans: result.plans,
    subjectDistribution: result.subjectDistribution.map(convertSubjectDistribution),
    weekSummaries: result.cycleSummaries.map(convertCycleSummaryToWeekSummary),
    totalStudyMinutes: result.totalStudyMinutes,
    totalContents: result.totalContents,
    warnings: result.warnings,
  };
}

/**
 * DailyScheduleInfo에서 기간 추출
 */
function extractPeriodFromSchedules(
  dailySchedules: DailyScheduleInfo[]
): { start: string; end: string } {
  if (dailySchedules.length === 0) {
    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    return { start: today, end: endDate.toISOString().split("T")[0] };
  }

  const dates = dailySchedules.map((s) => s.date).sort();
  return { start: dates[0], end: dates[dates.length - 1] };
}

/**
 * 레거시 calculateVirtualTimeline (V1 시그니처 호환)
 *
 * 이전 버전과 호환되는 함수 시그니처 유지
 * 내부적으로 V2 함수를 호출하고 결과를 V1 형식으로 변환
 */
export function calculateVirtualTimeline(
  slots: ContentSlot[],
  dailySchedules: DailyScheduleInfo[]
): VirtualTimelineResult {
  // 기간 추출
  const period = extractPeriodFromSchedules(dailySchedules);

  // 기본 학습-복습 주기 설정
  const defaultStudyReviewCycle: StudyReviewCycle = {
    study_days: 5,
    review_days: 2,
  };

  // V2 옵션 구성
  const options = {
    studyReviewCycle: defaultStudyReviewCycle,
    periodStart: period.start,
    periodEnd: period.end,
    dailySchedule: dailySchedules,
    dailyStudyHours: 4,
  };

  // V2 함수 호출
  const v2Result = calculateVirtualTimelineV2(slots, options);

  // V1 형식으로 변환하여 반환
  return convertV2ResultToV1(v2Result);
}

/**
 * 레거시 groupPlansByDate (객체 반환)
 */
export function groupPlansByDate(
  result: VirtualTimelineResult | VirtualTimelineResultV2
): Record<string, VirtualPlanItem[]> {
  const map = groupPlansByDateV2(result as VirtualTimelineResultV2);
  const obj: Record<string, VirtualPlanItem[]> = {};
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * 레거시 groupPlansByWeek (객체 반환)
 */
export function groupPlansByWeek(
  result: VirtualTimelineResult | VirtualTimelineResultV2
): Record<string, VirtualPlanItem[]> {
  const map = groupPlansByWeekV2(result as VirtualTimelineResultV2);
  const obj: Record<string, VirtualPlanItem[]> = {};
  for (const [key, value] of map.entries()) {
    obj[key] = value;
  }
  return obj;
}

// ============================================================================
// 상수
// ============================================================================

/**
 * 슬롯 타입별 기본 시간 (분)
 */
export const SLOT_TYPE_DEFAULT_DURATION: Record<SlotType, number> = {
  book: 90,
  lecture: 60,
  custom: 60,
  self_study: 30,
  test: 90,
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 시간에 분 추가
 * @param time "HH:mm" 형식
 * @param minutes 추가할 분
 * @returns "HH:mm" 형식
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`;
}

/**
 * 연결된 슬롯들을 그룹화
 *
 * linked_slot_id와 link_type을 기반으로 연결된 슬롯들을 하나의 그룹으로 묶습니다.
 * 예: A → B → C (B가 A 다음, C가 B 다음) → [A, B, C] 하나의 그룹
 *
 * @param slots 전체 콘텐츠 슬롯 목록
 * @returns 연결된 슬롯 그룹 배열
 */
export function groupLinkedSlots(
  slots: ContentSlot[]
): ContentSlot[][] {
  if (slots.length === 0) return [];

  // ID로 슬롯 맵 생성
  const slotById = new Map<string, ContentSlot>();
  for (const slot of slots) {
    if (slot.id) {
      slotById.set(slot.id, slot);
    }
  }

  // 방문 여부 추적
  const visited = new Set<string>();

  // 연결 그래프 구성: 슬롯 → 연결된 슬롯들
  // link_type: "after" → 현재 슬롯이 linked_slot_id 다음에 옴
  // link_type: "before" → 현재 슬롯이 linked_slot_id 이전에 옴
  const linkedFrom = new Map<string, ContentSlot[]>(); // linked_slot_id → [슬롯들]

  for (const slot of slots) {
    if (slot.id && slot.linked_slot_id && slotById.has(slot.linked_slot_id)) {
      const existing = linkedFrom.get(slot.linked_slot_id) || [];
      existing.push(slot);
      linkedFrom.set(slot.linked_slot_id, existing);
    }
  }

  // 연결 체인의 시작점 찾기 (다른 슬롯에 의해 참조되지 않는 슬롯)
  const isReferencedBy = new Set<string>();
  for (const slot of slots) {
    if (slot.linked_slot_id) {
      isReferencedBy.add(slot.linked_slot_id);
    }
  }

  const result: ContentSlot[][] = [];

  // 각 슬롯에서 체인 구성
  for (const slot of slots) {
    const slotId = slot.id ?? `idx-${slot.slot_index}`;

    // 이미 방문한 슬롯은 스킵
    if (visited.has(slotId)) continue;

    // linked_slot_id가 있으면 이 슬롯은 체인의 시작점이 아님
    // 단, linked_slot_id가 유효한 슬롯을 참조하는 경우만
    if (slot.linked_slot_id && slotById.has(slot.linked_slot_id)) {
      continue;
    }

    // 이 슬롯에서 시작하는 체인 구성
    const chain: ContentSlot[] = [];
    const queue: ContentSlot[] = [slot];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentId = current.id ?? `idx-${current.slot_index}`;

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // link_type에 따라 순서 결정
      if (current.link_type === "before" && current.linked_slot_id) {
        // "before" 타입: 현재 슬롯이 연결된 슬롯 이전에 와야 함
        // chain의 앞쪽에 삽입 (연결된 슬롯 이전)
        chain.unshift(current);
      } else {
        // "after" 타입 또는 시작점: 뒤에 추가
        chain.push(current);
      }

      // 현재 슬롯을 linked_slot_id로 가진 슬롯들 찾기
      if (current.id) {
        const followers = linkedFrom.get(current.id) || [];
        for (const follower of followers) {
          const followerId = follower.id ?? `idx-${follower.slot_index}`;
          if (!visited.has(followerId)) {
            queue.push(follower);
          }
        }
      }
    }

    if (chain.length > 0) {
      // link_type에 따라 최종 정렬
      const sortedChain = sortLinkedChain(chain);
      result.push(sortedChain);
    }
  }

  // 방문하지 않은 슬롯들 (ID가 없는 경우 등)은 개별 그룹으로
  for (const slot of slots) {
    const slotId = slot.id ?? `idx-${slot.slot_index}`;
    if (!visited.has(slotId)) {
      result.push([slot]);
    }
  }

  return result;
}

/**
 * 연결된 체인을 link_type에 따라 정렬
 */
function sortLinkedChain(chain: ContentSlot[]): ContentSlot[] {
  if (chain.length <= 1) return chain;

  // ID로 슬롯 맵 생성
  const slotById = new Map<string, ContentSlot>();
  for (const slot of chain) {
    if (slot.id) {
      slotById.set(slot.id, slot);
    }
  }

  // 의존성 그래프: 어떤 슬롯이 어떤 슬롯 다음에 와야 하는지
  const mustComeAfter = new Map<string, string>(); // slot.id → 이 슬롯 이전에 와야 하는 슬롯 ID

  for (const slot of chain) {
    if (slot.id && slot.linked_slot_id && slotById.has(slot.linked_slot_id)) {
      if (slot.link_type === "after") {
        // "after": 현재 슬롯이 linked_slot_id 다음에 와야 함
        mustComeAfter.set(slot.id, slot.linked_slot_id);
      } else if (slot.link_type === "before") {
        // "before": linked_slot_id가 현재 슬롯 다음에 와야 함
        mustComeAfter.set(slot.linked_slot_id, slot.id);
      }
    }
  }

  // 위상 정렬
  const result: ContentSlot[] = [];
  const remaining = new Set(chain.map(s => s.id ?? `idx-${s.slot_index}`));

  while (remaining.size > 0) {
    let found = false;

    for (const slot of chain) {
      const slotId = slot.id ?? `idx-${slot.slot_index}`;
      if (!remaining.has(slotId)) continue;

      // 이 슬롯 이전에 와야 하는 슬롯이 모두 처리되었는지 확인
      const prereq = slot.id ? mustComeAfter.get(slot.id) : undefined;
      if (!prereq || !remaining.has(prereq)) {
        result.push(slot);
        remaining.delete(slotId);
        found = true;
        break;
      }
    }

    // 순환 참조가 있으면 나머지 슬롯들을 그냥 추가
    if (!found) {
      for (const slot of chain) {
        const slotId = slot.id ?? `idx-${slot.slot_index}`;
        if (remaining.has(slotId)) {
          result.push(slot);
          remaining.delete(slotId);
        }
      }
    }
  }

  return result;
}

/**
 * 배타적 제약 조건 체크
 *
 * 특정 슬롯을 특정 날짜에 배치할 수 있는지 확인합니다.
 * 배타적 관계(exclusive_with)에 있는 슬롯이 같은 날짜에 이미 배치되어 있으면 배치 불가.
 *
 * @param slot 배치하려는 슬롯
 * @param date 배치하려는 날짜 (YYYY-MM-DD)
 * @param assignedSlots 이미 배치된 슬롯 맵 (slotId → date)
 * @param validSlots 전체 유효한 슬롯 목록
 * @returns canPlace: 배치 가능 여부, reason: 불가 사유, conflictingSlotIds: 충돌 슬롯 ID들
 */
export function checkExclusiveConstraints(
  slot: ContentSlot,
  date: string,
  assignedSlots: Map<string, string>,
  validSlots: ContentSlot[]
): { canPlace: boolean; reason?: string; conflictingSlotIds?: string[] } {
  // ID로 슬롯 맵 생성
  const slotById = new Map<string, ContentSlot>();
  for (const s of validSlots) {
    if (s.id) {
      slotById.set(s.id, s);
    }
  }

  const conflictingSlotIds: string[] = [];

  // 1. 정방향 체크: 현재 슬롯의 exclusive_with에 있는 슬롯들이 같은 날짜에 있는지
  if (slot.exclusive_with && slot.exclusive_with.length > 0) {
    for (const excludedId of slot.exclusive_with) {
      // 배타적 슬롯이 유효한 슬롯인지 확인
      if (!slotById.has(excludedId)) {
        continue; // 존재하지 않는 슬롯은 무시
      }

      // 이미 배치된 날짜 확인
      const assignedDate = assignedSlots.get(excludedId);
      if (assignedDate === date) {
        conflictingSlotIds.push(excludedId);
      }
    }
  }

  // 2. 양방향 체크: 다른 슬롯의 exclusive_with에 현재 슬롯이 포함되어 있는지
  if (slot.id) {
    for (const [assignedSlotId, assignedDate] of assignedSlots) {
      if (assignedDate !== date) continue;
      if (conflictingSlotIds.includes(assignedSlotId)) continue; // 이미 추가됨

      const assignedSlot = slotById.get(assignedSlotId);
      if (assignedSlot?.exclusive_with?.includes(slot.id)) {
        conflictingSlotIds.push(assignedSlotId);
      }
    }
  }

  if (conflictingSlotIds.length > 0) {
    const conflictingNames = conflictingSlotIds
      .map(id => slotById.get(id)?.subject_category ?? id)
      .join(", ");

    return {
      canPlace: false,
      reason: `배타적 관계인 슬롯(${conflictingNames})이 같은 날짜에 이미 배치되어 있습니다.`,
      conflictingSlotIds,
    };
  }

  return { canPlace: true };
}

/**
 * 슬롯에 대해 배치 가능한 날짜 찾기
 *
 * 배타적 제약을 고려하여 슬롯을 배치할 수 있는 날짜를 찾습니다.
 *
 * @param slot 배치하려는 슬롯
 * @param preferredDates 선호하는 날짜 목록 (우선순위 순)
 * @param assignedSlots 이미 배치된 슬롯 맵
 * @param validSlots 전체 유효한 슬롯 목록
 * @returns 배치 가능한 날짜 또는 null
 */
export function findAvailableDateForSlot(
  slot: ContentSlot,
  preferredDates: string[],
  assignedSlots: Map<string, string>,
  validSlots: ContentSlot[]
): { date: string | null; adjustedFromPreferred: boolean; reason?: string } {
  // 선호 날짜 중 배치 가능한 날짜 찾기
  for (let i = 0; i < preferredDates.length; i++) {
    const date = preferredDates[i];
    const check = checkExclusiveConstraints(slot, date, assignedSlots, validSlots);

    if (check.canPlace) {
      return {
        date,
        adjustedFromPreferred: i > 0,
        reason: i > 0 ? "배타적 관계로 인해 다른 날짜로 조정되었습니다." : undefined,
      };
    }
  }

  return {
    date: null,
    adjustedFromPreferred: true,
    reason: "배타적 제약으로 인해 배치 가능한 날짜가 없습니다.",
  };
}

// ============================================================================
// 플랜 생성용 유틸리티 함수
// ============================================================================

/**
 * 콘텐츠가 없는 슬롯(가상 슬롯)만 필터링
 *
 * @param slots 전체 콘텐츠 슬롯 목록
 * @returns 콘텐츠가 연결되지 않은 슬롯만
 */
export function filterVirtualSlots(slots: ContentSlot[]): ContentSlot[] {
  return slots.filter(
    (slot) => !slot.content_id && !slot.master_content_id
  );
}

/**
 * 가상 플랜 아이템 생성 컨텍스트
 */
interface VirtualPlanContext {
  tenantId: string;
  studentId: string;
  planGroupId: string;
}

/**
 * 가상 플랜 DB 레코드 타입
 *
 * student_plans 테이블에 저장되는 가상 플랜 레코드
 * 실제 플랜과 동일한 형식이되, is_virtual=true로 구분
 */
export interface VirtualPlanRecord {
  plan_group_id: string;
  student_id: string;
  tenant_id: string;
  // 날짜/시간
  scheduled_date: string;
  plan_date: string;  // scheduled_date와 동일
  start_time: string;
  end_time: string;
  duration_minutes: number;
  // 콘텐츠 정보
  content_type: SlotType;
  content_id: string | null;
  slot_id: string;
  slot_index: number | null;
  // 범위 정보
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  chapter: string | null;
  // 분류 정보
  subject_category: string | null;
  subject: string | null;
  virtual_subject_category: string | null;
  virtual_description: string | null;
  // 상태/메타
  status: "pending" | "in_progress" | "completed";
  day_type: "학습일" | "복습일";
  week: number | null;
  day: number | null;
  block_index: number;
  // 가상 플랜 마커
  is_virtual: boolean;
}

/**
 * 가상 타임라인 결과에서 가상 플랜 DB 레코드 생성
 *
 * V1과 V2 모두 호환되도록 slot_id 또는 slot_index 사용
 *
 * @param virtualPlans 가상 타임라인의 플랜 목록 (VirtualPlanItem 또는 VirtualPlanItemV2)
 * @param virtualSlots 가상 슬롯 목록
 * @param context 플랜 생성 컨텍스트 (tenant, student, planGroup IDs)
 * @returns DB에 저장할 가상 플랜 레코드 배열
 */
export function generateVirtualPlanItems(
  virtualPlans: Array<{
    date: string;
    start_time: string;
    end_time: string;
    duration_minutes: number;
    slot_id?: string;
    slot_index?: number;
    slot_type?: SlotType | null;
    subject_category?: string;
    day_type?: "study" | "review";
    range_start?: number;
    range_end?: number;
    cycle_number?: number;
    cycle_day_number?: number;
  }>,
  virtualSlots: ContentSlot[],
  context: VirtualPlanContext
): VirtualPlanRecord[] {
  // slot_id 또는 slot_index로 슬롯 맵 생성
  const slotMapById = new Map(virtualSlots.filter((s) => s.id).map((s) => [s.id, s]));
  const slotMapByIndex = new Map(virtualSlots.map((s) => [s.slot_index, s]));

  return virtualPlans.map((plan, index) => {
    // slot_id가 있으면 그것으로, 없으면 slot_index로 찾기
    let slot: ContentSlot | undefined;
    let slotId: string;
    let slotIndex: number;

    if (plan.slot_id) {
      slot = slotMapById.get(plan.slot_id);
      slotId = plan.slot_id;
      slotIndex = plan.slot_index ?? slot?.slot_index ?? index;
    } else if (plan.slot_index !== undefined) {
      slot = slotMapByIndex.get(plan.slot_index);
      slotId = slot?.id ?? `virtual-slot-${plan.slot_index}`;
      slotIndex = plan.slot_index;
    } else {
      slotId = `virtual-slot-${index}`;
      slotIndex = index;
    }

    // day_type 변환: "study" -> "학습일", "review" -> "복습일"
    const dayType: "학습일" | "복습일" =
      plan.day_type === "review" ? "복습일" : "학습일";

    const subjectCategory = plan.subject_category ?? slot?.subject_category;

    return {
      plan_group_id: context.planGroupId,
      student_id: context.studentId,
      tenant_id: context.tenantId,
      // 날짜/시간
      scheduled_date: plan.date,
      plan_date: plan.date,
      start_time: plan.start_time,
      end_time: plan.end_time,
      duration_minutes: plan.duration_minutes,
      // 콘텐츠 정보
      content_type: (plan.slot_type ?? slot?.slot_type ?? "custom") as SlotType,
      content_id: slot?.content_id ?? null,
      slot_id: slotId,
      slot_index: slotIndex,
      // 범위 정보
      planned_start_page_or_time: plan.range_start ?? slot?.start_range ?? null,
      planned_end_page_or_time: plan.range_end ?? slot?.end_range ?? null,
      chapter: null,
      // 분류 정보
      subject_category: subjectCategory ?? null,
      subject: slot?.subject ?? null,
      virtual_subject_category: subjectCategory ?? null,
      virtual_description: null,
      // 상태/메타
      status: "pending" as const,
      day_type: dayType,
      week: plan.cycle_number ?? null,
      day: plan.cycle_day_number ?? null,
      block_index: index,
      // 가상 플랜 마커
      is_virtual: true,
    };
  });
}

// SubjectAllocation 타입을 1730TimetableLogic에서 가져옴
import { type SubjectAllocation } from "./1730TimetableLogic";

/**
 * 콘텐츠 슬롯에서 Subject Allocation 자동 생성
 *
 * 슬롯 모드에서 사용. 각 슬롯의 subject_category를 기반으로
 * subject_allocations 배열을 생성합니다.
 *
 * @param slots 콘텐츠 슬롯 목록
 * @returns Subject Allocation 배열
 */
export function buildAllocationFromSlots(
  slots: ContentSlot[]
): SubjectAllocation[] {
  // subject_category별로 그룹화
  const categoryMap = new Map<string, ContentSlot[]>();

  for (const slot of slots) {
    if (slot.subject_category) {
      const existing = categoryMap.get(slot.subject_category) || [];
      existing.push(slot);
      categoryMap.set(slot.subject_category, existing);
    }
  }

  // 각 카테고리에 대해 allocation 생성
  const allocations: SubjectAllocation[] = [];

  for (const [category, categorySlots] of categoryMap) {
    // 슬롯의 subject_type을 기반으로 분류, 기본은 weakness
    // 슬롯 중 하나라도 strategy면 전체가 strategy
    const isStrategy = categorySlots.some((s) => s.subject_type === "strategy");
    const subjectType: "strategy" | "weakness" = isStrategy ? "strategy" : "weakness";

    // 첫 번째 슬롯의 subject_id 사용, 없으면 category 기반으로 생성
    const firstSlot = categorySlots[0];
    const subjectId = firstSlot.subject_id ?? `subject-${category.replace(/\s+/g, "-").toLowerCase()}`;

    allocations.push({
      subject_id: subjectId,
      subject_name: category,
      subject_type: subjectType,
      // 전략과목인 경우 weekly_days 설정 (슬롯에서 가져오거나 기본값 3)
      weekly_days: isStrategy
        ? firstSlot.weekly_days ?? 3
        : undefined,
    });
  }

  return allocations;
}
