'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActionError } from '@/lib/logging/actionLogger';
import type {
  PlanEvent,
  PlanEventInsert,
  PlanEventFilters,
  AdminPlanResponse,
  PaginatedResponse,
  EventType,
  EventCategory,
} from '../types';

/**
 * 플랜 이벤트 생성 (내부용)
 * 모든 플랜 관련 변경사항을 이벤트로 기록
 */
export async function createPlanEvent(
  input: PlanEventInsert
): Promise<AdminPlanResponse<PlanEvent>> {
  try {
    const supabase = await createSupabaseServerClient();

    const eventData = {
      ...input,
      payload: input.payload ?? {},
      actor_type: input.actor_type ?? 'system',
      occurred_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('plan_events')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      logActionError({ domain: 'admin-plan', action: 'createPlanEvent' }, error, { input });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanEvent };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'createPlanEvent' }, error, { input });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 연관 이벤트 그룹 생성을 위한 correlation ID 생성
 */
export async function generateCorrelationId(): Promise<string> {
  return crypto.randomUUID();
}

/**
 * 배치 이벤트 생성 (여러 이벤트를 한번에 기록)
 */
export async function createPlanEvents(
  events: PlanEventInsert[],
  correlationId?: string
): Promise<AdminPlanResponse<PlanEvent[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    const corrId = correlationId ?? await generateCorrelationId();

    const eventsData = events.map((event) => ({
      ...event,
      payload: event.payload ?? {},
      actor_type: event.actor_type ?? 'system',
      correlation_id: corrId,
      occurred_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('plan_events')
      .insert(eventsData)
      .select();

    if (error) {
      logActionError({ domain: 'admin-plan', action: 'createPlanEvents' }, error, { eventCount: events.length, correlationId });
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanEvent[] };
  } catch (error) {
    logActionError({ domain: 'admin-plan', action: 'createPlanEvents' }, error, { eventCount: events.length, correlationId });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 플랜 이벤트 목록 조회
 */
export async function getPlanEvents(
  filters?: PlanEventFilters,
  page = 1,
  pageSize = 50
): Promise<AdminPlanResponse<PaginatedResponse<PlanEvent>>> {
  try {
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from('plan_events')
      .select('*', { count: 'exact' })
      .order('occurred_at', { ascending: false });

    // 필터 적용
    if (filters?.student_id) {
      query = query.eq('student_id', filters.student_id);
    }
    if (filters?.plan_group_id) {
      query = query.eq('plan_group_id', filters.plan_group_id);
    }
    if (filters?.event_type) {
      query = query.eq('event_type', filters.event_type);
    }
    if (filters?.event_category) {
      query = query.eq('event_category', filters.event_category);
    }
    if (filters?.actor_type) {
      query = query.eq('actor_type', filters.actor_type);
    }
    if (filters?.date_from) {
      query = query.gte('occurred_at', filters.date_from);
    }
    if (filters?.date_to) {
      query = query.lte('occurred_at', filters.date_to);
    }

    // 페이지네이션 적용
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        data: data as PlanEvent[],
        total: count ?? 0,
        page,
        page_size: pageSize,
        has_more: count ? from + pageSize < count : false,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 특정 플랜 그룹의 이벤트 히스토리 조회
 */
export async function getPlanGroupEventHistory(
  planGroupId: string,
  limit = 100
): Promise<AdminPlanResponse<PlanEvent[]>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('plan_events')
      .select('*')
      .eq('plan_group_id', planGroupId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanEvent[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 특정 학생의 최근 이벤트 조회
 */
export async function getStudentRecentEvents(
  studentId: string,
  limit = 50
): Promise<AdminPlanResponse<PlanEvent[]>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('plan_events')
      .select('*')
      .eq('student_id', studentId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanEvent[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 연관된 이벤트 그룹 조회 (correlation_id 기반)
 */
export async function getCorrelatedEvents(
  correlationId: string
): Promise<AdminPlanResponse<PlanEvent[]>> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('plan_events')
      .select('*')
      .eq('correlation_id', correlationId)
      .order('occurred_at', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PlanEvent[] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 이벤트 타입별 통계 조회
 */
export async function getEventStats(
  studentId: string,
  dateFrom: string,
  dateTo: string
): Promise<
  AdminPlanResponse<{
    by_type: Record<EventType, number>;
    by_category: Record<EventCategory, number>;
    total: number;
  }>
> {
  try {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('plan_events')
      .select('event_type, event_category')
      .eq('student_id', studentId)
      .gte('occurred_at', dateFrom)
      .lte('occurred_at', dateTo);

    if (error) {
      return { success: false, error: error.message };
    }

    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    for (const event of data ?? []) {
      byType[event.event_type] = (byType[event.event_type] ?? 0) + 1;
      byCategory[event.event_category] =
        (byCategory[event.event_category] ?? 0) + 1;
    }

    return {
      success: true,
      data: {
        by_type: byType as Record<EventType, number>,
        by_category: byCategory as Record<EventCategory, number>,
        total: data?.length ?? 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// 헬퍼 함수들 (특정 이벤트 타입 생성 간소화)
// ============================================

/**
 * 플랜 완료 이벤트 생성
 */
export async function logPlanCompleted(
  tenantId: string,
  studentId: string,
  studentPlanId: string,
  completedData: Record<string, unknown>,
  actorId?: string,
  actorType: 'student' | 'admin' = 'student'
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: studentPlanId,
    event_type: 'plan_completed',
    event_category: 'progress',
    payload: completedData,
    actor_id: actorId,
    actor_type: actorType,
  });
}

/**
 * 볼륨 조정 이벤트 생성
 */
export async function logVolumeAdjusted(
  tenantId: string,
  studentId: string,
  planGroupId: string,
  adjustmentData: {
    original_volume: number;
    new_volume: number;
    affected_plans: string[];
    reason?: string;
  },
  actorId?: string
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: planGroupId,
    event_type: 'volume_adjusted',
    event_category: 'volume',
    payload: adjustmentData,
    actor_id: actorId,
    actor_type: 'admin',
  });
}

/**
 * 재분배 이벤트 생성
 */
export async function logVolumeRedistributed(
  tenantId: string,
  studentId: string,
  planGroupId: string,
  redistributionData: {
    mode: 'auto' | 'manual' | 'weekly_dock' | 'weekly' | 'bulk_move';
    total_redistributed: number;
    affected_dates: string[];
    changes: Array<{
      plan_id: string;
      date: string;
      original: number;
      new: number;
    }>;
  },
  actorId?: string,
  correlationId?: string
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    plan_group_id: planGroupId,
    event_type: 'volume_redistributed',
    event_category: 'volume',
    payload: redistributionData,
    actor_id: actorId,
    actor_type: 'admin',
    correlation_id: correlationId,
  });
}

/**
 * 플랜 이월 이벤트 생성
 */
export async function logPlanCarryover(
  tenantId: string,
  studentId: string,
  studentPlanId: string,
  carryoverData: {
    from_date: string;
    to_date: string;
    carryover_count: number;
    remaining_volume: number;
  }
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: studentPlanId,
    event_type: 'plan_carryover',
    event_category: 'plan_item',
    payload: carryoverData,
    actor_type: 'system',
  });
}

/**
 * 타이머 시작 이벤트 생성
 */
export async function logTimerStarted(
  tenantId: string,
  studentId: string,
  studentPlanId: string,
  timerData: {
    started_at: string;
    plan_title?: string;
  }
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: studentPlanId,
    event_type: 'timer_started',
    event_category: 'progress',
    payload: timerData,
    actor_id: studentId,
    actor_type: 'student',
  });
}

/**
 * 타이머 완료 이벤트 생성
 */
export async function logTimerCompleted(
  tenantId: string,
  studentId: string,
  studentPlanId: string,
  timerData: {
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    pause_count: number;
    paused_duration_seconds: number;
  }
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: studentPlanId,
    event_type: 'timer_completed',
    event_category: 'progress',
    payload: timerData,
    actor_id: studentId,
    actor_type: 'student',
  });
}

/**
 * 컨테이너 이동 이벤트 생성
 */
export async function logContainerMoved(
  tenantId: string,
  studentId: string,
  planId: string,
  moveData: {
    from_container: 'unfinished' | 'daily' | 'weekly';
    to_container: 'unfinished' | 'daily' | 'weekly';
    plan_type: 'plan' | 'adhoc';
    plan_title?: string;
    plan_date?: string;
  },
  actorId?: string
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: planId,
    event_type: 'container_moved',
    event_category: 'plan_item',
    payload: moveData,
    actor_id: actorId,
    actor_type: 'admin',
  });
}

/**
 * 플랜 삭제 이벤트 생성
 */
export async function logPlanDeleted(
  tenantId: string,
  studentId: string,
  planId: string,
  deleteData: {
    plan_type: 'plan' | 'adhoc';
    plan_title?: string;
    reason?: string;
  },
  actorId?: string
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: planId,
    event_type: 'plan_deleted',
    event_category: 'plan_item',
    payload: deleteData,
    actor_id: actorId,
    actor_type: 'admin',
  });
}

/**
 * 플랜 생성 이벤트 생성
 */
export async function logPlanCreated(
  tenantId: string,
  studentId: string,
  planId: string,
  createData: {
    plan_type: 'flexible_content' | 'adhoc';
    title: string;
    container_type: 'daily' | 'weekly';
    plan_date?: string;
    content_type?: string;
    range_info?: string;
  },
  actorId?: string
): Promise<AdminPlanResponse<PlanEvent>> {
  return createPlanEvent({
    tenant_id: tenantId,
    student_id: studentId,
    student_plan_id: planId,
    event_type: 'plan_created',
    event_category: 'plan_item',
    payload: createData,
    actor_id: actorId,
    actor_type: 'admin',
  });
}
