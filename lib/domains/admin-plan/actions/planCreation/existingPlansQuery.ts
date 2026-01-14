/**
 * 기존 플랜 조회 함수
 *
 * 플랜 그룹 내 기존 플랜의 시간 정보를 조회하여
 * 새 플랜 생성 시 시간 충돌을 방지
 *
 * @module lib/domains/admin-plan/actions/planCreation/existingPlansQuery
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActionError } from '@/lib/utils/serverActionLogger';

/**
 * 기존 플랜 시간 정보 타입
 */
export interface ExistingPlanTimeInfo {
  plan_id: string;
  plan_date: string;
  start_time: string;
  end_time: string;
  content_type: string;
  content_id: string | null;
}

/**
 * 날짜별 기존 플랜 시간 정보
 */
export type ExistingPlansByDate = Map<
  string,
  Array<{ start: string; end: string; plan_id: string }>
>;

/**
 * 플랜 그룹의 기간 내 기존 플랜 시간 정보 조회
 *
 * @param planGroupId - 플랜 그룹 ID
 * @param periodStart - 조회 시작 날짜 (YYYY-MM-DD)
 * @param periodEnd - 조회 종료 날짜 (YYYY-MM-DD)
 * @returns 기존 플랜 시간 정보 배열
 */
export async function getExistingPlansForPlanGroup(
  planGroupId: string,
  periodStart: string,
  periodEnd: string
): Promise<ExistingPlanTimeInfo[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('student_plan')
    .select('id, plan_date, start_time, end_time, content_type, content_id')
    .eq('plan_group_id', planGroupId)
    .gte('plan_date', periodStart)
    .lte('plan_date', periodEnd)
    .not('start_time', 'is', null)
    .not('end_time', 'is', null)
    .eq('is_active', true)
    .order('plan_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    logActionError('existingPlansQuery.getExistingPlansForGroup', `기존 플랜 조회 실패: ${error.message}`);
    return [];
  }

  return (data || []).map((plan) => ({
    plan_id: plan.id,
    plan_date: plan.plan_date,
    start_time: plan.start_time as string,
    end_time: plan.end_time as string,
    content_type: plan.content_type,
    content_id: plan.content_id,
  }));
}

/**
 * 학생의 기간 내 모든 기존 플랜 시간 정보 조회
 * (플랜 그룹과 무관하게 전체 조회)
 *
 * @param studentId - 학생 ID
 * @param periodStart - 조회 시작 날짜 (YYYY-MM-DD)
 * @param periodEnd - 조회 종료 날짜 (YYYY-MM-DD)
 * @returns 기존 플랜 시간 정보 배열
 */
export async function getExistingPlansForStudent(
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<ExistingPlanTimeInfo[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('student_plan')
    .select('id, plan_date, start_time, end_time, content_type, content_id')
    .eq('student_id', studentId)
    .gte('plan_date', periodStart)
    .lte('plan_date', periodEnd)
    .not('start_time', 'is', null)
    .not('end_time', 'is', null)
    .eq('is_active', true)
    .order('plan_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    logActionError('existingPlansQuery.getExistingPlansForGroup', `기존 플랜 조회 실패: ${error.message}`);
    return [];
  }

  return (data || []).map((plan) => ({
    plan_id: plan.id,
    plan_date: plan.plan_date,
    start_time: plan.start_time as string,
    end_time: plan.end_time as string,
    content_type: plan.content_type,
    content_id: plan.content_id,
  }));
}

/**
 * 기존 플랜 시간 정보를 날짜별로 그룹화
 *
 * @param existingPlans - 기존 플랜 시간 정보 배열
 * @returns 날짜별 기존 플랜 시간 Map
 */
export function groupExistingPlansByDate(
  existingPlans: ExistingPlanTimeInfo[]
): ExistingPlansByDate {
  const result: ExistingPlansByDate = new Map();

  for (const plan of existingPlans) {
    if (!result.has(plan.plan_date)) {
      result.set(plan.plan_date, []);
    }
    result.get(plan.plan_date)!.push({
      start: plan.start_time,
      end: plan.end_time,
      plan_id: plan.plan_id,
    });
  }

  return result;
}

/**
 * 타임라인 표시용 기존 플랜 정보 타입
 */
export interface ExistingPlanForTimeline {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  content_title: string | null;
  content_type: string | null;
}

/**
 * 학생의 기간 내 기존 플랜 조회 (타임라인 표시용)
 * 제목 정보 포함
 *
 * @param studentId - 학생 ID
 * @param periodStart - 조회 시작 날짜 (YYYY-MM-DD)
 * @param periodEnd - 조회 종료 날짜 (YYYY-MM-DD)
 * @returns 기존 플랜 정보 배열
 */
export async function getExistingPlansForDateRange(
  studentId: string,
  periodStart: string,
  periodEnd: string
): Promise<ExistingPlanForTimeline[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('student_plan')
    .select('id, plan_date, start_time, end_time, title, content_title, content_type')
    .eq('student_id', studentId)
    .gte('plan_date', periodStart)
    .lte('plan_date', periodEnd)
    .eq('is_active', true)
    .order('plan_date', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    logActionError('existingPlansQuery.getExistingPlansForTimeline', `타임라인 플랜 조회 실패: ${error.message}`);
    return [];
  }

  return (data || []).map((plan) => ({
    id: plan.id,
    date: plan.plan_date,
    start_time: plan.start_time,
    end_time: plan.end_time,
    title: plan.title,
    content_title: plan.content_title,
    content_type: plan.content_type,
  }));
}
