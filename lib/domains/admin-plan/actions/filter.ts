'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { logActionError } from '@/lib/logging/actionLogger';
import type { AdminPlanResponse } from '../types';

export interface PlanFilterParams {
  studentId: string;
  /** 플래너 ID (플래너 기반 필터링용) */
  plannerId?: string;
  search?: string;
  status?: 'all' | 'pending' | 'in_progress' | 'completed';
  subject?: string;
  dateRange?: 'today' | 'week' | 'month' | 'all';
  containerType?: 'all' | 'daily' | 'weekly' | 'unfinished';
  limit?: number;
  offset?: number;
}

export interface FilteredPlan {
  id: string;
  content_title: string | null;
  content_subject: string | null;
  custom_title: string | null;
  plan_date: string;
  planned_start_page_or_time: number | null;
  planned_end_page_or_time: number | null;
  completed_start_page_or_time: number | null;
  completed_end_page_or_time: number | null;
  status: string | null;
  container_type: string;
  carryover_count: number;
}

export interface FilterResult {
  plans: FilteredPlan[];
  totalCount: number;
  subjects: string[];
}

/**
 * 필터링된 플랜 목록 조회
 */
export async function getFilteredPlans(
  params: PlanFilterParams
): Promise<AdminPlanResponse<FilterResult>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 기본 쿼리 빌더 (tenant 격리 포함)
    // 플래너 필터링이 필요한 경우 plan_groups와 조인
    const selectFields = `
        id,
        content_title,
        content_subject,
        custom_title,
        plan_date,
        planned_start_page_or_time,
        planned_end_page_or_time,
        completed_start_page_or_time,
        completed_end_page_or_time,
        status,
        container_type,
        carryover_count
      `;

    let query = params.plannerId
      ? supabase
          .from('student_plan')
          .select(`${selectFields}, plan_groups!inner(planner_id)`, { count: 'exact' })
          .eq('student_id', params.studentId)
          .eq('tenant_id', tenantId)
          .eq('is_active', true)
          .eq('plan_groups.planner_id', params.plannerId)
      : supabase
          .from('student_plan')
          .select(selectFields, { count: 'exact' })
          .eq('student_id', params.studentId)
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

    // 검색어 필터
    if (params.search) {
      query = query.or(
        `content_title.ilike.%${params.search}%,custom_title.ilike.%${params.search}%`
      );
    }

    // 상태 필터
    if (params.status && params.status !== 'all') {
      if (params.status === 'completed') {
        query = query.eq('status', 'completed');
      } else if (params.status === 'in_progress') {
        query = query.eq('status', 'in_progress');
      } else if (params.status === 'pending') {
        query = query.or('status.is.null,status.eq.pending');
      }
    }

    // 과목 필터
    if (params.subject) {
      query = query.eq('content_subject', params.subject);
    }

    // 기간 필터
    if (params.dateRange && params.dateRange !== 'all') {
      const now = new Date();
      let startDate: string;

      if (params.dateRange === 'today') {
        startDate = now.toISOString().split('T')[0];
        query = query.eq('plan_date', startDate);
      } else if (params.dateRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        query = query.gte('plan_date', startDate);
      } else if (params.dateRange === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(now.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        query = query.gte('plan_date', startDate);
      }
    }

    // 컨테이너 필터
    if (params.containerType && params.containerType !== 'all') {
      query = query.eq('container_type', params.containerType);
    }

    // 정렬
    query = query.order('plan_date', { ascending: false });

    // 페이지네이션
    if (params.limit) {
      query = query.limit(params.limit);
    }
    if (params.offset) {
      query = query.range(params.offset, params.offset + (params.limit ?? 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    // 과목 목록 조회 (필터 옵션용, tenant 격리)
    const { data: subjectData } = await supabase
      .from('student_plan')
      .select('content_subject')
      .eq('student_id', params.studentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .eq('is_active', true)
      .not('content_subject', 'is', null);

    const subjects = [
      ...new Set(
        subjectData?.map((s) => s.content_subject).filter(Boolean) ?? []
      ),
    ] as string[];

    // plan_groups 필드 제거 (플래너 필터링 시 조인된 데이터)
    const plans = params.plannerId
      ? (data ?? []).map(({ plan_groups, ...rest }: FilteredPlan & { plan_groups?: unknown }) => rest)
      : (data ?? []);

    return {
      success: true,
      data: {
        plans,
        totalCount: count ?? 0,
        subjects,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getFilteredPlans' },
      error,
      { studentId: params.studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 학생의 과목 목록 조회
 */
export async function getStudentSubjects(
  studentId: string
): Promise<AdminPlanResponse<string[]>> {
  try {
    // 인증 및 tenant 검증
    const { tenantId } = await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('student_plan')
      .select('content_subject')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId) // tenant 격리
      .eq('is_active', true)
      .not('content_subject', 'is', null);

    if (error) {
      return { success: false, error: error.message };
    }

    const subjects = [
      ...new Set(data?.map((s) => s.content_subject).filter(Boolean) ?? []),
    ] as string[];

    return { success: true, data: subjects };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getStudentSubjects' },
      error,
      { studentId }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
