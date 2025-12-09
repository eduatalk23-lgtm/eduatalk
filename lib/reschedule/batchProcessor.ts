/**
 * 재조정 Batch 처리 유틸리티
 * 
 * 대량의 플랜을 효율적으로 처리하기 위한 Batch 유틸리티입니다.
 * 
 * @module lib/reschedule/batchProcessor
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 타입 정의
// ============================================

/**
 * 플랜 생성 입력
 */
export interface CreatePlanInput {
  tenant_id?: string | null;
  student_id: string;
  plan_group_id: string | null;
  plan_date: string;
  block_index: number;
  content_type: 'book' | 'lecture' | 'custom';
  content_id: string;
  chapter?: string | null;
  planned_start_page_or_time?: number | null;
  planned_end_page_or_time?: number | null;
  completed_amount?: number | null;
  progress?: number | null;
  is_reschedulable?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  actual_start_time?: string | null;
  actual_end_time?: string | null;
  total_duration_seconds?: number | null;
  paused_duration_seconds?: number | null;
  pause_count?: number | null;
  plan_number?: number | null;
  sequence?: number | null;
  memo?: string | null;
  day_type?: string | null;
  week?: number | null;
  day?: number | null;
  is_partial?: boolean | null;
  is_continued?: boolean | null;
  status?: string;
  is_active?: boolean;
  version_group_id?: string | null;
  version?: number;
  [key: string]: any;
}

/**
 * 히스토리 생성 입력
 */
export interface CreateHistoryInput {
  plan_id: string;
  plan_group_id: string;
  plan_data: any;
  content_id?: string | null;
  adjustment_type?: 'range' | 'replace' | 'full' | null;
  reschedule_log_id?: string | null;
  tenant_id?: string | null;
  created_by?: string | null;
}

// ============================================
// Batch 처리 함수
// ============================================

/**
 * 대량 플랜 비활성화
 * 
 * 여러 플랜을 한 번에 비활성화합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param planIds 플랜 ID 목록
 * @returns 비활성화된 플랜 수
 */
export async function batchDeactivatePlans(
  supabase: SupabaseClient,
  planIds: string[]
): Promise<number> {
  if (planIds.length === 0) {
    return 0;
  }

  // Supabase는 한 번에 최대 1000개까지 업데이트 가능
  const BATCH_SIZE = 1000;
  let totalUpdated = 0;

  for (let i = 0; i < planIds.length; i += BATCH_SIZE) {
    const batch = planIds.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('student_plan')
      .update({
        is_active: false,
        status: 'canceled',
      })
      .in('id', batch)
      .select('id');

    if (error) {
      console.error(`[batchProcessor] 플랜 비활성화 실패 (배치 ${i / BATCH_SIZE + 1}):`, error);
      throw new Error(`플랜 비활성화 실패: ${error.message}`);
    }

    totalUpdated += data?.length || 0;
  }

  return totalUpdated;
}

/**
 * 대량 플랜 생성
 * 
 * 여러 플랜을 한 번에 생성합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param plans 플랜 데이터 목록
 * @returns 생성된 플랜 ID 목록
 */
export async function batchCreatePlans(
  supabase: SupabaseClient,
  plans: CreatePlanInput[]
): Promise<string[]> {
  if (plans.length === 0) {
    return [];
  }

  // Supabase는 한 번에 최대 1000개까지 INSERT 가능
  const BATCH_SIZE = 1000;
  const createdIds: string[] = [];

  for (let i = 0; i < plans.length; i += BATCH_SIZE) {
    const batch = plans.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('student_plan')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`[batchProcessor] 플랜 생성 실패 (배치 ${i / BATCH_SIZE + 1}):`, error);
      throw new Error(`플랜 생성 실패: ${error.message}`);
    }

    if (data) {
      createdIds.push(...data.map((p) => p.id));
    }
  }

  return createdIds;
}

/**
 * 대량 히스토리 생성
 * 
 * 여러 플랜 히스토리를 한 번에 생성합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param histories 히스토리 데이터 목록
 * @returns 생성된 히스토리 ID 목록
 */
export async function batchCreateHistory(
  supabase: SupabaseClient,
  histories: CreateHistoryInput[]
): Promise<string[]> {
  if (histories.length === 0) {
    return [];
  }

  // Supabase는 한 번에 최대 1000개까지 INSERT 가능
  const BATCH_SIZE = 1000;
  const createdIds: string[] = [];

  for (let i = 0; i < histories.length; i += BATCH_SIZE) {
    const batch = histories.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('plan_history')
      .insert(batch)
      .select('id');

    if (error) {
      console.error(`[batchProcessor] 히스토리 생성 실패 (배치 ${i / BATCH_SIZE + 1}):`, error);
      throw new Error(`히스토리 생성 실패: ${error.message}`);
    }

    if (data) {
      createdIds.push(...data.map((h) => h.id));
    }
  }

  return createdIds;
}

/**
 * 대량 플랜 업데이트
 * 
 * 여러 플랜을 한 번에 업데이트합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param updates 업데이트 데이터 (planId와 업데이트 필드)
 * @returns 업데이트된 플랜 수
 */
export async function batchUpdatePlans(
  supabase: SupabaseClient,
  updates: Array<{ planId: string; data: Partial<CreatePlanInput> }>
): Promise<number> {
  if (updates.length === 0) {
    return 0;
  }

  // 개별 업데이트 (Supabase는 WHERE IN으로 여러 행을 다른 값으로 업데이트할 수 없음)
  // 또는 PostgreSQL의 UPDATE ... FROM 구문 사용
  // 여기서는 간단하게 개별 업데이트로 처리
  let totalUpdated = 0;

  for (const update of updates) {
    const { error } = await supabase
      .from('student_plan')
      .update(update.data)
      .eq('id', update.planId);

    if (error) {
      console.error(`[batchProcessor] 플랜 업데이트 실패 (${update.planId}):`, error);
      continue; // 개별 실패는 로그만 남기고 계속 진행
    }

    totalUpdated++;
  }

  return totalUpdated;
}

