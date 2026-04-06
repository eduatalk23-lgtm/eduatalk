'use server';

/**
 * Calendar Event Server Actions
 *
 * calendar_events 테이블에 대한 CRUD 및 반복 이벤트 처리.
 * 플랜/비학습시간/이벤트를 통합 관리합니다.
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { getCachedAuthUser } from '@/lib/auth/cachedGetUser';
import { logActionError, logActionDebug } from '@/lib/logging/actionLogger';
import { calculateUnifiedReorder } from '@/lib/domains/plan/utils/unifiedReorderCalculation';
import { revalidatePath } from 'next/cache';
import { invalidateCalendarSchedule } from '@/lib/cache/calendarCache';
import { extractTimeHHMM, extractDateYMD } from '../adapters';
import { shiftTimestamp, shiftEndDate, buildSplitRRules } from '../rrule';
import type { EventStatus, ContainerType } from '../types';
import type { AdminPlanResponse } from '@/lib/domains/admin-plan/types';
import type {
  TimelineItem,
  UnifiedReorderInput,
  ReorderResult,
} from '@/lib/types/unifiedTimeline';

// ============================================
// 권한 검증: 학생은 관리자 이벤트 수정 불가
// ============================================

/**
 * 학생이 관리자가 만든 이벤트를 수정/삭제하려는지 검증.
 * 관리자/컨설턴트는 모든 이벤트 수정 가능.
 * @returns true if allowed, throws error if not
 */
async function assertCanModifyEvent(eventId: string): Promise<void> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return; // 미인증 → RLS가 차단
  if (currentUser.role !== 'student') return; // 관리자/컨설턴트는 항상 허용

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('calendar_events')
    .select('creator_role')
    .eq('id', eventId)
    .single();

  if (data?.creator_role === 'admin') {
    throw new Error('학생은 선생님이 등록한 일정을 수정할 수 없습니다.');
  }
}

// ============================================
// Status 매핑
// ============================================

function mapPlanStatusToEventStatus(status: string): EventStatus {
  switch (status) {
    case 'cancelled':
    case 'skipped':
      return 'cancelled';
    case 'in_progress':
    case 'draft':
      return 'tentative';
    case 'completed': // Task 완료는 event_study_data.done으로 분리, 이벤트는 confirmed 유지
    case 'pending':
    default:
      return 'confirmed';
  }
}

// ============================================
// deletePlan → soft delete calendar_event
// ============================================

interface DeletePlanParams {
  planId: string;
  skipRevalidation?: boolean;
}

interface DeletePlanResult {
  success: boolean;
  error?: string;
}

export async function deletePlan({
  planId,
}: DeletePlanParams): Promise<DeletePlanResult> {
  try {
    await assertCanModifyEvent(planId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
      .eq('id', planId)
      .is('deleted_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// restoreEvent → undo soft delete
// ============================================

export async function restoreEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanModifyEvent(eventId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: null, status: 'confirmed' })
      .eq('id', eventId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// updateEventColor → update calendar_event.color
// ============================================

export async function updateEventColor(
  eventId: string,
  color: string | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanModifyEvent(eventId);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('calendar_events')
      .update({ color })
      .eq('id', eventId);
    if (error) throw error;
    return { success: true };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'updateEventColor' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// updatePlanStatus → update calendar_event status
// ============================================

interface UpdatePlanStatusParams {
  planId: string;
  status: string;
  skipRevalidation?: boolean;
  /** 반복 이벤트 인스턴스 날짜 (YYYY-MM-DD). 제공 시 개별 인스턴스만 완료 처리 */
  instanceDate?: string;
}

interface UpdatePlanStatusResult {
  success: boolean;
  error?: string;
}

export async function updatePlanStatus({
  planId,
  status,
  instanceDate,
}: UpdatePlanStatusParams): Promise<UpdatePlanStatusResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const eventStatus = mapPlanStatusToEventStatus(status);
    const done = status === 'completed';
    const now = new Date().toISOString();

    // ── 반복 이벤트 감지: instanceDate가 있으면 개별 인스턴스 처리 ──
    if (instanceDate) {
      const { data: event } = await supabase
        .from('calendar_events')
        .select('id, rrule, is_exception')
        .eq('id', planId)
        .is('deleted_at', null)
        .maybeSingle();

      if (event?.rrule && !event.is_exception) {
        // 반복 부모 → exception을 찾거나 생성하여 개별 완료 처리
        return updateRecurringInstanceStatus({
          supabase,
          parentId: planId,
          instanceDate,
          eventStatus,
          done,
          now,
        });
      }
    }

    // ── 비반복 이벤트 또는 이미 exception인 경우: 기존 로직 ──

    // 1. 이벤트 상태 업데이트 + 소유권 검증 (RLS + select으로 실제 매칭 확인)
    const { data: updated, error } = await supabase
      .from('calendar_events')
      .update({ status: eventStatus })
      .eq('id', planId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!updated) return { success: false, error: '이벤트를 찾을 수 없거나 권한이 없습니다.' };

    // 2~3: Admin Client 사용 (event_study_data는 학생에게 SELECT-only RLS)
    const admin = createSupabaseAdminClient();
    if (!admin) {
      return { success: false, error: 'Admin client unavailable' };
    }

    // 2. Task 완료 상태 업데이트 (event_study_data.done)
    //    UPSERT: event_study_data 행이 없을 경우 자동 생성
    let doneBy: string | null = null;
    if (done) {
      const user = await getCachedAuthUser();
      doneBy = user?.id ?? 'unknown';
    }

    const { error: studyError } = await admin
      .from('event_study_data')
      .upsert(
        {
          event_id: planId,
          done,
          done_at: done ? now : null,
          done_by: doneBy,
        },
        { onConflict: 'event_id' }
      );

    if (studyError) {
      logActionError({ domain: 'calendar', action: 'updatePlanStatus.studyData' }, studyError);
      return { success: false, error: `완료 상태 저장 실패: ${studyError.message}` };
    }

    // 3. student_plan 동기화 (학생 Today 페이지가 student_plan에서 상태를 읽음)
    const { error: planError } = await admin
      .from('student_plan')
      .update({
        status,
        actual_end_time: done ? now : null,
        updated_at: now,
      })
      .eq('id', planId);

    if (planError) {
      logActionError({ domain: 'calendar', action: 'updatePlanStatus.studentPlan' }, planError);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * 반복 이벤트의 개별 인스턴스 완료/미완료 처리
 * 기존 exception이 있으면 업데이트, 없으면 createRecurringException으로 생성 후 업데이트
 */
async function updateRecurringInstanceStatus({
  supabase,
  parentId,
  instanceDate,
  eventStatus,
  done,
  now,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  parentId: string;
  instanceDate: string;
  eventStatus: string;
  done: boolean;
  now: string;
}): Promise<UpdatePlanStatusResult> {
  // 1. 해당 날짜의 기존 exception 검색
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('recurring_event_id', parentId)
    .eq('is_exception', true)
    .is('deleted_at', null)
    .or(`start_date.eq.${instanceDate},start_at.like.${instanceDate}%`)
    .maybeSingle();

  let targetEventId: string;

  if (existing) {
    targetEventId = existing.id;
    // exception 상태 업데이트
    const { error } = await supabase
      .from('calendar_events')
      .update({ status: eventStatus })
      .eq('id', targetEventId);
    if (error) return { success: false, error: error.message };
  } else {
    // 새 exception 생성 (study data는 아래에서 직접 올바른 done 상태로 생성)
    const result = await createRecurringException({
      parentEventId: parentId,
      instanceDate,
      overrides: { status: eventStatus },
      skipStudyData: true,
      skipAuthCheck: true, // status 변경(학습 완료)은 학생에게 허용
    });
    if (!result.success || !result.eventId) {
      return { success: false, error: result.error ?? 'Exception 생성 실패' };
    }
    targetEventId = result.eventId;
  }

  // 2. Admin Client로 event_study_data 업데이트
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return { success: false, error: 'Admin client unavailable' };
  }

  let doneBy: string | null = null;
  if (done) {
    const user = await getCachedAuthUser();
    doneBy = user?.id ?? 'unknown';
  }

  const { error: studyError } = await admin
    .from('event_study_data')
    .upsert(
      {
        event_id: targetEventId,
        done,
        done_at: done ? now : null,
        done_by: doneBy,
      },
      { onConflict: 'event_id' }
    );

  if (studyError) {
    logActionError({ domain: 'calendar', action: 'updatePlanStatus.recurringStudyData' }, studyError);
    return { success: false, error: `완료 상태 저장 실패: ${studyError.message}` };
  }

  return { success: true };
}

// ============================================
// movePlanToContainer → update container_type + date
// ============================================

interface MovePlanToContainerParams {
  planId: string;
  /** dock 컴포넌트 시그니처 */
  targetContainer?: ContainerType;
  targetDate?: string;
  skipRevalidation?: boolean;
  /** admin 컴포넌트 시그니처 (targetContainer 대체) */
  planType?: 'plan' | 'adhoc';
  fromContainer?: ContainerType;
  toContainer?: ContainerType;
  studentId?: string;
  tenantId?: string;
}

interface MovePlanToContainerResult {
  success: boolean;
  error?: string;
}

export async function movePlanToContainer({
  planId,
  targetContainer,
  toContainer,
  targetDate,
}: MovePlanToContainerParams): Promise<MovePlanToContainerResult> {
  try {
    await assertCanModifyEvent(planId);
    const supabase = await createSupabaseServerClient();

    // targetContainer (dock) 또는 toContainer (admin) 중 하나 사용
    const effectiveContainer = targetContainer ?? toContainer;
    if (!effectiveContainer) {
      return { success: false, error: 'targetContainer or toContainer is required' };
    }

    const updateData: Record<string, unknown> = {
      container_type: effectiveContainer,
    };

    // 날짜 변경 시 start_at/end_at/start_date 모두 업데이트
    if (targetDate) {
      // 기존 이벤트 조회하여 시간 정보 유지
      const { data: event } = await supabase
        .from('calendar_events')
        .select('start_at, end_at, is_all_day, start_date')
        .eq('id', planId)
        .single();

      if (event?.is_all_day) {
        updateData.start_date = targetDate;
        updateData.end_date = targetDate;
      } else if (event?.start_at) {
        // KST 기준으로 시간/날짜 추출 (UTC split('T')[0]은 KST와 다를 수 있음)
        const startTimeKST = extractTimeHHMM(event.start_at) ?? '09:00';
        const originalDateKST = extractDateYMD(event.start_at) ?? event.start_date ?? targetDate;

        // KST 타임존으로 새 timestamp 구성 (movePlanToDate와 동일 방식)
        // timed 이벤트(is_all_day=false)는 start_date가 NULL이어야 함 (chk_event_time_consistency)
        updateData.start_at = `${targetDate}T${startTimeKST}:00+09:00`;

        // end_at: KST 시간 유지, 날짜만 교체
        if (event.end_at) {
          const endTimeKST = extractTimeHHMM(event.end_at) ?? '10:00';
          const endDateKST = extractDateYMD(event.end_at);

          if (!endDateKST || endDateKST === originalDateKST) {
            // 같은 날 이벤트: targetDate로 이동
            updateData.end_at = `${targetDate}T${endTimeKST}:00+09:00`;
          } else {
            // 멀티데이 이벤트: 날짜 차이 유지
            const dayDiff = Math.round(
              (new Date(endDateKST + 'T00:00:00').getTime() - new Date(originalDateKST + 'T00:00:00').getTime())
              / (1000 * 60 * 60 * 24)
            );
            const newEndDate = new Date(targetDate + 'T00:00:00');
            newEndDate.setDate(newEndDate.getDate() + dayDiff);
            const yyyy = newEndDate.getFullYear();
            const mm = (newEndDate.getMonth() + 1).toString().padStart(2, '0');
            const dd = newEndDate.getDate().toString().padStart(2, '0');
            updateData.end_at = `${yyyy}-${mm}-${dd}T${endTimeKST}:00+09:00`;
          }
        }
      } else {
        updateData.start_date = targetDate;
      }
    }

    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', planId)
      .is('deleted_at', null);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// updateItemTime → update start_at/end_at + estimated_minutes
// ============================================

interface UpdateItemTimeParams {
  studentId: string;
  calendarId: string;
  planDate: string;
  itemId: string;
  itemType: 'plan' | 'nonStudy';
  newStartTime: string;    // HH:mm
  newEndTime: string;       // HH:mm
  recordId?: string;
  estimatedMinutes?: number;
}

interface UpdateItemTimeResult {
  success: boolean;
  error?: string;
}

export async function updateItemTime({
  planDate,
  itemId,
  newStartTime,
  newEndTime,
  estimatedMinutes,
}: UpdateItemTimeParams): Promise<UpdateItemTimeResult> {
  try {
    await assertCanModifyEvent(itemId);
    const supabase = await createSupabaseServerClient();

    // HH:mm → ISO timestamp (KST)
    const startAt = `${planDate}T${newStartTime}:00+09:00`;
    const endAt = `${planDate}T${newEndTime}:00+09:00`;

    const { error: eventError } = await supabase
      .from('calendar_events')
      .update({ start_at: startAt, end_at: endAt })
      .eq('id', itemId)
      .is('deleted_at', null);

    if (eventError) return { success: false, error: eventError.message };

    // estimated_minutes는 event_study_data에 저장
    if (estimatedMinutes !== undefined) {
      await supabase
        .from('event_study_data')
        .update({ estimated_minutes: estimatedMinutes })
        .eq('event_id', itemId);
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================
// deletePlanWithLogging → soft delete (admin 호환)
// ============================================

interface DeletePlanWithLoggingParams {
  planId: string;
  planType: 'plan' | 'adhoc';
  studentId: string;
  tenantId: string;
  reason?: string;
}

export async function deletePlanWithLogging({
  planId,
}: DeletePlanWithLoggingParams): Promise<{ success: boolean; error?: string }> {
  // 내부적으로 soft-delete (deletePlan과 동일 로직)
  return deletePlan({ planId });
}

// ============================================
// executeUnifiedReorder → calendar_events 일괄 업데이트
// ============================================

interface UnifiedReorderResult {
  success: boolean;
  mode?: 'push' | 'pull';
  error?: string;
}

// ============================================
// Recurring Event: createRecurringException
// ============================================

/**
 * 반복 이벤트의 단일 인스턴스 예외(exception) 레코드를 생성합니다.
 *
 * 부모 이벤트를 복사하되 rrule=null, is_exception=true로 설정하고
 * overrides를 적용합니다. 부모 exdates에 instanceDate를 추가합니다.
 */
export async function createRecurringException(params: {
  parentEventId: string;
  instanceDate: string;
  overrides?: Record<string, unknown>;
  /** true면 event_study_data 생성을 건너뜀 (호출자가 직접 처리) */
  skipStudyData?: boolean;
  /** true면 권한 검증을 건너뜀 (status 변경 등 학생에게 허용된 작업) */
  skipAuthCheck?: boolean;
}): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    if (!params.skipAuthCheck) await assertCanModifyEvent(params.parentEventId);
    const supabase = await createSupabaseServerClient();

    // 부모 이벤트 조회
    const { data: parent, error: fetchError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', params.parentEventId)
      .single();

    if (fetchError || !parent) {
      return { success: false, error: fetchError?.message ?? '부모 이벤트를 찾을 수 없습니다.' };
    }

    // 부모의 원본 날짜 (dtstart) — KST 기준으로 추출 (UTC split('T')[0]은 새벽 KST에서 전날 반환)
    const parentDate = parent.start_date ?? extractDateYMD(parent.start_at) ?? '';

    // 시간 시프트: KST 날짜 차이 기반으로 정확히 시프트
    const shiftTs = (ts: string | null) => {
      if (!ts || !parentDate) return ts;
      return shiftTimestamp(ts, parentDate, params.instanceDate);
    };

    // exception 레코드 삽입
    const {
      id: _id,
      created_at: _ca,
      updated_at: _ua,
      deleted_at: _da,
      ...parentFields
    } = parent;

    const exceptionData = {
      ...parentFields,
      rrule: null,
      is_exception: true,
      recurring_event_id: params.parentEventId,
      original_start_at: shiftTs(parent.start_at),
      start_at: shiftTs(parent.start_at),
      end_at: shiftTs(parent.end_at),
      start_date: parent.start_date ? params.instanceDate : null,
      end_date: parent.end_date && parent.start_date
        ? shiftEndDate(parent.start_date, parent.end_date, params.instanceDate)
        : null,
      exdates: null,
      ...(params.overrides ?? {}),
    };

    // DB constraint: chk_event_time_consistency 강제
    // is_all_day=false → start_date/end_date NULL, is_all_day=true → start_at/end_at NULL
    if (exceptionData.is_all_day) {
      exceptionData.start_at = null;
      exceptionData.end_at = null;
    } else {
      exceptionData.start_date = null;
      exceptionData.end_date = null;
    }

    // exception insert + study_data prefetch 병렬 실행
    const needsStudyData = parent.is_task && !params.skipStudyData;
    const [insertResult, studyFetchResult] = await Promise.all([
      supabase
        .from('calendar_events')
        .insert(exceptionData)
        .select('id')
        .single(),
      needsStudyData
        ? supabase
            .from('event_study_data')
            .select('*')
            .eq('event_id', params.parentEventId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (insertResult.error) return { success: false, error: insertResult.error.message };
    const inserted = insertResult.data;

    // study_data insert + exdates update 병렬 실행
    const pendingOps: PromiseLike<unknown>[] = [];

    // study_data 복사
    if (needsStudyData && inserted?.id) {
      const parentStudy = studyFetchResult.data;
      if (parentStudy) {
        const { id: _sid, event_id: _eid, done: _d, done_at: _da2, done_by: _db, ...studyFields } = parentStudy;
        pendingOps.push(
          supabase.from('event_study_data').insert({
            ...studyFields,
            event_id: inserted.id,
            done: false,
            done_at: null,
            done_by: null,
          })
        );
      } else {
        pendingOps.push(
          supabase.from('event_study_data').insert({ event_id: inserted.id })
        );
      }
    }

    // 부모 exdates에 instanceDate 추가
    const currentExdates: string[] = (parent.exdates as string[]) ?? [];
    if (!currentExdates.includes(params.instanceDate)) {
      pendingOps.push(
        supabase
          .from('calendar_events')
          .update({ exdates: [...currentExdates, params.instanceDate] })
          .eq('id', params.parentEventId)
          .then(({ error: exdateError }) => {
            if (exdateError) {
              logActionError({ domain: 'calendar', action: 'createRecurringException' }, exdateError);
            }
          })
      );
    }

    if (pendingOps.length > 0) await Promise.all(pendingOps);

    return { success: true, eventId: inserted.id };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'createRecurringException' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// Recurring Event: deleteRecurringEvent
// ============================================

export type RecurringScope = 'this' | 'this_and_following' | 'all';

interface DeleteRecurringParams {
  eventId: string;
  scope: RecurringScope;
  instanceDate: string;
}

interface DeleteRecurringResult {
  success: boolean;
  deletedEventIds: string[];
  previousExdates?: string[] | null;
  previousRrule?: string | null;
  error?: string;
}

/**
 * 반복 이벤트를 scope별로 삭제합니다.
 *
 * - `this`: 부모 exdates에 instanceDate 추가. 기존 exception이면 soft-delete.
 * - `this_and_following`: 부모 RRULE에 UNTIL 추가 (instanceDate 전날). 이후 exception들 soft-delete.
 * - `all`: 부모 + 모든 exception soft-delete.
 */
export async function deleteRecurringEvent({
  eventId,
  scope,
  instanceDate,
}: DeleteRecurringParams): Promise<DeleteRecurringResult> {
  try {
    await assertCanModifyEvent(eventId);
    const supabase = await createSupabaseServerClient();
    const deletedEventIds: string[] = [];

    // 이벤트 조회 — exception이면 부모 ID 추적
    const { data: event, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, rrule, recurring_event_id, is_exception, exdates, start_date, start_at')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return { success: false, deletedEventIds: [], error: fetchError?.message ?? '이벤트를 찾을 수 없습니다.' };
    }

    const parentId = event.is_exception ? (event.recurring_event_id ?? eventId) : eventId;
    const isParent = parentId === eventId;

    // 부모 이벤트 조회 (exception인 경우)
    let parentRrule = event.rrule;
    let parentExdates = (event.exdates as string[]) ?? [];
    let parentStartDate = event.start_date ?? extractDateYMD(event.start_at) ?? '';
    if (!isParent) {
      const { data: parent } = await supabase
        .from('calendar_events')
        .select('rrule, exdates, start_date, start_at')
        .eq('id', parentId)
        .single();
      if (parent) {
        parentRrule = parent.rrule;
        parentExdates = (parent.exdates as string[]) ?? [];
        parentStartDate = parent.start_date ?? extractDateYMD(parent.start_at) ?? '';
      }
    }

    const previousExdates = [...parentExdates];
    const previousRrule = parentRrule;

    if (scope === 'this') {
      // 부모 exdates에 instanceDate 추가
      if (!parentExdates.includes(instanceDate)) {
        await supabase
          .from('calendar_events')
          .update({ exdates: [...parentExdates, instanceDate] })
          .eq('id', parentId);
      }

      // 기존 exception 레코드가 있으면 soft-delete
      if (!isParent && event.is_exception) {
        await supabase
          .from('calendar_events')
          .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
          .eq('id', eventId);
        deletedEventIds.push(eventId);
      } else {
        // 확장 인스턴스: exception 레코드가 있을 수 있음
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('recurring_event_id', parentId)
          .eq('is_exception', true)
          .is('deleted_at', null)
          .or(`start_date.eq.${instanceDate},start_at.like.${instanceDate}%`);

        if (existing && existing.length > 0) {
          for (const exc of existing) {
            await supabase
              .from('calendar_events')
              .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
              .eq('id', exc.id);
            deletedEventIds.push(exc.id);
          }
        }
      }
    } else if (scope === 'this_and_following') {
      // buildSplitRRules로 부모 RRULE 분할 (COUNT 보정 포함)
      if (parentRrule && parentStartDate) {
        const { parentRrule: truncatedRrule } = buildSplitRRules(parentRrule, parentStartDate, instanceDate);
        await supabase
          .from('calendar_events')
          .update({ rrule: truncatedRrule })
          .eq('id', parentId);
      }

      // instanceDate 이후의 exception 레코드 모두 soft-delete
      const { data: exceptions } = await supabase
        .from('calendar_events')
        .select('id, start_date, start_at')
        .eq('recurring_event_id', parentId)
        .eq('is_exception', true)
        .is('deleted_at', null);

      if (exceptions) {
        const idsToDelete = exceptions
          .filter((exc) => {
            const excDate = exc.start_date ?? extractDateYMD(exc.start_at) ?? '';
            return excDate >= instanceDate;
          })
          .map((exc) => exc.id);

        if (idsToDelete.length > 0) {
          await supabase
            .from('calendar_events')
            .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
            .in('id', idsToDelete);
          deletedEventIds.push(...idsToDelete);
        }
      }
    } else if (scope === 'all') {
      // 부모 soft-delete
      await supabase
        .from('calendar_events')
        .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
        .eq('id', parentId);
      deletedEventIds.push(parentId);

      // 모든 exception 레코드 soft-delete
      const { data: exceptions } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('recurring_event_id', parentId)
        .eq('is_exception', true)
        .is('deleted_at', null);

      if (exceptions && exceptions.length > 0) {
        const excIds = exceptions.map((exc) => exc.id);
        await supabase
          .from('calendar_events')
          .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
          .in('id', excIds);
        deletedEventIds.push(...excIds);
      }
    }

    return { success: true, deletedEventIds, previousExdates, previousRrule };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'deleteRecurringEvent' }, err);
    return { success: false, deletedEventIds: [], error: String(err) };
  }
}

// ============================================
// Recurring Event: updateRecurringEvent
// ============================================

interface UpdateRecurringParams {
  eventId: string;
  scope: RecurringScope;
  instanceDate: string;
  updates: Record<string, unknown>;
}

interface UpdateRecurringResult {
  success: boolean;
  error?: string;
}

/**
 * 반복 이벤트를 scope별로 수정합니다.
 *
 * - `this`: exception 생성/수정 (해당 인스턴스만 변경)
 * - `this_and_following`: 부모 UNTIL 추가 → 새 시리즈 생성
 * - `all`: 부모 직접 수정 + 모든 exception soft-delete
 */
/**
 * updates에서 calendar_events 테이블 컬럼만 분리하고,
 * event_study_data 관련 가상 필드를 별도 추출.
 */
function separateEventUpdates(updates: Record<string, unknown>) {
  const {
    has_study_data,
    subject_category,
    planned_start_page,
    planned_end_page,
    estimated_minutes,
    ...eventFields
  } = updates;

  // label → event_subtype dual-write
  if (eventFields.label !== undefined) {
    eventFields.event_subtype = eventFields.label;
  }

  return {
    eventFields,
    studyFields: { subject_category, planned_start_page, planned_end_page, estimated_minutes },
    hasStudyData: has_study_data as boolean | undefined,
  };
}

/**
 * 이벤트의 event_study_data lifecycle을 관리합니다.
 * has_study_data 변경 시 event_study_data 행 생성/삭제 + 학습 필드 업데이트.
 */
async function handleStudyDataLifecycle(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  targetEventId: string,
  hasStudyData: boolean | undefined,
  studyFields: Record<string, unknown>,
) {
  if (hasStudyData === undefined) {
    // has_study_data 변경 없으면 studyFields만 업데이트 (있으면)
    const nonNullStudyFields = Object.fromEntries(
      Object.entries(studyFields).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(nonNullStudyFields).length > 0) {
      await supabase
        .from('event_study_data')
        .update(nonNullStudyFields)
        .eq('event_id', targetEventId);
    }
    return;
  }

  // has_study_data 변경: lifecycle 처리
  const { data: existing } = await supabase
    .from('event_study_data')
    .select('event_id')
    .eq('event_id', targetEventId)
    .maybeSingle();

  const hadStudyData = existing !== null;

  if (!hadStudyData && hasStudyData) {
    // 학습 데이터 연결: 생성
    await supabase
      .from('event_study_data')
      .upsert({ event_id: targetEventId }, { onConflict: 'event_id' });
  } else if (hadStudyData && !hasStudyData) {
    // 학습 데이터 해제: 삭제
    await supabase
      .from('event_study_data')
      .delete()
      .eq('event_id', targetEventId);
  }
}

export async function updateRecurringEvent({
  eventId,
  scope,
  instanceDate,
  updates,
}: UpdateRecurringParams): Promise<UpdateRecurringResult> {
  try {
    await assertCanModifyEvent(eventId);
    const supabase = await createSupabaseServerClient();

    // calendar_events 컬럼과 가상 필드 분리
    const { eventFields, studyFields, hasStudyData } = separateEventUpdates(updates);

    // 이벤트 조회
    const { data: event, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, rrule, recurring_event_id, is_exception, exdates, start_date, start_at')
      .eq('id', eventId)
      .single();

    if (fetchError || !event) {
      return { success: false, error: fetchError?.message ?? '이벤트를 찾을 수 없습니다.' };
    }

    const parentId = event.is_exception ? (event.recurring_event_id ?? eventId) : eventId;
    const isParent = parentId === eventId;

    if (scope === 'this') {
      if (!isParent && event.is_exception) {
        // 기존 exception: 직접 UPDATE
        if (Object.keys(eventFields).length > 0) {
          const { error } = await supabase
            .from('calendar_events')
            .update(eventFields)
            .eq('id', eventId);
          if (error) return { success: false, error: error.message };
        }
        await handleStudyDataLifecycle(supabase, eventId, hasStudyData, studyFields);
      } else {
        // 확장 인스턴스 or 부모 자기 날짜: exception 생성
        // 먼저 기존 exception 체크
        const { data: existing } = await supabase
          .from('calendar_events')
          .select('id')
          .eq('recurring_event_id', parentId)
          .eq('is_exception', true)
          .is('deleted_at', null)
          .or(`start_date.eq.${instanceDate},start_at.like.${instanceDate}%`)
          .maybeSingle();

        if (existing) {
          // 기존 exception 업데이트
          if (Object.keys(eventFields).length > 0) {
            const { error } = await supabase
              .from('calendar_events')
              .update(eventFields)
              .eq('id', existing.id);
            if (error) return { success: false, error: error.message };
          }
          await handleStudyDataLifecycle(supabase, existing.id, hasStudyData, studyFields);
        } else {
          // 새 exception 생성 (eventFields만 전달, has_study_data 제외)
          const result = await createRecurringException({
            parentEventId: parentId,
            instanceDate,
            overrides: eventFields,
          });
          if (!result.success) return { success: false, error: result.error };
          // exception 생성 후 study data lifecycle 처리
          if (result.eventId) {
            await handleStudyDataLifecycle(supabase, result.eventId, hasStudyData, studyFields);
          }
        }
      }
    } else if (scope === 'this_and_following') {
      // 부모 조회
      const { data: parent } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('id', parentId)
        .single();

      if (!parent) return { success: false, error: '부모 이벤트를 찾을 수 없습니다.' };

      // RRULE 분할 계산 (COUNT 보정 포함)
      const parentDate = parent.start_date ?? extractDateYMD(parent.start_at) ?? '';
      let newSeriesRrule = parent.rrule;

      // parent rrule update + exceptions fetch 병렬 실행
      const splitOps: PromiseLike<unknown>[] = [];
      if (parent.rrule && parentDate) {
        const split = buildSplitRRules(parent.rrule, parentDate, instanceDate);
        splitOps.push(
          supabase
            .from('calendar_events')
            .update({ rrule: split.parentRrule })
            .eq('id', parentId)
        );
        newSeriesRrule = split.newSeriesRrule;
      }

      const exceptionsPromise = supabase
        .from('calendar_events')
        .select('id, start_date, start_at')
        .eq('recurring_event_id', parentId)
        .eq('is_exception', true)
        .is('deleted_at', null);
      splitOps.push(exceptionsPromise);

      await Promise.all(splitOps);
      const { data: exceptions } = await exceptionsPromise;

      if (exceptions) {
        const idsToDelete = exceptions
          .filter((exc) => {
            const excDate = exc.start_date ?? extractDateYMD(exc.start_at) ?? '';
            return excDate >= instanceDate;
          })
          .map((exc) => exc.id);

        if (idsToDelete.length > 0) {
          await supabase
            .from('calendar_events')
            .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
            .in('id', idsToDelete);
        }
      }

      // 새 시리즈 이벤트 생성 (수정된 필드 + 계산된 RRULE, dtstart=instanceDate)
      const shiftTs = (ts: string | null) => {
        if (!ts || !parentDate) return ts;
        return shiftTimestamp(ts, parentDate, instanceDate);
      };

      const {
        id: _id,
        created_at: _ca,
        updated_at: _ua,
        deleted_at: _da,
        ...parentFields
      } = parent;

      const newSeriesData = {
        ...parentFields,
        rrule: newSeriesRrule,
        start_at: shiftTs(parent.start_at),
        end_at: shiftTs(parent.end_at),
        start_date: parent.start_date ? instanceDate : null,
        end_date: parent.end_date && parent.start_date
          ? shiftEndDate(parent.start_date, parent.end_date, instanceDate)
          : null,
        is_exception: false,
        recurring_event_id: null,
        exdates: null,
        ...eventFields,
      };

      // 새 시리즈 insert + study_data prefetch 병렬 실행
      const shouldHaveStudy = hasStudyData ?? parent.is_task;
      const [insertResult2, studyPrefetch] = await Promise.all([
        supabase
          .from('calendar_events')
          .insert(newSeriesData)
          .select('id')
          .single(),
        shouldHaveStudy
          ? supabase
              .from('event_study_data')
              .select('*')
              .eq('event_id', parentId)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (insertResult2.error) return { success: false, error: insertResult2.error.message };
      const newSeries = insertResult2.data;

      // study_data 복사
      if (newSeries && shouldHaveStudy) {
        const parentStudy = studyPrefetch.data;
        if (parentStudy) {
          const { id: _sid, event_id: _eid, done: _d, done_at: _da2, done_by: _db, ...sf } = parentStudy;
          await supabase.from('event_study_data').insert({
            ...sf,
            event_id: newSeries.id,
            done: false,
            done_at: null,
            done_by: null,
          });
        } else {
          await supabase.from('event_study_data').insert({ event_id: newSeries.id });
        }
      }
    } else if (scope === 'all') {
      // rrule 변경 시 exdates 초기화 (새 RRULE과 기존 exdates 충돌 방지)
      if (eventFields.rrule !== undefined) {
        eventFields.exdates = null;
      }

      // 부모 직접 수정
      if (Object.keys(eventFields).length > 0) {
        const { error } = await supabase
          .from('calendar_events')
          .update(eventFields)
          .eq('id', parentId);
        if (error) return { success: false, error: error.message };
      }
      await handleStudyDataLifecycle(supabase, parentId, hasStudyData, studyFields);

      // 모든 exception soft-delete (변경사항이 전체에 적용)
      const { data: exceptions } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('recurring_event_id', parentId)
        .eq('is_exception', true)
        .is('deleted_at', null);

      if (exceptions && exceptions.length > 0) {
        const excIds = exceptions.map((exc) => exc.id);
        await supabase
          .from('calendar_events')
          .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
          .in('id', excIds);
      }
    }

    return { success: true };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'updateRecurringEvent' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// Recurring Event: restoreRecurringDelete (undo용)
// ============================================

/**
 * 반복 이벤트 삭제를 되돌립니다 (undo).
 */
export async function restoreRecurringDelete(params: {
  scope: RecurringScope;
  parentEventId: string;
  instanceDate: string;
  previousExdates?: string[] | null;
  previousRrule?: string | null;
  deletedEventIds?: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    if (params.scope === 'this') {
      // exdates 롤백
      if (params.previousExdates !== undefined) {
        await supabase
          .from('calendar_events')
          .update({ exdates: params.previousExdates })
          .eq('id', params.parentEventId);
      }
      // soft-deleted exception 복원
      if (params.deletedEventIds?.length) {
        for (const id of params.deletedEventIds) {
          await restoreEvent(id);
        }
      }
    } else if (params.scope === 'this_and_following') {
      // RRULE 롤백
      if (params.previousRrule !== undefined) {
        await supabase
          .from('calendar_events')
          .update({ rrule: params.previousRrule })
          .eq('id', params.parentEventId);
      }
      // exception 복원
      if (params.deletedEventIds?.length) {
        for (const id of params.deletedEventIds) {
          await restoreEvent(id);
        }
      }
    } else if (params.scope === 'all') {
      // 부모 + 모든 exception 복원
      if (params.deletedEventIds?.length) {
        for (const id of params.deletedEventIds) {
          await restoreEvent(id);
        }
      }
    }

    return { success: true };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'restoreRecurringDelete' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// Recurrence Remove: restoreRecurrenceRemove (undo용)
// ============================================

/**
 * 반복 해제(recurring→regular 전환)를 되돌립니다 (undo).
 *
 * - 부모 이벤트의 rrule + exdates 복원
 * - soft-deleted exception들 복원
 */
export async function restoreRecurrenceRemove(params: {
  eventId: string;
  previousRrule: string;
  previousExdates: string[] | null;
  deletedExceptionIds: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 부모 이벤트의 rrule + exdates 복원
    await supabase
      .from('calendar_events')
      .update({ rrule: params.previousRrule, exdates: params.previousExdates })
      .eq('id', params.eventId);

    // soft-deleted exception들 복원
    if (params.deletedExceptionIds.length > 0) {
      for (const id of params.deletedExceptionIds) {
        await restoreEvent(id);
      }
    }

    return { success: true };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'restoreRecurrenceRemove' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// Recurring Drag: restoreDragRecurringInstance (undo용)
// ============================================

/**
 * 반복 이벤트 드래그(exception 생성)를 되돌립니다 (undo).
 *
 * - 생성된 exception을 soft-delete
 * - 부모 exdates에서 instanceDate 제거
 */
export async function restoreDragRecurringInstance(params: {
  exceptionEventId: string;
  parentEventId: string;
  instanceDate: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // exception soft-delete + 부모 exdates 조회 병렬 실행
    const [, parentResult] = await Promise.all([
      supabase
        .from('calendar_events')
        .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
        .eq('id', params.exceptionEventId),
      supabase
        .from('calendar_events')
        .select('exdates')
        .eq('id', params.parentEventId)
        .single(),
    ]);

    // 부모 exdates에서 instanceDate 제거
    const currentExdates = (parentResult.data?.exdates as string[]) ?? [];
    const filteredExdates = currentExdates.filter((d) => d !== params.instanceDate);
    if (filteredExdates.length !== currentExdates.length) {
      await supabase
        .from('calendar_events')
        .update({ exdates: filteredExdates.length > 0 ? filteredExdates : null })
        .eq('id', params.parentEventId);
    }

    return { success: true };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'restoreDragRecurringInstance' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// getCalendarEventForEdit → 편집용 이벤트 전체 조회
// ============================================

/** consultation_event_data JOIN 결과 (편집용) */
export interface ConsultationEventEditData {
  consultant_id: string | null;
  student_id: string | null;
  /** 상담 대상 학생명 (students JOIN) */
  student_name: string | null;
  session_type: string | null;
  enrollment_id: string | null;
  program_name: string | null;
  consultation_mode: string | null;
  meeting_link: string | null;
  visitor: string | null;
  schedule_status: string | null;
  notification_targets: string[] | null;
}

export interface CalendarEventEditData {
  id: string;
  title: string;
  description: string | null;
  color: string | null;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
  is_all_day: boolean | null;
  rrule: string | null;
  recurring_event_id: string | null;
  is_exception: boolean | null;
  reminder_minutes: number[] | null;
  status: string;
  label: string;
  is_task: boolean;
  is_exclusion: boolean;
  container_type: string | null;
  calendar_id: string;
  plan_group_id: string | null;
  tags: string[] | null;
  // study data
  subject_category: string | null;
  subject_name: string | null;
  content_type: string | null;
  content_title: string | null;
  content_id: string | null;
  planned_start_page: number | null;
  planned_end_page: number | null;
  estimated_minutes: number | null;
  has_study_data: boolean;
  // event classification
  event_type: string | null;
  // consultation data (1:1 JOIN, null if not consultation)
  consultation_event_data: ConsultationEventEditData | null;
  /** 반복 이벤트의 exception 개수 (rrule이 있을 때만 조회, 없으면 0) */
  exception_count: number;
}

export async function getCalendarEventForEdit(
  eventId: string,
): Promise<{ success: boolean; data?: CalendarEventEditData; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 이벤트 데이터 + exception 개수 병렬 조회
    const [eventResult, exceptionCountResult] = await Promise.all([
      supabase
        .from('calendar_events')
        .select(`
          id, title, description, color, start_at, end_at, start_date, end_date,
          is_all_day, rrule, recurring_event_id, is_exception, reminder_minutes,
          status, label, event_subtype, is_task, is_exclusion, container_type,
          calendar_id, plan_group_id, tags, event_type,
          event_study_data(
            subject_category, subject_name, content_type, content_title, content_id,
            planned_start_page, planned_end_page, estimated_minutes
          ),
          consultation_event_data(
            consultant_id, student_id, session_type, enrollment_id,
            program_name, consultation_mode, meeting_link, visitor,
            schedule_status, notification_targets,
            student:students!student_id(user_profiles(name))
          )
        `)
        .eq('id', eventId)
        .is('deleted_at', null)
        .single(),
      supabase
        .from('calendar_events')
        .select('id', { count: 'exact', head: true })
        .eq('recurring_event_id', eventId)
        .eq('is_exception', true)
        .is('deleted_at', null),
    ]);

    const { data, error } = eventResult;
    const exceptionCount = exceptionCountResult.count ?? 0;

    if (error || !data) {
      return { success: false, error: error?.message ?? '이벤트를 찾을 수 없습니다.' };
    }

    const study = Array.isArray(data.event_study_data)
      ? data.event_study_data[0] ?? null
      : data.event_study_data;

    const consult = Array.isArray(data.consultation_event_data)
      ? data.consultation_event_data[0] ?? null
      : data.consultation_event_data;

    return {
      success: true,
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        color: data.color,
        start_at: data.start_at,
        end_at: data.end_at,
        start_date: data.start_date,
        end_date: data.end_date,
        is_all_day: data.is_all_day,
        rrule: data.rrule,
        recurring_event_id: data.recurring_event_id,
        is_exception: data.is_exception,
        reminder_minutes: data.reminder_minutes ?? null,
        status: data.status,
        label: data.label ?? data.event_subtype ?? '기타',
        is_task: data.is_task ?? false,
        is_exclusion: data.is_exclusion ?? false,
        container_type: data.container_type,
        calendar_id: data.calendar_id,
        plan_group_id: data.plan_group_id,
        tags: data.tags,
        subject_category: study?.subject_category ?? null,
        subject_name: study?.subject_name ?? null,
        content_type: study?.content_type ?? null,
        content_title: study?.content_title ?? null,
        content_id: study?.content_id ?? null,
        planned_start_page: study?.planned_start_page ?? null,
        planned_end_page: study?.planned_end_page ?? null,
        estimated_minutes: study?.estimated_minutes ?? null,
        has_study_data: study !== null,
        event_type: data.event_type ?? null,
        exception_count: data.rrule ? exceptionCount : 0,
        consultation_event_data: consult ? {
          consultant_id: consult.consultant_id ?? null,
          student_id: consult.student_id ?? null,
          student_name: (consult.student as unknown as { user_profiles: { name: string } | null } | null)?.user_profiles?.name ?? null,
          session_type: consult.session_type ?? null,
          enrollment_id: consult.enrollment_id ?? null,
          program_name: consult.program_name ?? null,
          consultation_mode: consult.consultation_mode ?? null,
          meeting_link: consult.meeting_link ?? null,
          visitor: consult.visitor ?? null,
          schedule_status: consult.schedule_status ?? null,
          notification_targets: consult.notification_targets ?? null,
        } as ConsultationEventEditData : null,
      },
    };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'getCalendarEventForEdit' }, err);
    return { success: false, error: String(err) };
  }
}

// ============================================
// updateCalendarEventFull → 편집 페이지에서 전체 필드 업데이트
// ============================================

export interface CalendarEventFullUpdate {
  title?: string;
  description?: string | null;
  color?: string | null;
  /** 이벤트를 다른 캘린더로 이동 */
  calendar_id?: string;
  start_at?: string | null;
  end_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_all_day?: boolean;
  rrule?: string | null;
  reminder_minutes?: number[] | null;
  status?: string;
  container_type?: string | null;
  label?: string;
  is_task?: boolean;
  is_exclusion?: boolean;
  // study data
  subject_category?: string | null;
  planned_start_page?: number | null;
  planned_end_page?: number | null;
  estimated_minutes?: number | null;
  /** 학습 데이터 연결/해제 토글 */
  has_study_data?: boolean;
}

/** 반복→일반 전환 시 undo용 메타데이터 */
export interface RecurrenceRemoveMeta {
  previousRrule: string;
  previousExdates: string[] | null;
  deletedExceptionIds: string[];
}

export async function updateCalendarEventFull(
  eventId: string,
  updates: CalendarEventFullUpdate,
  options?: {
    /** 반복→일반 전환 시, 부모 날짜를 해당 인스턴스 날짜로 이동 (Google Calendar 패턴) */
    instanceDate?: string;
  },
): Promise<{ success: boolean; error?: string; recurrenceRemoveMeta?: RecurrenceRemoveMeta }> {
  try {
    const supabase = await createSupabaseServerClient();

    // ── Prefetch: rrule 전환 감지 + study data lifecycle 판단 (병렬 실행) ──
    let previousRrule: string | null | undefined;
    let previousExdates: string[] | null | undefined;
    let hadStudyData: boolean | undefined;

    const needsRrulePrefetch = updates.rrule !== undefined;
    const needsStudyPrefetch = updates.has_study_data !== undefined;

    if (needsRrulePrefetch || needsStudyPrefetch) {
      const [rruleResult, studyResult] = await Promise.all([
        needsRrulePrefetch
          ? supabase.from('calendar_events').select('rrule, exdates').eq('id', eventId).maybeSingle()
          : Promise.resolve(null),
        needsStudyPrefetch
          ? supabase.from('event_study_data').select('event_id').eq('event_id', eventId).maybeSingle()
          : Promise.resolve(null),
      ]);
      if (rruleResult) {
        previousRrule = rruleResult.data?.rrule ?? null;
        previousExdates = rruleResult.data?.exdates ?? null;
      }
      if (studyResult) hadStudyData = studyResult.data !== null;
    }

    // calendar_events 필드
    const eventFields: Record<string, unknown> = {};
    if (updates.title !== undefined) eventFields.title = updates.title;
    if (updates.description !== undefined) eventFields.description = updates.description;
    if (updates.color !== undefined) eventFields.color = updates.color;
    if (updates.start_at !== undefined) eventFields.start_at = updates.start_at;
    if (updates.end_at !== undefined) eventFields.end_at = updates.end_at;
    if (updates.start_date !== undefined) eventFields.start_date = updates.start_date;
    if (updates.end_date !== undefined) eventFields.end_date = updates.end_date;
    if (updates.is_all_day !== undefined) eventFields.is_all_day = updates.is_all_day;
    if (updates.rrule !== undefined) eventFields.rrule = updates.rrule;
    if (updates.reminder_minutes !== undefined) eventFields.reminder_minutes = updates.reminder_minutes;
    if (updates.status !== undefined) eventFields.status = updates.status;
    if (updates.container_type !== undefined) eventFields.container_type = updates.container_type;
    if (updates.label !== undefined) {
      eventFields.label = updates.label;
      eventFields.event_subtype = updates.label; // dual-write for Stage 1
    }
    if (updates.is_task !== undefined) eventFields.is_task = updates.is_task;
    if (updates.is_exclusion !== undefined) eventFields.is_exclusion = updates.is_exclusion;

    // ── rrule 전환 시 연관 필드 정리 ──
    if (needsRrulePrefetch && previousRrule !== undefined) {
      const wasRecurring = !!previousRrule;
      const willBeRecurring = !!updates.rrule;

      if (wasRecurring && !willBeRecurring) {
        // 반복→일반: exdates 초기화 (orphan exception은 UPDATE 후 별도 처리)
        eventFields.exdates = null;
        // Google Calendar 패턴: 선택한 인스턴스 날짜로 부모 이동
        if (options?.instanceDate) {
          const { data: parentEvent } = await supabase
            .from('calendar_events')
            .select('start_at, end_at, start_date, end_date, is_all_day')
            .eq('id', eventId)
            .single();
          if (parentEvent) {
            const instDate = options.instanceDate;
            if (parentEvent.is_all_day) {
              const dayDiff = parentEvent.start_date && parentEvent.end_date
                ? Math.round((new Date(parentEvent.end_date).getTime() - new Date(parentEvent.start_date).getTime()) / 86400000)
                : 0;
              eventFields.start_date = instDate;
              eventFields.end_date = dayDiff > 0
                ? new Date(new Date(instDate).getTime() + dayDiff * 86400000).toISOString().split('T')[0]
                : instDate;
            } else if (parentEvent.start_at) {
              eventFields.start_at = shiftTimestamp(parentEvent.start_at, extractDateYMD(parentEvent.start_at) ?? '', instDate);
              eventFields.end_at = parentEvent.end_at
                ? shiftTimestamp(parentEvent.end_at, extractDateYMD(parentEvent.start_at) ?? '', instDate)
                : null;
            }
          }
        }
      } else if (!wasRecurring && willBeRecurring) {
        // 일반→반복: 이전 exception 관계가 있을 경우 정리
        eventFields.recurring_event_id = null;
        eventFields.is_exception = false;
        eventFields.exdates = null;
      }
    }

    if (Object.keys(eventFields).length > 0) {
      const { error } = await supabase
        .from('calendar_events')
        .update(eventFields)
        .eq('id', eventId)
        .is('deleted_at', null);
      if (error) return { success: false, error: error.message };
    }

    // ── 반복→일반 전환: orphan exception soft-delete + undo meta 수집 ──
    let recurrenceRemoveMeta: RecurrenceRemoveMeta | undefined;
    if (needsRrulePrefetch && previousRrule && !updates.rrule) {
      const { data: orphans } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('recurring_event_id', eventId)
        .eq('is_exception', true)
        .is('deleted_at', null);

      const deletedIds: string[] = [];
      if (orphans && orphans.length > 0) {
        deletedIds.push(...orphans.map((e) => e.id));
        await supabase
          .from('calendar_events')
          .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
          .in('id', deletedIds);
      }

      recurrenceRemoveMeta = {
        previousRrule,
        previousExdates: previousExdates ?? null,
        deletedExceptionIds: deletedIds,
      };
    }

    // has_study_data 변경 시 event_study_data lifecycle 처리
    if (updates.has_study_data !== undefined && hadStudyData !== updates.has_study_data) {
      if (!hadStudyData && updates.has_study_data) {
        // 학습 데이터 연결: event_study_data 생성
        await supabase
          .from('event_study_data')
          .upsert({ event_id: eventId }, { onConflict: 'event_id' });
      } else if (hadStudyData && !updates.has_study_data) {
        // 학습 데이터 해제: event_study_data 삭제
        await supabase
          .from('event_study_data')
          .delete()
          .eq('event_id', eventId);
      }
    }

    // event_study_data 필드 (학습 데이터가 있을 때만)
    const hasStudy = updates.has_study_data ?? hadStudyData ?? true;

    if (hasStudy) {
      const studyFields: Record<string, unknown> = {};
      if (updates.subject_category !== undefined) studyFields.subject_category = updates.subject_category;
      if (updates.planned_start_page !== undefined) studyFields.planned_start_page = updates.planned_start_page;
      if (updates.planned_end_page !== undefined) studyFields.planned_end_page = updates.planned_end_page;
      if (updates.estimated_minutes !== undefined) studyFields.estimated_minutes = updates.estimated_minutes;

      if (Object.keys(studyFields).length > 0) {
        studyFields.event_id = eventId;
        const { error } = await supabase
          .from('event_study_data')
          .upsert(studyFields, { onConflict: 'event_id' });
        if (error) {
          logActionError({ domain: 'calendar', action: 'updateCalendarEventFull' }, error, { eventId, step: 'studyData' });
        }
      }
    }

    // 스케줄에 영향을 주는 필드(is_exclusion, 학원/이동시간 label) 변경 시 캐시 무효화
    const scheduleAffected = updates.is_exclusion !== undefined
      || (updates.label && ['학원', '이동시간'].includes(updates.label));
    if (scheduleAffected) {
      const { data: evt } = await supabase
        .from('calendar_events')
        .select('calendar_id')
        .eq('id', eventId)
        .maybeSingle();
      if (evt?.calendar_id) {
        invalidateCalendarSchedule(evt.calendar_id);
      }
    }

    return { success: true, recurrenceRemoveMeta };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'updateCalendarEventFull' }, err);
    return { success: false, error: String(err) };
  }
}

export async function executeUnifiedReorder(
  input: UnifiedReorderInput,
): Promise<UnifiedReorderResult> {
  try {
    const supabase = await createSupabaseServerClient();

    logActionDebug(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      `Reordering items for planner ${input.calendarId} on ${input.planDate}`,
      { calendarId: input.calendarId, planDate: input.planDate },
    );

    // 1. 현재 아이템들(드래그 후)을 TimelineItem 형식으로 변환
    const currentItems: TimelineItem[] = input.orderedItems.map((item) => ({
      id: item.id,
      type: item.type,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      planId: item.planId,
      nonStudyType: item.nonStudyData?.originalType,
      sourceIndex: item.nonStudyData?.sourceIndex,
      originalStartTime: item.nonStudyData?.originalStartTime,
      originalEndTime: item.nonStudyData?.originalEndTime,
    }));

    // 2. 원본 아이템들(드래그 전)을 TimelineItem 형식으로 변환
    const originalItems: TimelineItem[] = input.originalItems.map((item) => ({
      id: item.id,
      type: item.type,
      startTime: item.startTime,
      endTime: item.endTime,
      durationMinutes: item.durationMinutes,
      planId: item.planId,
      nonStudyType: item.nonStudyData?.originalType,
      sourceIndex: item.nonStudyData?.sourceIndex,
      originalStartTime: item.nonStudyData?.originalStartTime,
      originalEndTime: item.nonStudyData?.originalEndTime,
    }));

    // 3. 재정렬 계산 (Push/Pull 모드 자동 결정)
    const reorderResult: ReorderResult = calculateUnifiedReorder(
      currentItems,
      input.slotBoundary,
      input.movedItemId,
      originalItems,
    );

    logActionDebug(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      `Reorder mode: ${reorderResult.mode}, items: ${reorderResult.items.length}`,
      { mode: reorderResult.mode, itemCount: reorderResult.items.length },
    );

    // 4. 모든 아이템 업데이트 (calendar_events 통합)
    const planDate = input.planDate;

    for (const item of reorderResult.items) {
      // empty 슬롯은 스킵
      if (item.id.startsWith('empty-')) continue;

      if (item.type === 'plan' && item.planId) {
        // 플랜: calendar_events.start_at/end_at 업데이트
        const startAt = `${planDate}T${item.startTime}:00+09:00`;
        const endAt = `${planDate}T${item.endTime}:00+09:00`;

        const { error } = await supabase
          .from('calendar_events')
          .update({ start_at: startAt, end_at: endAt })
          .eq('id', item.planId)
          .is('deleted_at', null);

        if (error) {
          logActionError(
            { domain: 'calendar', action: 'executeUnifiedReorder' },
            error,
            { planId: item.planId, step: 'updatePlan' },
          );
          return { success: false, error: '플랜 업데이트에 실패했습니다.' };
        }
      } else if (item.type === 'nonStudy') {
        // 비학습시간: 시간 변경된 경우만 업데이트
        const timeChanged =
          item.startTime !== item.originalStartTime ||
          item.endTime !== item.originalEndTime;
        if (!timeChanged) continue;

        // recordId 찾기 (input.orderedItems에서)
        const recordId = input.orderedItems.find(
          (oi) => oi.id === item.id && oi.type === 'nonStudy',
        )?.nonStudyData?.recordId;

        if (recordId) {
          const startAt = `${planDate}T${item.startTime}:00+09:00`;
          const endAt = `${planDate}T${item.endTime}:00+09:00`;

          const { error } = await supabase
            .from('calendar_events')
            .update({ start_at: startAt, end_at: endAt })
            .eq('id', recordId)
            .is('deleted_at', null);

          if (error) {
            logActionError(
              { domain: 'calendar', action: 'executeUnifiedReorder' },
              error,
              { itemId: item.id, recordId, step: 'updateNonStudy' },
            );
          }
        }
      }
    }

    return {
      success: true,
      mode: reorderResult.mode,
    };
  } catch (error) {
    logActionError(
      { domain: 'calendar', action: 'executeUnifiedReorder' },
      error,
      { calendarId: input.calendarId, planDate: input.planDate },
    );
    return { success: false, error: '예기치 않은 오류가 발생했습니다.' };
  }
}

// ============================================
// Deleted Calendar Events (Trash / 휴지통)
// ============================================

export interface DeletedCalendarEventInfo {
  id: string;
  title: string;
  label: string;
  is_task: boolean;
  is_exclusion: boolean;
  start_at: string | null;
  start_date: string | null;
  end_at: string | null;
  color: string | null;
  is_all_day: boolean | null;
  deleted_at: string;
}

export interface DeletedCalendarEventsResult {
  events: DeletedCalendarEventInfo[];
  totalCount: number;
  hasMore: boolean;
}

const DELETED_PAGE_SIZE = 20;

/**
 * 삭제된 캘린더 이벤트 목록 조회 (관리자용, 페이지네이션)
 */
export async function getDeletedCalendarEvents(
  studentId: string,
  options: { offset?: number; limit?: number; calendarId?: string } = {},
): Promise<AdminPlanResponse<DeletedCalendarEventsResult>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const { offset = 0, limit = DELETED_PAGE_SIZE, calendarId } = options;

    // 전체 개수
    let countQ = supabase
      .from('calendar_events')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', studentId)
      .not('deleted_at', 'is', null);

    if (calendarId) countQ = countQ.eq('calendar_id', calendarId);

    const { count: totalCount, error: cErr } = await countQ;
    if (cErr) return { success: false, error: cErr.message };

    // 데이터 조회
    let dataQ = supabase
      .from('calendar_events')
      .select('id, title, label, is_task, is_exclusion, start_at, start_date, end_at, color, is_all_day, deleted_at')
      .eq('student_id', studentId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (calendarId) dataQ = dataQ.eq('calendar_id', calendarId);

    const { data, error } = await dataQ;
    if (error) return { success: false, error: error.message };

    const events: DeletedCalendarEventInfo[] = (data ?? []).map((e) => ({
      id: e.id,
      title: e.title,
      label: e.label ?? '기타',
      is_task: e.is_task ?? false,
      is_exclusion: e.is_exclusion ?? false,
      start_at: e.start_at,
      start_date: e.start_date,
      end_at: e.end_at,
      color: e.color,
      is_all_day: e.is_all_day,
      deleted_at: e.deleted_at!,
    }));

    const total = totalCount ?? 0;
    return {
      success: true,
      data: { events, totalCount: total, hasMore: offset + events.length < total },
    };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'getDeletedCalendarEvents' }, err, { studentId });
    return { success: false, error: err instanceof Error ? err.message : '삭제된 이벤트 조회 실패' };
  }
}

/**
 * 삭제된 캘린더 이벤트 복구 (관리자용)
 */
export async function restoreDeletedCalendarEvents(
  eventIds: string[],
  studentId: string,
): Promise<AdminPlanResponse<{ restoredCount: number }>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (eventIds.length === 0) return { success: false, error: '복구할 이벤트를 선택해주세요.' };

    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: null, status: 'confirmed' })
      .in('id', eventIds)
      .eq('student_id', studentId);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/admin/students/${studentId}/plans`);
    revalidatePath('/plan');

    // 복원된 이벤트 중 스케줄에 영향을 주는 이벤트가 있으면 캐시 무효화
    const { data: restoredEvents } = await supabase
      .from('calendar_events')
      .select('calendar_id, is_exclusion, label')
      .in('id', eventIds);
    const affectedCalendarIds = new Set<string>();
    for (const evt of restoredEvents ?? []) {
      if (evt.calendar_id && (evt.is_exclusion || (evt.label && ['학원', '이동시간'].includes(evt.label)))) {
        affectedCalendarIds.add(evt.calendar_id);
      }
    }
    for (const cid of affectedCalendarIds) {
      invalidateCalendarSchedule(cid);
    }

    return { success: true, data: { restoredCount: eventIds.length } };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'restoreDeletedCalendarEvents' }, err, { eventIds, studentId });
    return { success: false, error: err instanceof Error ? err.message : '이벤트 복구 실패' };
  }
}

/**
 * 삭제된 캘린더 이벤트 영구 삭제 (관리자용, hard delete)
 */
export async function permanentlyDeleteCalendarEvents(
  eventIds: string[],
  studentId: string,
): Promise<AdminPlanResponse<{ deletedCount: number }>> {
  try {
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    if (eventIds.length === 0) return { success: false, error: '삭제할 이벤트를 선택해주세요.' };

    // hard delete (deleted_at IS NOT NULL인 이벤트만)
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .in('id', eventIds)
      .eq('student_id', studentId)
      .not('deleted_at', 'is', null);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/admin/students/${studentId}/plans`);

    return { success: true, data: { deletedCount: eventIds.length } };
  } catch (err) {
    logActionError({ domain: 'calendar', action: 'permanentlyDeleteCalendarEvents' }, err, { eventIds, studentId });
    return { success: false, error: err instanceof Error ? err.message : '영구 삭제 실패' };
  }
}
