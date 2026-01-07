'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse, ContainerType } from '../types';

export type DistributionMode = 'today' | 'period' | 'weekly';

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
      plansToCreate.push(createPlanRecord({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        planDate: input.targetDate,
        containerType: 'daily',
        startPage: input.rangeStart,
        endPage: input.rangeEnd,
        now,
      }));
    } else if (input.distributionMode === 'weekly') {
      // Weekly Dock에 단일 플랜 추가
      plansToCreate.push(createPlanRecord({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        planDate: input.targetDate,
        containerType: 'weekly',
        startPage: input.rangeStart,
        endPage: input.rangeEnd,
        now,
      }));
    } else if (input.distributionMode === 'period' && input.periodEndDate) {
      // 기간에 걸쳐 분배
      const distributedPlans = distributeOverPeriod({
        ...input,
        contentType: flexibleContent.content_type,
        contentId: contentId,
        periodEndDate: input.periodEndDate,
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
  now: string;
  sequence?: number;
}): Record<string, unknown> {
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
    estimated_minutes: params.totalVolume ? Math.ceil(params.totalVolume * 1.5) : null, // 기본 예상 시간
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
        now: params.now,
        sequence: i,
      }));
    }
  }

  return plans;
}
