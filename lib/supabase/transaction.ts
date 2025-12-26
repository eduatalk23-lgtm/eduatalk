/**
 * Supabase 트랜잭션 유틸리티
 *
 * Supabase는 클라이언트 사이드에서 네이티브 트랜잭션을 지원하지 않으므로,
 * 다음과 같은 전략을 사용합니다:
 *
 * 1. withBatchOperations: 순차 실행 + 에러 추적 + 롤백 힌트
 * 2. PostgreSQL RPC 함수: 복잡한 트랜잭션은 DB 함수로 처리
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 배치 작업 결과
 */
export interface BatchOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  /** 성공한 작업 수 */
  completedCount: number;
  /** 전체 작업 수 */
  totalCount: number;
  /** 실패한 작업의 인덱스 (있는 경우) */
  failedAt?: number;
  /** 롤백이 필요한 작업들의 ID (성공한 작업들) */
  rollbackIds?: string[];
}

/**
 * 개별 작업 정의
 */
export interface BatchOperation<T = unknown> {
  /** 작업 이름 (디버깅용) */
  name: string;
  /** 실행할 함수 */
  execute: () => Promise<{ success: boolean; data?: T; error?: string }>;
  /** 롤백 시 사용할 ID (선택적) */
  rollbackId?: string;
}

/**
 * 여러 작업을 순차적으로 실행하고 에러를 추적합니다.
 * 하나의 작업이 실패하면 나머지 작업을 중단하고 에러 정보를 반환합니다.
 *
 * @example
 * const result = await withBatchOperations([
 *   {
 *     name: 'Update plan 1',
 *     execute: async () => {
 *       const { error } = await supabase.from('student_plan').update({...}).eq('id', '1');
 *       return { success: !error, error: error?.message };
 *     },
 *     rollbackId: '1',
 *   },
 *   {
 *     name: 'Update plan 2',
 *     execute: async () => {
 *       const { error } = await supabase.from('student_plan').update({...}).eq('id', '2');
 *       return { success: !error, error: error?.message };
 *     },
 *     rollbackId: '2',
 *   },
 * ]);
 */
export async function withBatchOperations<T = unknown>(
  operations: BatchOperation<T>[]
): Promise<BatchOperationResult<T[]>> {
  const results: T[] = [];
  const rollbackIds: string[] = [];
  let failedAt: number | undefined;
  let errorMessage: string | undefined;

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];

    try {
      const result = await operation.execute();

      if (!result.success) {
        failedAt = i;
        errorMessage = result.error ?? `${operation.name} 실패`;
        break;
      }

      if (result.data !== undefined) {
        results.push(result.data);
      }

      if (operation.rollbackId) {
        rollbackIds.push(operation.rollbackId);
      }
    } catch (error) {
      failedAt = i;
      errorMessage =
        error instanceof Error
          ? `${operation.name}: ${error.message}`
          : `${operation.name} 실행 중 오류 발생`;
      break;
    }
  }

  if (failedAt !== undefined) {
    return {
      success: false,
      error: errorMessage,
      completedCount: failedAt,
      totalCount: operations.length,
      failedAt,
      rollbackIds: rollbackIds.length > 0 ? rollbackIds : undefined,
    };
  }

  return {
    success: true,
    data: results,
    completedCount: operations.length,
    totalCount: operations.length,
  };
}

/**
 * 단일 테이블의 여러 레코드를 일괄 업데이트합니다.
 * 모든 업데이트가 성공하거나, 첫 번째 실패 시 중단됩니다.
 */
export async function batchUpdateRecords<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  tableName: string,
  updates: Array<{
    id: string;
    data: Partial<T>;
  }>,
  options?: {
    /** tenant 격리를 위한 tenant_id */
    tenantId?: string;
  }
): Promise<BatchOperationResult<string[]>> {
  const operations: BatchOperation<string>[] = updates.map((update, index) => ({
    name: `Update ${tableName} #${index + 1} (${update.id})`,
    rollbackId: update.id,
    execute: async () => {
      let query = supabase.from(tableName).update(update.data).eq('id', update.id);

      if (options?.tenantId) {
        query = query.eq('tenant_id', options.tenantId);
      }

      const { error } = await query;

      return {
        success: !error,
        data: update.id,
        error: error?.message,
      };
    },
  }));

  return withBatchOperations(operations);
}

/**
 * 롤백 작업을 수행합니다.
 * withBatchOperations 실패 시 반환된 rollbackIds를 사용하여 이전 상태로 복원합니다.
 *
 * 주의: 이 함수는 "best-effort" 롤백입니다. 실제 트랜잭션 롤백과 달리
 * 원본 상태를 완벽하게 복원하지 못할 수 있습니다.
 */
export async function rollbackUpdates(
  supabase: SupabaseClient,
  tableName: string,
  rollbackIds: string[],
  rollbackData: Record<string, unknown>,
  options?: {
    tenantId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    for (const id of rollbackIds) {
      let query = supabase.from(tableName).update(rollbackData).eq('id', id);

      if (options?.tenantId) {
        query = query.eq('tenant_id', options.tenantId);
      }

      const { error } = await query;

      if (error) {
        console.error(`Rollback failed for ${id}:`, error);
        // 롤백 실패는 로깅하고 계속 진행
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Rollback failed',
    };
  }
}

/**
 * 트랜잭션 컨텍스트를 생성하여 작업을 그룹화합니다.
 * 커밋 전까지 작업들을 수집하고, 한 번에 실행합니다.
 *
 * @example
 * const tx = createTransactionContext();
 *
 * tx.add({
 *   name: 'Create plan',
 *   execute: async () => {...},
 * });
 *
 * tx.add({
 *   name: 'Update group',
 *   execute: async () => {...},
 * });
 *
 * const result = await tx.commit();
 */
export function createTransactionContext<T = unknown>() {
  const operations: BatchOperation<T>[] = [];

  return {
    /** 작업 추가 */
    add(operation: BatchOperation<T>) {
      operations.push(operation);
      return this;
    },

    /** 현재 작업 수 */
    get size() {
      return operations.length;
    },

    /** 모든 작업 실행 */
    async commit(): Promise<BatchOperationResult<T[]>> {
      if (operations.length === 0) {
        return {
          success: true,
          data: [],
          completedCount: 0,
          totalCount: 0,
        };
      }

      return withBatchOperations(operations);
    },

    /** 작업 목록 초기화 */
    reset() {
      operations.length = 0;
      return this;
    },
  };
}
