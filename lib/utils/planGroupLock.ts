/**
 * 플랜 그룹 단위 Advisory Lock 유틸리티
 *
 * 재조정 기능에서 동시성 제어를 위해 사용됩니다.
 * Postgres Advisory Lock을 사용하여 동일 플랜 그룹에 대한
 * 동시 재조정 요청을 방지합니다.
 *
 * @module lib/utils/planGroupLock
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logActionError } from "@/lib/logging/actionLogger";

// ============================================
// Lock 키 생성
// ============================================

/**
 * 플랜 그룹 ID를 기반으로 Advisory Lock 키 생성
 * 
 * Postgres Advisory Lock은 bigint를 사용하므로,
 * UUID를 해시하여 숫자로 변환합니다.
 * 
 * @param groupId 플랜 그룹 ID (UUID)
 * @returns Advisory Lock 키 (bigint)
 */
export function getPlanGroupLockKey(groupId: string): number {
  // UUID를 해시하여 숫자로 변환
  // 간단한 해시 함수 사용 (FNV-1a 변형)
  let hash = 2166136261;
  for (let i = 0; i < groupId.length; i++) {
    hash ^= groupId.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  
  // 양수로 변환 (Postgres Advisory Lock은 bigint 사용)
  return Math.abs(hash >>> 0);
}

// ============================================
// Lock 획득/해제
// ============================================

/**
 * 플랜 그룹 단위 Advisory Lock 획득
 * 
 * Phase 2.1: PostgreSQL Advisory Lock을 사용하여 동시성 제어
 * RPC 함수를 통해 트랜잭션 레벨 Advisory Lock을 획득합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param groupId 플랜 그룹 ID
 * @returns Lock 획득 성공 여부
 */
export async function acquirePlanGroupLock(
  supabase: SupabaseClient,
  groupId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('acquire_plan_group_lock', {
      p_group_id: groupId,
    });

    if (error) {
      logActionError(
        { domain: "utils", action: "acquirePlanGroupLock" },
        error,
        { groupId }
      );
      return false;
    }

    const result = data as {
      success: boolean;
      acquired: boolean;
      error?: string;
    };

    if (!result.success) {
      logActionError(
        { domain: "utils", action: "acquirePlanGroupLock" },
        new Error(result.error || "Lock acquisition failed"),
        { groupId }
      );
      return false;
    }

    return result.acquired === true;
  } catch (error) {
    logActionError(
      { domain: "utils", action: "acquirePlanGroupLock" },
      error,
      { groupId }
    );
    return false;
  }
}

/**
 * 플랜 그룹 단위 Advisory Lock 시도 (논블로킹)
 * 
 * Lock을 즉시 획득할 수 없으면 false를 반환합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param groupId 플랜 그룹 ID
 * @returns Lock 획득 성공 여부
 */
export async function tryAcquirePlanGroupLock(
  supabase: SupabaseClient,
  groupId: string
): Promise<boolean> {
  // acquire_plan_group_lock은 이미 논블로킹이므로 동일하게 사용
  return acquirePlanGroupLock(supabase, groupId);
}

// ============================================
// Lock 상태 확인
// ============================================

/**
 * 플랜 그룹 Lock 상태 확인
 * 
 * @param supabase Supabase 클라이언트
 * @param groupId 플랜 그룹 ID
 * @returns Lock 보유 여부
 */
export async function isPlanGroupLocked(
  supabase: SupabaseClient,
  groupId: string
): Promise<boolean> {
  const lockKey = getPlanGroupLockKey(groupId);
  
  // Advisory Lock 상태 확인
  const { data, error } = await supabase.rpc('pg_advisory_lock_held', {
    key: lockKey,
  });
  
  if (error) {
    return false;
  }
  
  return data === true;
}

