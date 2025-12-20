/**
 * 플랜 버전 관리 유틸리티 함수
 * 
 * 재조정 기능에서 플랜 버전을 관리하는 데 사용됩니다.
 * 
 * @module lib/utils/planVersionUtils
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentPlanRow } from '@/lib/types/plan';

// ============================================
// 타입 정의
// ============================================

/**
 * 플랜 버전 정보
 */
export interface PlanVersionInfo {
  version_group_id: string;
  version: number;
  is_active: boolean;
}

/**
 * 플랜 버전 히스토리
 */
export interface PlanVersionHistory {
  id: string;
  version: number;
  is_active: boolean;
  created_at: string;
  plan_data: StudentPlanRow; // 플랜 전체 데이터
}

// ============================================
// 버전 관리 함수
// ============================================

/**
 * 최신 버전 플랜 조회
 * 
 * version_group_id로 그룹화된 플랜 중 최신 버전(가장 높은 version)을 조회합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param versionGroupId 버전 그룹 ID
 * @returns 최신 버전 플랜 또는 null
 */
export async function getLatestVersionPlan(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<StudentPlanRow | null> {
  const { data, error } = await supabase
    .from('student_plan')
    .select('*')
    .eq('version_group_id', versionGroupId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[planVersionUtils] 최신 버전 조회 실패:', error);
    return null;
  }

  return data;
}

/**
 * 활성 버전 플랜 조회
 * 
 * version_group_id로 그룹화된 플랜 중 is_active = true인 플랜을 조회합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param versionGroupId 버전 그룹 ID
 * @returns 활성 버전 플랜 또는 null
 */
export async function getActiveVersionPlan(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<StudentPlanRow | null> {
  const { data, error } = await supabase
    .from('student_plan')
    .select('*')
    .eq('version_group_id', versionGroupId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('[planVersionUtils] 활성 버전 조회 실패:', error);
    return null;
  }

  return data;
}

/**
 * 새 버전 생성
 * 
 * 기존 플랜을 기반으로 새 버전을 생성합니다.
 * 
 * @param originalPlan 원본 플랜
 * @param changes 변경 사항
 * @returns 새 버전 플랜 데이터
 */
export function createNewVersion(
  originalPlan: StudentPlanRow,
  changes: Partial<StudentPlanRow>
): Omit<StudentPlanRow, 'id' | 'created_at' | 'updated_at'> & {
  version: number;
  is_active: boolean;
} {
  // 최신 버전 번호 계산
  const newVersion = ((originalPlan as { version?: number }).version || 1) + 1;

  const { id, created_at, updated_at, ...rest } = originalPlan;
  return {
    ...rest,
    ...changes,
    version_group_id: (originalPlan as { version_group_id?: string }).version_group_id || originalPlan.id,
    version: newVersion,
    is_active: true,
  } as Omit<StudentPlanRow, 'id' | 'created_at' | 'updated_at'> & {
    version: number;
    is_active: boolean;
  };
}

/**
 * 버전 히스토리 조회
 * 
 * version_group_id로 그룹화된 모든 버전을 조회합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param versionGroupId 버전 그룹 ID
 * @returns 버전 히스토리 목록
 */
export async function getVersionHistory(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<StudentPlanRow[]> {
  const { data, error } = await supabase
    .from('student_plan')
    .select('*')
    .eq('version_group_id', versionGroupId)
    .order('version', { ascending: false });

  if (error) {
    console.error('[planVersionUtils] 버전 히스토리 조회 실패:', error);
    return [];
  }

  return data || [];
}

/**
 * 버전 그룹의 최대 버전 번호 조회
 * 
 * @param supabase Supabase 클라이언트
 * @param versionGroupId 버전 그룹 ID
 * @returns 최대 버전 번호 (없으면 0)
 */
export async function getMaxVersion(
  supabase: SupabaseClient,
  versionGroupId: string
): Promise<number> {
  const { data, error } = await supabase
    .from('student_plan')
    .select('version')
    .eq('version_group_id', versionGroupId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return 0;
  }

  return data.version || 0;
}

/**
 * 버전 그룹 ID 초기화
 * 
 * 기존 플랜에 version_group_id가 없으면 초기화합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param planId 플랜 ID
 * @returns 초기화된 version_group_id
 */
export async function initializeVersionGroup(
  supabase: SupabaseClient,
  planId: string
): Promise<string | null> {
  // 기존 플랜 조회
  const { data: plan, error } = await supabase
    .from('student_plan')
    .select('id, version_group_id, version')
    .eq('id', planId)
    .single();

  if (error || !plan) {
    console.error('[planVersionUtils] 플랜 조회 실패:', error);
    return null;
  }

  // 이미 version_group_id가 있으면 그대로 반환
  if (plan.version_group_id) {
    return plan.version_group_id;
  }

  // version_group_id 초기화 (자기 자신의 ID 사용)
  const { error: updateError } = await supabase
    .from('student_plan')
    .update({
      version_group_id: plan.id,
      version: plan.version || 1,
    })
    .eq('id', planId);

  if (updateError) {
    console.error('[planVersionUtils] version_group_id 초기화 실패:', updateError);
    return null;
  }

  return plan.id;
}

