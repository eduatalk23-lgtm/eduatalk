'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse, ContainerType } from '../types';
import { createAutoContentPlanGroupAction } from './createAutoContentPlanGroup';
import {
  getExistingPlansForStudent,
  groupExistingPlansByDate,
} from './planCreation/existingPlansQuery';
import {
  adjustDateTimeSlotsWithExistingPlans,
  adjustDateAvailableTimeRangesWithExistingPlans,
  timeToMinutes,
} from './planCreation/timelineAdjustment';
import { generateScheduleForPlanner } from './planCreation/scheduleGenerator';
import { findAvailableTimeSlot } from './planCreation/singleDayScheduler';
import { calculateEstimatedMinutes } from '../utils/durationCalculator';
import { generatePlansFromGroup, type DateTimeSlots as SchedulerDateTimeSlots } from '@/lib/plan/scheduler';

export type DistributionMode = 'today' | 'period' | 'weekly';

/**
 * 현재 날짜/컨테이너 타입에서 최대 sequence를 조회하여 다음 값 반환
 */
async function getNextSequence(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  studentId: string,
  planDate: string,
  containerType: ContainerType
): Promise<number> {
  const { data } = await supabase
    .from('student_plan')
    .select('sequence')
    .eq('student_id', studentId)
    .eq('plan_date', planDate)
    .eq('container_type', containerType)
    .eq('is_active', true)
    .order('sequence', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();  // 데이터가 없어도 에러 발생하지 않음

  return (data?.sequence ?? 0) + 1;
}

export interface CreatePlanFromContentInput {
  // 콘텐츠 정보
  flexibleContentId: string;
  contentTitle: string;
  contentSubject: string | null;

  // 범위 정보
  rangeStart: number | null;
  rangeEnd: number | null;
  customRangeDisplay?: string | null;
  totalVolume?: number | null;

  // 배치 정보
  distributionMode: DistributionMode;
  targetDate: string; // 기준 날짜 (today, weekly) 또는 시작 날짜 (period)
  periodEndDate?: string; // period 모드에서 종료 날짜

  // 학생 정보
  studentId: string;
  tenantId: string;

  // 플래너/플랜그룹 연결 (플래너 선택 필수)
  /** 선택된 플래너 ID (필수 - Plan Group 자동 선택/생성 시 사용) */
  plannerId: string;
  /** 지정된 그룹 ID (없으면 자동 생성) */
  planGroupId?: string;

  // 스케줄러 옵션 (today 모드 전용)
  /** 스케줄러를 사용한 자동 시간 배정 활성화 (기본: false) */
  useScheduler?: boolean;
  /** 예상 소요시간 (분). 지정하지 않으면 콘텐츠 타입과 볼륨으로 자동 계산 */
  estimatedMinutes?: number;

  // 학습 유형
  /** 학습 유형: 전략 학습(strategy) 또는 취약 보완(weakness) */
  subjectType?: 'strategy' | 'weakness' | null;
}

export interface CreatePlanFromContentResult {
  createdPlanIds: string[];
  createdCount: number;
}

/**
 * 콘텐츠에서 플랜 생성 (배치 방식에 따라)
 */
export async function createPlanFromContent(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const now = new Date().toISOString();

    // 플랜그룹 ID 결정 (자동 생성 또는 기존 사용)
    let effectivePlanGroupId: string | undefined = input.planGroupId;

    // plannerId가 있고 planGroupId가 없으면 자동 생성
    if (input.plannerId && !input.planGroupId) {
      logActionDebug(
        { domain: 'admin-plan', action: 'createPlanFromContent' },
        '플랜그룹 자동 생성 시작',
        { plannerId: input.plannerId, studentId: input.studentId }
      );

      const autoGroupResult = await createAutoContentPlanGroupAction({
        tenantId: input.tenantId,
        studentId: input.studentId,
        plannerId: input.plannerId,
        contentTitle: input.contentTitle,
        targetDate: input.targetDate,
        planPurpose: 'content',
      });

      if (!autoGroupResult.success || !autoGroupResult.groupId) {
        return {
          success: false,
          error: autoGroupResult.error || '플랜 그룹 자동 생성에 실패했습니다.',
        };
      }

      effectivePlanGroupId = autoGroupResult.groupId;
      logActionDebug(
        { domain: 'admin-plan', action: 'createPlanFromContent' },
        '플랜그룹 자동 생성 완료',
        { groupId: effectivePlanGroupId }
      );
    }

    // flexible_content에서 content_type 및 master content IDs 조회
    const { data: flexibleContent, error: fetchError } = await supabase
      .from('flexible_contents')
      .select('content_type, master_book_id, master_lecture_id, master_custom_content_id')
      .eq('id', input.flexibleContentId)
      .single();

    if (fetchError || !flexibleContent) {
      return { success: false, error: '콘텐츠를 찾을 수 없습니다.' };
    }

    // Determine the actual content_id based on content_type
    // 마스터 콘텐츠가 연결된 경우 해당 ID 사용, 없으면 flexible_content_id를 content_id로 사용
    let contentId: string | null = null;
    if (flexibleContent.content_type === 'book') {
      contentId = flexibleContent.master_book_id;
    } else if (flexibleContent.content_type === 'lecture') {
      contentId = flexibleContent.master_lecture_id;
    } else if (flexibleContent.content_type === 'custom') {
      contentId = flexibleContent.master_custom_content_id;
    }

    // 마스터 콘텐츠가 없으면 content_id는 null로 유지 (flexible_content_id만 사용)
    // validate_content_reference 트리거가 content_id를 검증하므로 잘못된 값 전달 방지

    // 생성할 플랜 데이터 배열
    const plansToCreate: Array<Record<string, unknown>> = [];

    if (input.distributionMode === 'today') {
      // 오늘(Daily Dock)에 단일 플랜 추가
      let startTime: string | undefined;
      let endTime: string | undefined;

      // 스케줄러 활성화 시 자동 시간 배정
      if (input.useScheduler && input.plannerId) {
        const estimatedMinutes =
          input.estimatedMinutes ||
          calculateEstimatedMinutes(input.totalVolume, flexibleContent.content_type);

        const scheduleResult = await findAvailableTimeSlot({
          studentId: input.studentId,
          plannerId: input.plannerId,
          targetDate: input.targetDate,
          estimatedMinutes,
        });

        if (scheduleResult.success && scheduleResult.startTime && scheduleResult.endTime) {
          startTime = scheduleResult.startTime;
          endTime = scheduleResult.endTime;
          logActionDebug(
            { domain: 'admin-plan', action: 'createPlanFromContent' },
            '스케줄러로 시간 배정 완료',
            { startTime, endTime, estimatedMinutes }
          );
        } else {
          // 스케줄러 실패 시 시간 없이 생성 (graceful fallback)
          logActionDebug(
            { domain: 'admin-plan', action: 'createPlanFromContent' },
            '스케줄러 시간 배정 실패, 시간 없이 생성',
            { error: scheduleResult.error }
          );
        }
      }

      // 현재 날짜/컨테이너의 최대 sequence 조회 후 다음 값 설정
      const nextSequence = await getNextSequence(supabase, input.studentId, input.targetDate, 'daily');

      plansToCreate.push(createPlanRecord({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        planDate: input.targetDate,
        containerType: 'daily',
        startPage: input.rangeStart,
        endPage: input.rangeEnd,
        planGroupId: effectivePlanGroupId,
        startTime,
        endTime,
        now,
        sequence: nextSequence,
      }));
    } else if (input.distributionMode === 'weekly') {
      // Weekly Dock에 단일 플랜 추가
      // 현재 날짜/컨테이너의 최대 sequence 조회 후 다음 값 설정
      const nextSequence = await getNextSequence(supabase, input.studentId, input.targetDate, 'weekly');

      plansToCreate.push(createPlanRecord({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        planDate: input.targetDate,
        containerType: 'weekly',
        startPage: input.rangeStart,
        endPage: input.rangeEnd,
        planGroupId: effectivePlanGroupId,
        now,
        sequence: nextSequence,
      }));
    } else if (input.distributionMode === 'period' && input.periodEndDate) {
      // 기간에 걸쳐 분배
      const distributedPlans = distributeOverPeriod({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        periodEndDate: input.periodEndDate,
        planGroupId: effectivePlanGroupId,
        now,
      });
      plansToCreate.push(...distributedPlans);
    } else {
      return { success: false, error: '유효하지 않은 배치 방식입니다.' };
    }

    // 플랜 생성
    const { data, error } = await supabase
      .from('student_plan')
      .insert(plansToCreate)
      .select('id');

    if (error) {
      return { success: false, error: error.message };
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${input.studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    return {
      success: true,
      data: {
        createdPlanIds: data.map((d) => d.id),
        createdCount: data.length,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'createPlanFromContent' },
      error,
      {
        studentId: input.studentId,
        distributionMode: input.distributionMode,
        targetDate: input.targetDate,
      }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 생성 중 오류가 발생했습니다.',
    };
  }
}

/**
 * 단일 플랜 레코드 생성 헬퍼
 */
function createPlanRecord(params: {
  studentId: string;
  tenantId: string;
  contentType: string;
  contentId: string | null;
  flexibleContentId: string;
  contentTitle: string;
  contentSubject: string | null;
  planDate: string;
  containerType: ContainerType;
  startPage: number | null;
  endPage: number | null;
  customRangeDisplay?: string | null;
  totalVolume?: number | null;
  planGroupId?: string; // 플랜그룹 연결
  now: string;
  sequence?: number;
  // 스케줄러 시간 배정 (선택적)
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  // 학습 유형
  subjectType?: 'strategy' | 'weakness' | null;
}): Record<string, unknown> {
  // estimated_minutes 계산: 시간이 있으면 시간 기반, 없으면 볼륨 기반
  let estimatedMinutes: number | null = null;
  if (params.startTime && params.endTime) {
    estimatedMinutes = timeToMinutes(params.endTime) - timeToMinutes(params.startTime);
  } else if (params.totalVolume) {
    estimatedMinutes = Math.ceil(params.totalVolume * 1.5);
  }

  return {
    student_id: params.studentId,
    tenant_id: params.tenantId,
    block_index: 0,
    content_type: params.contentType,
    content_id: params.contentId,
    flexible_content_id: params.flexibleContentId,
    content_title: params.contentTitle,
    content_subject: params.contentSubject,
    plan_date: params.planDate,
    container_type: params.containerType,
    planned_start_page_or_time: params.startPage,
    planned_end_page_or_time: params.endPage,
    custom_range_display: params.customRangeDisplay,
    start_time: params.startTime || null,
    end_time: params.endTime || null,
    estimated_minutes: estimatedMinutes,
    plan_group_id: params.planGroupId || null, // 플랜그룹 연결
    subject_type: params.subjectType || null, // 학습 유형
    status: 'pending',
    is_active: true,
    sequence: params.sequence ?? 0,
    created_at: params.now,
    updated_at: params.now,
  };
}

/**
 * 기간에 걸쳐 플랜 분배
 */
function distributeOverPeriod(params: {
  studentId: string;
  tenantId: string;
  contentType: string;
  contentId: string | null;
  flexibleContentId: string;
  contentTitle: string;
  contentSubject: string | null;
  targetDate: string;
  periodEndDate: string;
  rangeStart: number | null;
  rangeEnd: number | null;
  customRangeDisplay?: string | null;
  totalVolume?: number | null;
  planGroupId?: string; // 플랜그룹 연결
  subjectType?: 'strategy' | 'weakness' | null; // 학습 유형
  now: string;
}): Array<Record<string, unknown>> {
  const plans: Array<Record<string, unknown>> = [];

  const startDate = new Date(params.targetDate + 'T00:00:00');
  const endDate = new Date(params.periodEndDate + 'T00:00:00');

  // 날짜 수 계산
  const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  if (dayCount <= 0) {
    return [];
  }

  // 범위가 있는 경우 분할
  const hasRange = params.rangeStart !== null && params.rangeEnd !== null;

  if (hasRange && params.rangeStart !== null && params.rangeEnd !== null) {
    const totalRange = params.rangeEnd - params.rangeStart + 1;
    const perDay = Math.ceil(totalRange / dayCount);

    let currentStart = params.rangeStart;

    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const planDate = date.toISOString().split('T')[0];

      const rangeEndForDay = Math.min(currentStart + perDay - 1, params.rangeEnd);

      if (currentStart <= params.rangeEnd) {
        plans.push(createPlanRecord({
          studentId: params.studentId,
          tenantId: params.tenantId,
          contentType: params.contentType,
          contentId: params.contentId,
          flexibleContentId: params.flexibleContentId,
          contentTitle: params.contentTitle,
          contentSubject: params.contentSubject,
          planDate,
          containerType: 'daily',
          startPage: currentStart,
          endPage: rangeEndForDay,
          customRangeDisplay: null,
          totalVolume: rangeEndForDay - currentStart + 1,
          planGroupId: params.planGroupId,
          subjectType: params.subjectType,
          now: params.now,
          sequence: i,
        }));

        currentStart = rangeEndForDay + 1;
      }
    }
  } else {
    // 범위 없이 각 날짜에 동일한 플랜 생성
    for (let i = 0; i < dayCount; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const planDate = date.toISOString().split('T')[0];

      plans.push(createPlanRecord({
        studentId: params.studentId,
        tenantId: params.tenantId,
        contentType: params.contentType,
        contentId: params.contentId,
        flexibleContentId: params.flexibleContentId,
        contentTitle: params.contentTitle,
        contentSubject: params.contentSubject,
        planDate,
        containerType: 'daily',
        startPage: params.rangeStart,
        endPage: params.rangeEnd,
        customRangeDisplay: params.customRangeDisplay,
        totalVolume: params.totalVolume,
        planGroupId: params.planGroupId,
        subjectType: params.subjectType,
        now: params.now,
        sequence: i,
      }));
    }
  }

  return plans;
}

/**
 * 스케줄러를 활용한 콘텐츠 기반 플랜 생성
 *
 * period 모드에서 플래너의 스케줄러 설정과 기존 타임라인을 고려하여
 * Best Fit 알고리즘으로 플랜을 생성
 *
 * @param input - 플랜 생성 입력
 * @returns 생성된 플랜 정보
 */
export async function createPlanFromContentWithScheduler(
  input: CreatePlanFromContentInput
): Promise<AdminPlanResponse<CreatePlanFromContentResult>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // period 모드가 아니면 기존 함수 사용
    if (input.distributionMode !== 'period' || !input.periodEndDate) {
      return createPlanFromContent(input);
    }

    logActionDebug(
      { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
      '스케줄러 기반 플랜 생성 시작',
      {
        plannerId: input.plannerId,
        studentId: input.studentId,
        distributionMode: input.distributionMode,
        targetDate: input.targetDate,
        periodEndDate: input.periodEndDate,
      }
    );

    // 1. 플랜 그룹 ID 결정 (자동 생성 또는 기존 사용)
    let effectivePlanGroupId: string | undefined = input.planGroupId;

    if (input.plannerId && !input.planGroupId) {
      const autoGroupResult = await createAutoContentPlanGroupAction({
        tenantId: input.tenantId,
        studentId: input.studentId,
        plannerId: input.plannerId,
        contentTitle: input.contentTitle,
        targetDate: input.targetDate,
        planPurpose: 'content',
      });

      if (!autoGroupResult.success || !autoGroupResult.groupId) {
        return {
          success: false,
          error: autoGroupResult.error || '플랜 그룹 자동 생성에 실패했습니다.',
        };
      }

      effectivePlanGroupId = autoGroupResult.groupId;
    }

    // 2. 플래너 기반 스케줄 생성
    const scheduleResult = await generateScheduleForPlanner(
      input.plannerId,
      input.targetDate,
      input.periodEndDate
    );

    if (!scheduleResult.success) {
      logActionError(
        { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
        new Error(scheduleResult.error || '스케줄 생성 실패'),
        { plannerId: input.plannerId }
      );
      // 스케줄 생성 실패 시 기존 로직으로 fallback
      return createPlanFromContent(input);
    }

    // 3. 기존 플랜 조회 (학생의 전체 플랜 조회하여 시간 충돌 방지)
    const existingPlans = await getExistingPlansForStudent(
      input.studentId,
      input.targetDate,
      input.periodEndDate
    );
    const existingPlansByDate = groupExistingPlansByDate(existingPlans);

    // 4. 기존 타임라인 반영 (기존 플랜 시간 제외)
    const adjustedDateTimeSlots = adjustDateTimeSlotsWithExistingPlans(
      scheduleResult.dateTimeSlots,
      existingPlansByDate
    );
    const adjustedDateAvailableTimeRanges = adjustDateAvailableTimeRangesWithExistingPlans(
      scheduleResult.dateAvailableTimeRanges,
      existingPlansByDate
    );

    // 5. flexible_content에서 content_type 및 master content IDs 조회
    const { data: flexibleContent, error: fetchError } = await supabase
      .from('flexible_contents')
      .select('content_type, master_book_id, master_lecture_id, master_custom_content_id')
      .eq('id', input.flexibleContentId)
      .single();

    if (fetchError || !flexibleContent) {
      return { success: false, error: '콘텐츠를 찾을 수 없습니다.' };
    }

    // content_id 결정
    let contentId: string | null = null;
    if (flexibleContent.content_type === 'book') {
      contentId = flexibleContent.master_book_id;
    } else if (flexibleContent.content_type === 'lecture') {
      contentId = flexibleContent.master_lecture_id;
    } else if (flexibleContent.content_type === 'custom') {
      contentId = flexibleContent.master_custom_content_id;
    }

    // 6. 플랜 그룹 정보 조회 (generatePlansFromGroup에 전달)
    const { data: planGroup, error: groupError } = await supabase
      .from('plan_groups')
      .select('*')
      .eq('id', effectivePlanGroupId)
      .single();

    if (groupError || !planGroup) {
      return { success: false, error: '플랜 그룹을 찾을 수 없습니다.' };
    }

    // 7. 플랜 그룹의 제외일, 학원일정, 블록 조회
    const { data: exclusions } = await supabase
      .from('plan_group_exclusions')
      .select('*')
      .eq('plan_group_id', effectivePlanGroupId);

    const { data: academySchedules } = await supabase
      .from('plan_group_academy_schedules')
      .select('*')
      .eq('plan_group_id', effectivePlanGroupId);

    let blocks: Array<{ day_of_week: number; start_time: string; end_time: string }> = [];
    if (planGroup.block_set_id) {
      const { data: blockData } = await supabase
        .from('tenant_block_set_items')
        .select('day_of_week, start_time, end_time')
        .eq('block_set_id', planGroup.block_set_id);

      if (blockData) {
        blocks = blockData;
      }
    }

    // 8. PlanContent 형식으로 변환
    const planContents = [
      {
        id: crypto.randomUUID(),
        plan_group_id: effectivePlanGroupId!,
        tenant_id: input.tenantId,
        content_type: flexibleContent.content_type as 'book' | 'lecture' | 'custom',
        content_id: contentId || input.flexibleContentId,
        start_range: input.rangeStart || 1,
        end_range: input.rangeEnd || 100,
        display_order: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    // 9. generatePlansFromGroup으로 Best Fit 알고리즘 적용
    // blocks는 dateAvailableTimeRanges가 없을 때만 fallback으로 사용됨
    // 우리가 adjustedDateAvailableTimeRanges를 전달하므로 빈 배열 전달
    // Phase 4: existingPlans를 ExistingPlanInfo[] 형식으로 변환
    const existingPlansForScheduler = existingPlans.map((p) => ({
      date: p.plan_date,
      start_time: p.start_time,
      end_time: p.end_time,
    }));
    const generateResult = await generatePlansFromGroup(
      planGroup,
      planContents,
      exclusions || [],
      academySchedules || [],
      [],
      undefined, // contentSubjects
      undefined, // riskIndexMap
      adjustedDateAvailableTimeRanges,
      adjustedDateTimeSlots as SchedulerDateTimeSlots,
      undefined, // contentDurationMap
      undefined, // contentChapterMap
      input.targetDate,
      input.periodEndDate,
      existingPlansForScheduler, // Phase 4: 기존 플랜 정보 전달
      {
        autoAdjustOverlaps: true,
        lunchTime: (() => {
          const raw = planGroup.lunch_time as Record<string, string> | null;
          if (!raw) return undefined;
          const start = raw.start_time || raw.start;
          const end = raw.end_time || raw.end;
          return (start && end) ? { start, end } : undefined;
        })(),
      } // Phase 4: 시간 충돌 자동 조정 + 점심시간 보호
    );
    const scheduledPlans = generateResult.plans;

    // 충돌 정보 로깅 (있는 경우)
    if (generateResult.overlapValidation?.hasOverlaps) {
      logActionDebug(
        { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
        `시간 충돌 감지: ${generateResult.overlapValidation.overlaps.length}건`,
        { totalOverlapMinutes: generateResult.overlapValidation.totalOverlapMinutes }
      );
    }

    if (scheduledPlans.length === 0) {
      logActionDebug(
        { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
        '스케줄러가 플랜을 생성하지 못함, 기존 로직으로 fallback',
        { reason: '사용 가능한 시간대 없음' }
      );
      // 스케줄러가 플랜을 생성하지 못한 경우 기존 로직으로 fallback
      return createPlanFromContent(input);
    }

    // 10. 플랜 저장
    const now = new Date().toISOString();
    const plansToInsert = scheduledPlans.map((plan, index) => ({
      student_id: input.studentId,
      tenant_id: input.tenantId,
      plan_group_id: effectivePlanGroupId,
      plan_date: plan.plan_date,
      block_index: plan.block_index || 0,
      content_type: flexibleContent.content_type,
      content_id: contentId,
      flexible_content_id: input.flexibleContentId,
      content_title: input.contentTitle,
      content_subject: input.contentSubject,
      planned_start_page_or_time: plan.planned_start_page_or_time,
      planned_end_page_or_time: plan.planned_end_page_or_time,
      start_time: plan.start_time,
      end_time: plan.end_time,
      estimated_minutes:
        plan.start_time && plan.end_time
          ? timeToMinutes(plan.end_time) - timeToMinutes(plan.start_time)
          : null,
      container_type: 'daily' as ContainerType,
      subject_type: input.subjectType || null, // 학습 유형
      status: 'pending',
      is_active: true,
      sequence: index,
      created_at: now,
      updated_at: now,
    }));

    const { data, error } = await supabase
      .from('student_plan')
      .insert(plansToInsert)
      .select('id');

    if (error) {
      logActionError(
        { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
        error,
        { plansToInsertCount: plansToInsert.length }
      );
      return { success: false, error: error.message };
    }

    // 경로 재검증
    revalidatePath(`/admin/students/${input.studentId}/plans`);
    revalidatePath('/today');
    revalidatePath('/plan');

    logActionDebug(
      { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
      '스케줄러 기반 플랜 생성 완료',
      { createdCount: data?.length || 0 }
    );

    return {
      success: true,
      data: {
        createdPlanIds: data?.map((d) => d.id) || [],
        createdCount: data?.length || 0,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'createPlanFromContentWithScheduler' },
      error,
      {
        studentId: input.studentId,
        distributionMode: input.distributionMode,
        targetDate: input.targetDate,
      }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : '플랜 생성 중 오류가 발생했습니다.',
    };
  }
}
