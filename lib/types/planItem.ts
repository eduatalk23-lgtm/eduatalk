import type { PlanStatus } from '@/lib/types/plan';

export type PlanItemType = 'plan' | 'adhoc';
export type ContainerType = 'daily' | 'weekly' | 'unfinished';
export type TimeSlotType = 'study' | 'self_study' | null;

export interface PlanItemData {
  id: string;
  type: PlanItemType;
  title: string;
  subject?: string;
  /** 콘텐츠 타입 (book/lecture/custom) - 범위 표시 형식 결정에 사용 */
  contentType?: 'book' | 'lecture' | 'custom' | string;
  pageRangeStart?: number | null;
  pageRangeEnd?: number | null;
  completedAmount?: number | null;
  progress?: number | null;
  status: PlanStatus;
  isCompleted: boolean;
  customTitle?: string | null;
  customRangeDisplay?: string | null;
  estimatedMinutes?: number | null;
  planDate?: string;
  startTime?: string | null;
  endTime?: string | null;
  carryoverCount?: number;
  carryoverFromDate?: string | null;
  planGroupId?: string | null;
  /** Phase 4: 시간대 유형 (학습시간/자율학습시간) */
  timeSlotType?: TimeSlotType;
  /** Phase 4: 배치 사유 */
  allocationReason?: string | null;
}

/**
 * Raw DB 데이터를 PlanItemData로 변환
 */
export function toPlanItemData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  type: PlanItemType
): PlanItemData {
  if (type === 'adhoc') {
    return {
      id: raw.id,
      type: 'adhoc',
      title: raw.title,
      status: raw.status ?? 'pending',
      isCompleted: raw.status === 'completed',
      estimatedMinutes: raw.estimated_minutes,
      planDate: raw.plan_date,
      startTime: raw.start_time,
      endTime: raw.end_time,
    };
  }

  return {
    id: raw.id,
    type: 'plan',
    title: raw.custom_title ?? raw.content_title ?? '제목 없음',
    subject: raw.content_subject ?? undefined,
    contentType: raw.content_type ?? undefined,
    pageRangeStart: raw.planned_start_page_or_time,
    pageRangeEnd: raw.planned_end_page_or_time,
    completedAmount: raw.completed_amount,
    progress: raw.progress,
    status: raw.status ?? 'pending',
    isCompleted: raw.status === 'completed' || raw.actual_end_time != null,
    customTitle: raw.custom_title,
    customRangeDisplay: raw.custom_range_display,
    estimatedMinutes: raw.estimated_minutes,
    planDate: raw.plan_date,
    startTime: raw.start_time,
    endTime: raw.end_time,
    carryoverCount: raw.carryover_count ?? 0,
    carryoverFromDate: raw.carryover_from_date,
    planGroupId: raw.plan_group_id,
    timeSlotType: raw.time_slot_type ?? null,
    allocationReason: raw.allocation_type?.reason ?? null,
  };
}
