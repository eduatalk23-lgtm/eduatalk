'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireAdminOrConsultant } from '@/lib/auth/guards';
import { createTransactionContext } from '@/lib/supabase/transaction';
import { logActionError } from '@/lib/logging/actionLogger';
import { logPlanCarryover, generateCorrelationId } from './planEvent';
import type { AdminPlanResponse } from '../types';

interface CarryoverResult {
  processedCount: number;
  carryoverPlans: Array<{
    id: string;
    title: string;
    fromDate: string;
    carryoverCount: number;
  }>;
}

/**
 * 특정 학생의 미완료 플랜을 Unfinished Dock으로 이월
 * - 어제까지의 daily 플랜 중 완료되지 않은 것을 이월 처리
 * - carryover_count 증가
 * - 이벤트 로깅
 */
export async function runCarryoverForStudent(
  input: {
    studentId: string;
    tenantId: string;
    cutoffDate?: string; // 기본값: 오늘
  }
): Promise<AdminPlanResponse<CarryoverResult>> {
  try {
    // 인증 검증
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const correlationId = await generateCorrelationId();

    // cutoffDate 기준으로 이전 날짜의 미완료 플랜 조회
    const today = input.cutoffDate ?? new Date().toISOString().split('T')[0];

    const { data: incompletePlans, error: fetchError } = await supabase
      .from('student_plan')
      .select(`
        id,
        plan_date,
        content_title,
        custom_title,
        planned_start_page_or_time,
        planned_end_page_or_time,
        completed_start_page_or_time,
        completed_end_page_or_time,
        carryover_count,
        carryover_from_date
      `)
      .eq('student_id', input.studentId)
      .eq('tenant_id', input.tenantId) // tenant 격리
      .eq('container_type', 'daily')
      .eq('is_active', true)
      .neq('status', 'completed')
      .lt('plan_date', today)
      .order('plan_date', { ascending: true });

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    if (!incompletePlans || incompletePlans.length === 0) {
      return {
        success: true,
        data: { processedCount: 0, carryoverPlans: [] },
      };
    }

    // 트랜잭션 컨텍스트 생성 - 모든 업데이트를 그룹화
    const tx = createTransactionContext<{
      id: string;
      title: string;
      fromDate: string;
      carryoverCount: number;
      remainingVolume: number;
    }>();

    // 각 플랜에 대한 업데이트 작업 추가
    for (const plan of incompletePlans) {
      const newCarryoverCount = (plan.carryover_count ?? 0) + 1;
      const originalDate = plan.carryover_from_date ?? plan.plan_date;

      // 남은 볼륨 계산
      const plannedVolume =
        (plan.planned_end_page_or_time ?? 0) -
        (plan.planned_start_page_or_time ?? 0);
      const completedVolume =
        (plan.completed_end_page_or_time ?? 0) -
        (plan.completed_start_page_or_time ?? 0);
      const remainingVolume = Math.max(0, plannedVolume - completedVolume);

      tx.add({
        name: `Carryover plan ${plan.id}`,
        rollbackId: plan.id,
        execute: async () => {
          // Unfinished로 이동 (tenant 격리)
          const { error: updateError } = await supabase
            .from('student_plan')
            .update({
              container_type: 'unfinished',
              carryover_count: newCarryoverCount,
              carryover_from_date: originalDate,
              updated_at: new Date().toISOString(),
            })
            .eq('id', plan.id)
            .eq('tenant_id', input.tenantId);

          if (updateError) {
            return { success: false, error: updateError.message };
          }

          return {
            success: true,
            data: {
              id: plan.id,
              title: plan.custom_title ?? plan.content_title ?? '제목 없음',
              fromDate: plan.plan_date,
              carryoverCount: newCarryoverCount,
              remainingVolume,
            },
          };
        },
      });
    }

    // 트랜잭션 실행
    const txResult = await tx.commit();

    if (!txResult.success) {
      // 부분 실패 시 롤백 정보와 함께 에러 반환
      logActionError(
        { domain: 'admin-plan', action: 'runCarryoverForStudent', tenantId: input.tenantId },
        txResult.error,
        {
          studentId: input.studentId,
          completedCount: txResult.completedCount,
          totalCount: txResult.totalCount,
          rollbackIds: txResult.rollbackIds,
        }
      );

      return {
        success: false,
        error: `이월 처리 중 오류 발생 (${txResult.completedCount}/${txResult.totalCount} 완료): ${txResult.error}`,
      };
    }

    // 성공한 플랜들에 대해 이벤트 로깅
    const carryoverResults: CarryoverResult['carryoverPlans'] = [];

    for (const result of txResult.data ?? []) {
      await logPlanCarryover(input.tenantId, input.studentId, result.id, {
        from_date: result.fromDate,
        to_date: today,
        carryover_count: result.carryoverCount,
        remaining_volume: result.remainingVolume,
      });

      carryoverResults.push({
        id: result.id,
        title: result.title,
        fromDate: result.fromDate,
        carryoverCount: result.carryoverCount,
      });
    }

    return {
      success: true,
      data: {
        processedCount: carryoverResults.length,
        carryoverPlans: carryoverResults,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'runCarryoverForStudent', tenantId: input.tenantId },
      error,
      { studentId: input.studentId, cutoffDate: input.cutoffDate }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 여러 학생의 carryover를 일괄 실행
 * (스케줄러나 관리자 일괄 작업용)
 */
export async function runBulkCarryover(
  input: {
    tenantId: string;
    studentIds?: string[]; // 지정하지 않으면 전체 학생
    cutoffDate?: string;
  }
): Promise<
  AdminPlanResponse<{
    totalProcessed: number;
    studentResults: Array<{
      studentId: string;
      processedCount: number;
    }>;
  }>
> {
  try {
    // 인증 검증
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();

    // 학생 목록 조회
    let studentIds = input.studentIds;

    if (!studentIds || studentIds.length === 0) {
      const { data: students, error } = await supabase
        .from('students')
        .select('id')
        .eq('tenant_id', input.tenantId)
        .eq('is_active', true);

      if (error) {
        return { success: false, error: error.message };
      }

      studentIds = students?.map((s) => s.id) ?? [];
    }

    const results: Array<{ studentId: string; processedCount: number }> = [];
    let totalProcessed = 0;

    for (const studentId of studentIds) {
      const result = await runCarryoverForStudent({
        studentId,
        tenantId: input.tenantId,
        cutoffDate: input.cutoffDate,
      });

      if (result.success && result.data) {
        results.push({
          studentId,
          processedCount: result.data.processedCount,
        });
        totalProcessed += result.data.processedCount;
      }
    }

    return {
      success: true,
      data: {
        totalProcessed,
        studentResults: results,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'runBulkCarryover', tenantId: input.tenantId },
      error,
      { studentIds: input.studentIds, cutoffDate: input.cutoffDate }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 미완료 플랜 상태 조회 (carryover 실행 전 미리보기)
 */
export async function getCarryoverPreview(
  input: {
    studentId: string;
    tenantId: string;
    cutoffDate?: string;
  }
): Promise<
  AdminPlanResponse<{
    incompleteCount: number;
    plans: Array<{
      id: string;
      planDate: string;
      title: string;
      subject: string | null;
      remainingVolume: number;
      currentCarryoverCount: number;
    }>;
  }>
> {
  try {
    // 인증 검증
    await requireAdminOrConsultant({ requireTenant: true });
    const supabase = await createSupabaseServerClient();
    const today = input.cutoffDate ?? new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('student_plan')
      .select(`
        id,
        plan_date,
        content_title,
        content_subject,
        custom_title,
        planned_start_page_or_time,
        planned_end_page_or_time,
        completed_start_page_or_time,
        completed_end_page_or_time,
        carryover_count
      `)
      .eq('student_id', input.studentId)
      .eq('tenant_id', input.tenantId) // tenant 격리
      .eq('container_type', 'daily')
      .eq('is_active', true)
      .neq('status', 'completed')
      .lt('plan_date', today)
      .order('plan_date', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const plans =
      data?.map((plan) => {
        const plannedVolume =
          (plan.planned_end_page_or_time ?? 0) -
          (plan.planned_start_page_or_time ?? 0);
        const completedVolume =
          (plan.completed_end_page_or_time ?? 0) -
          (plan.completed_start_page_or_time ?? 0);

        return {
          id: plan.id,
          planDate: plan.plan_date,
          title: plan.custom_title ?? plan.content_title ?? '제목 없음',
          subject: plan.content_subject,
          remainingVolume: Math.max(0, plannedVolume - completedVolume),
          currentCarryoverCount: plan.carryover_count ?? 0,
        };
      }) ?? [];

    return {
      success: true,
      data: {
        incompleteCount: plans.length,
        plans,
      },
    };
  } catch (error) {
    logActionError(
      { domain: 'admin-plan', action: 'getCarryoverPreview', tenantId: input.tenantId },
      error,
      { studentId: input.studentId, cutoffDate: input.cutoffDate }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
