'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import type { ContainerType, AdHocPlan } from '@/lib/domains/admin-plan/types';

// ============================================
// 컨테이너 기반 플랜 타입
// ============================================

export interface ContainerPlan {
  id: string;
  plan_date: string;
  content_type: string;
  content_id: string;
  content_title: string | null;
  content_subject: string | null;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  status: string | null;
  container_type: ContainerType;
  is_locked: boolean;
  carryover_from_date: string | null;
  carryover_count: number;
  custom_title: string | null;
  custom_range_display: string | null;
  plan_group_id: string | null;
  plan_number: number | null;
  sequence: number | null;
  // 타이머 관련
  actual_start_time: string | null;
  actual_end_time: string | null;
  total_duration_seconds: number | null;
}

export interface ContainerSummary {
  unfinished: {
    plans: ContainerPlan[];
    adHocPlans: AdHocPlan[];
    totalCount: number;
  };
  daily: {
    plans: ContainerPlan[];
    adHocPlans: AdHocPlan[];
    totalCount: number;
    completedCount: number;
  };
  weekly: {
    plans: ContainerPlan[];
    adHocPlans: AdHocPlan[];
    totalCount: number;
  };
}

export interface TodayContainerResult {
  success: boolean;
  data?: ContainerSummary;
  error?: string;
  date?: string;
}

// ============================================
// 메인 함수
// ============================================

/**
 * 오늘의 컨테이너 기반 플랜 조회
 * Unfinished, Daily, Weekly 컨테이너로 분류된 플랜 반환
 */
export async function getTodayContainerPlans(
  targetDate?: string
): Promise<TodayContainerResult> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'student') {
      return { success: false, error: 'Unauthorized' };
    }

    const supabase = await createSupabaseServerClient();
    const today = targetDate ?? new Date().toISOString().split('T')[0];

    // 이번 주 시작/끝 계산
    const todayDate = new Date(today + 'T00:00:00');
    const dayOfWeek = todayDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(todayDate);
    weekStart.setDate(todayDate.getDate() + mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // 1. student_plan에서 플랜 조회
    const { data: plans, error: plansError } = await supabase
      .from('student_plan')
      .select(`
        id,
        plan_date,
        content_type,
        content_id,
        content_title,
        content_subject,
        planned_start_page_or_time,
        planned_end_page_or_time,
        status,
        container_type,
        is_locked,
        carryover_from_date,
        carryover_count,
        custom_title,
        custom_range_display,
        plan_group_id,
        plan_number,
        sequence,
        actual_start_time,
        actual_end_time,
        total_duration_seconds
      `)
      .eq('student_id', user.userId)
      .eq('is_active', true)
      .or(`plan_date.eq.${today},container_type.eq.unfinished,and(container_type.eq.weekly,plan_date.gte.${weekStartStr},plan_date.lte.${weekEndStr})`)
      .order('plan_date', { ascending: true })
      .order('sequence', { ascending: true });

    if (plansError) {
      console.error('Failed to fetch container plans:', plansError);
      return { success: false, error: plansError.message };
    }

    // 2. ad_hoc_plans 조회
    const { data: adHocPlans, error: adHocError } = await supabase
      .from('ad_hoc_plans')
      .select('*')
      .eq('student_id', user.userId)
      .or(`plan_date.eq.${today},container_type.eq.unfinished,and(container_type.eq.weekly,plan_date.gte.${weekStartStr},plan_date.lte.${weekEndStr})`)
      .order('created_at', { ascending: true });

    if (adHocError) {
      console.error('Failed to fetch ad-hoc plans:', adHocError);
      // ad-hoc 실패해도 계속 진행
    }

    // 3. 컨테이너별로 분류
    const containerSummary: ContainerSummary = {
      unfinished: { plans: [], adHocPlans: [], totalCount: 0 },
      daily: { plans: [], adHocPlans: [], totalCount: 0, completedCount: 0 },
      weekly: { plans: [], adHocPlans: [], totalCount: 0 },
    };

    // 플랜 분류
    for (const plan of (plans ?? []) as ContainerPlan[]) {
      const container = plan.container_type ?? 'daily';

      if (container === 'unfinished') {
        containerSummary.unfinished.plans.push(plan);
      } else if (container === 'weekly') {
        containerSummary.weekly.plans.push(plan);
      } else {
        // daily (오늘 날짜인 것만)
        if (plan.plan_date === today) {
          containerSummary.daily.plans.push(plan);
          if (plan.status === 'completed') {
            containerSummary.daily.completedCount++;
          }
        }
      }
    }

    // Ad-hoc 플랜 분류
    for (const adHoc of (adHocPlans ?? []) as AdHocPlan[]) {
      const container = adHoc.container_type ?? 'daily';

      if (container === 'unfinished') {
        containerSummary.unfinished.adHocPlans.push(adHoc);
      } else if (container === 'weekly') {
        containerSummary.weekly.adHocPlans.push(adHoc);
      } else {
        if (adHoc.plan_date === today) {
          containerSummary.daily.adHocPlans.push(adHoc);
          if (adHoc.status === 'completed') {
            containerSummary.daily.completedCount++;
          }
        }
      }
    }

    // 총 카운트 계산
    containerSummary.unfinished.totalCount =
      containerSummary.unfinished.plans.length +
      containerSummary.unfinished.adHocPlans.length;
    containerSummary.daily.totalCount =
      containerSummary.daily.plans.length +
      containerSummary.daily.adHocPlans.length;
    containerSummary.weekly.totalCount =
      containerSummary.weekly.plans.length +
      containerSummary.weekly.adHocPlans.length;

    return {
      success: true,
      data: containerSummary,
      date: today,
    };
  } catch (error) {
    console.error('Failed to get container plans:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 미완료 플랜을 Daily로 이동
 */
export async function moveToDaily(
  planId: string,
  planType: 'student_plan' | 'ad_hoc_plan' = 'student_plan'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'student') {
      return { success: false, error: 'Unauthorized' };
    }

    const supabase = await createSupabaseServerClient();
    const today = new Date().toISOString().split('T')[0];

    const tableName = planType === 'ad_hoc_plan' ? 'ad_hoc_plans' : 'student_plan';

    const { error } = await supabase
      .from(tableName)
      .update({
        container_type: 'daily',
        plan_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .eq('student_id', user.userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 플랜을 Weekly로 이동
 */
export async function moveToWeekly(
  planId: string,
  planType: 'student_plan' | 'ad_hoc_plan' = 'student_plan'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'student') {
      return { success: false, error: 'Unauthorized' };
    }

    const supabase = await createSupabaseServerClient();
    const tableName = planType === 'ad_hoc_plan' ? 'ad_hoc_plans' : 'student_plan';

    const { error } = await supabase
      .from(tableName)
      .update({
        container_type: 'weekly',
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId)
      .eq('student_id', user.userId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 하루 종료 시 미완료 플랜 이월 처리
 * (배치 작업 또는 자정에 호출)
 */
export async function processEndOfDay(
  studentId: string,
  date: string
): Promise<{ success: boolean; movedCount: number; error?: string }> {
  try {
    const supabase = await createSupabaseServerClient();

    // 해당 날짜의 미완료 플랜을 unfinished로 이동
    const { data, error } = await supabase
      .from('student_plan')
      .update({
        container_type: 'unfinished',
        carryover_count: supabase.rpc('increment_carryover_count'),
        carryover_from_date: date,
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('plan_date', date)
      .eq('container_type', 'daily')
      .in('status', ['pending', 'in_progress'])
      .select('id');

    if (error) {
      return { success: false, movedCount: 0, error: error.message };
    }

    // ad_hoc_plans도 처리
    const { data: adHocData } = await supabase
      .from('ad_hoc_plans')
      .update({
        container_type: 'unfinished',
        updated_at: new Date().toISOString(),
      })
      .eq('student_id', studentId)
      .eq('plan_date', date)
      .eq('container_type', 'daily')
      .in('status', ['pending', 'in_progress'])
      .select('id');

    const totalMoved = (data?.length ?? 0) + (adHocData?.length ?? 0);

    return { success: true, movedCount: totalMoved };
  } catch (error) {
    return {
      success: false,
      movedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
