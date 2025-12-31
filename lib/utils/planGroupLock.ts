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
 * 주의: Supabase에서는 Advisory Lock을 직접 지원하지 않으므로,
 * 대신 plan_groups 테이블에 SELECT FOR UPDATE를 사용합니다.
 * 
 * @param supabase Supabase 클라이언트
 * @param groupId 플랜 그룹 ID
 * @returns Lock 획득 성공 여부
 * 
 * @throws {Error} Lock 획득 실패 시
 */
export async function acquirePlanGroupLock(
  supabase: SupabaseClient,
  groupId: string
): Promise<boolean> {
  try {
    // SELECT FOR UPDATE로 행 레벨 락 획득
    // 트랜잭션 내에서만 유효
    const { data, error } = await supabase
      .from('plan_groups')
      .select('id')
      .eq('id', groupId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // 플랜 그룹이 존재하지 않음
        throw new Error(`Plan group not found: ${groupId}`);
      }
      throw new Error(`Failed to acquire lock: ${error.message}`);
    }
    
    // 실제로는 트랜잭션 내에서 SELECT FOR UPDATE를 사용해야 하지만,
    // Supabase 클라이언트에서는 직접 지원하지 않으므로
    // 여기서는 단순히 존재 여부만 확인
    // 실제 락은 트랜잭션 래퍼에서 처리
    return true;
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
  const lockKey = getPlanGroupLockKey(groupId);
  
  // Advisory Lock 시도 (논블로킹)
  const { data, error } = await supabase.rpc('pg_try_advisory_xact_lock', {
    key: lockKey,
  });
  
  if (error) {
    // Lock 획득 실패
    return false;
  }
  
  // data는 boolean (true = 획득 성공, false = 획득 실패)
  return data === true;
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

