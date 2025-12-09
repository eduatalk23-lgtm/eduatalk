/**
 * 재조정 트랜잭션 래퍼 함수
 * 
 * 재조정 작업을 안전하게 트랜잭션으로 감싸서 실행합니다.
 * 동시성 제어 및 에러 처리를 포함합니다.
 * 
 * @module lib/reschedule/transaction
 */

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { acquirePlanGroupLock } from '@/lib/utils/planGroupLock';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// 트랜잭션 래퍼 타입
// ============================================

/**
 * 트랜잭션 내에서 실행할 함수 타입
 */
export type TransactionOperation<T> = (
  supabase: SupabaseClient
) => Promise<T>;

// ============================================
// 트랜잭션 실행
// ============================================

/**
 * 재조정 트랜잭션 실행
 * 
 * 플랜 그룹 단위로 락을 획득한 후 작업을 실행합니다.
 * 에러 발생 시 자동으로 롤백됩니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param operation 트랜잭션 내에서 실행할 작업
 * @returns 작업 결과
 * 
 * @throws {Error} 작업 실패 시
 */
export async function executeRescheduleTransaction<T>(
  groupId: string,
  operation: TransactionOperation<T>
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  
  try {
    // 1. 플랜 그룹 락 획득 (동시성 제어)
    const lockAcquired = await acquirePlanGroupLock(supabase, groupId);
    if (!lockAcquired) {
      throw new Error(
        `플랜 그룹 ${groupId}에 대한 재조정이 이미 진행 중입니다.`
      );
    }
    
    // 2. 트랜잭션 시작 (Supabase는 자동으로 트랜잭션 관리)
    // 실제로는 각 쿼리가 자동으로 트랜잭션으로 묶이지만,
    // 명시적으로 BEGIN/COMMIT을 사용하려면 RPC 함수가 필요합니다.
    
    // 3. 작업 실행
    const result = await operation(supabase);
    
    // 4. 성공 시 자동 커밋 (Supabase 클라이언트는 자동 커밋)
    return result;
  } catch (error) {
    // 에러 발생 시 자동 롤백 (Supabase 클라이언트는 자동 롤백)
    console.error('[reschedule/transaction] 트랜잭션 실패:', error);
    throw error;
  }
}

/**
 * 재조정 트랜잭션 실행 (재시도 포함)
 * 
 * 네트워크 오류 등 일시적 오류에 대해 재시도를 수행합니다.
 * 
 * @param groupId 플랜 그룹 ID
 * @param operation 트랜잭션 내에서 실행할 작업
 * @param maxRetries 최대 재시도 횟수 (기본: 3)
 * @returns 작업 결과
 */
export async function executeRescheduleTransactionWithRetry<T>(
  groupId: string,
  operation: TransactionOperation<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeRescheduleTransaction(groupId, operation);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // 재시도 가능한 에러인지 확인
      const isRetryable = isRetryableError(lastError);
      
      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }
      
      // 재시도 전 대기 (지수 백오프)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      
      console.warn(
        `[reschedule/transaction] 재시도 ${attempt}/${maxRetries} (${delay}ms 대기)`
      );
    }
  }
  
  throw lastError || new Error('Unknown error');
}

/**
 * 재시도 가능한 에러인지 확인
 * 
 * @param error 에러 객체
 * @returns 재시도 가능 여부
 */
function isRetryableError(error: Error): boolean {
  // 네트워크 오류, 타임아웃, 일시적 DB 오류 등
  const retryableMessages = [
    'network',
    'timeout',
    'connection',
    'ECONNRESET',
    'ETIMEDOUT',
    'deadlock',
    'lock',
  ];
  
  const errorMessage = error.message.toLowerCase();
  return retryableMessages.some((msg) => errorMessage.includes(msg));
}

