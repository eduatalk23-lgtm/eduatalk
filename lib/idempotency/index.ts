"use server";

/**
 * Idempotency Key Management
 *
 * 중복 요청 방지를 위한 멱등성 키 관리 시스템
 *
 * @example Server Action에서 사용
 * ```typescript
 * async function createPlanAction(data: PlanData, idempotencyKey?: string) {
 *   const result = await withIdempotency(
 *     idempotencyKey,
 *     userId,
 *     "createPlan",
 *     async () => {
 *       // 실제 플랜 생성 로직
 *       return { success: true, planId: "..." };
 *     }
 *   );
 *   return result;
 * }
 * ```
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createHash } from "crypto";

/**
 * 멱등성 체크 결과 타입
 */
export type IdempotencyCheckResult =
  | { status: "acquired"; key_id: string }
  | { status: "duplicate"; response: unknown }
  | { status: "in_progress"; created_at: string };

/**
 * 멱등성 래퍼 결과 타입
 */
export type IdempotencyResult<T> = {
  /** 성공 여부 */
  success: boolean;
  /** 응답 데이터 */
  data?: T;
  /** 중복 요청 여부 */
  isDuplicate?: boolean;
  /** 에러 메시지 */
  error?: string;
};

/**
 * 요청 해시 생성 (선택적 - 요청 검증용)
 */
export function createRequestHash(payload: unknown): string {
  const json = JSON.stringify(payload);
  return createHash("sha256").update(json).digest("hex").slice(0, 32);
}

/**
 * 멱등성 키 확인 및 획득
 */
async function checkIdempotencyKey(
  key: string,
  userId: string,
  actionName: string,
  requestHash?: string
): Promise<IdempotencyCheckResult> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("check_idempotency", {
    p_key: key,
    p_user_id: userId,
    p_action: actionName,
    p_request_hash: requestHash ?? null,
  });

  if (error) {
    console.error("[idempotency] check_idempotency 호출 실패:", error);
    // 에러 시 진행 허용 (fail-open)
    return { status: "acquired", key_id: "" };
  }

  return data as IdempotencyCheckResult;
}

/**
 * 멱등성 레코드 완료 처리
 */
async function completeIdempotencyRecord(
  keyId: string,
  response: unknown,
  success: boolean
): Promise<void> {
  if (!keyId) return; // 키 ID가 없으면 스킵

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.rpc("complete_idempotency", {
    p_key_id: keyId,
    p_response: response,
    p_success: success,
  });

  if (error) {
    console.error("[idempotency] complete_idempotency 호출 실패:", error);
  }
}

/**
 * 멱등성 키로 Server Action 래핑
 *
 * 동일한 멱등성 키로 중복 요청이 오면:
 * - 완료된 요청: 캐시된 응답 반환
 * - 진행 중인 요청: 에러 반환
 * - 실패한 요청: 재시도 허용
 *
 * @param idempotencyKey 멱등성 키 (클라이언트 제공)
 * @param userId 사용자 ID
 * @param actionName 액션 이름 (예: "createPlan", "completePlan")
 * @param action 실제 수행할 비동기 함수
 * @param requestHash 요청 해시 (선택적 - 요청 검증용)
 * @returns 액션 결과 또는 캐시된 응답
 */
export async function withIdempotency<T>(
  idempotencyKey: string | undefined | null,
  userId: string,
  actionName: string,
  action: () => Promise<T>,
  requestHash?: string
): Promise<IdempotencyResult<T>> {
  // 멱등성 키가 없으면 그냥 실행
  if (!idempotencyKey) {
    try {
      const result = await action();
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "알 수 없는 오류",
      };
    }
  }

  // 멱등성 키 확인
  const check = await checkIdempotencyKey(
    idempotencyKey,
    userId,
    actionName,
    requestHash
  );

  if (check.status === "duplicate") {
    // 이미 완료된 요청 - 캐시된 응답 반환
    console.log(
      `[idempotency] 중복 요청 감지: ${actionName} (key: ${idempotencyKey})`
    );
    return {
      success: true,
      data: check.response as T,
      isDuplicate: true,
    };
  }

  if (check.status === "in_progress") {
    // 동일 요청이 진행 중
    console.warn(
      `[idempotency] 동시 요청 감지: ${actionName} (key: ${idempotencyKey})`
    );
    return {
      success: false,
      error: "동일한 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.",
    };
  }

  // 새 요청 - 실행
  const keyId = check.key_id;
  try {
    const result = await action();

    // 성공 시 응답 캐싱
    await completeIdempotencyRecord(keyId, result, true);

    return { success: true, data: result };
  } catch (error) {
    // 실패 시 실패 상태로 기록 (재시도 가능)
    const errorMessage =
      error instanceof Error ? error.message : "알 수 없는 오류";
    await completeIdempotencyRecord(keyId, { error: errorMessage }, false);

    return { success: false, error: errorMessage };
  }
}

/**
 * 멱등성 데코레이터 생성
 *
 * Server Action에 멱등성을 쉽게 추가할 수 있는 헬퍼
 *
 * @example
 * ```typescript
 * const createPlanIdempotent = createIdempotentAction(
 *   "createPlan",
 *   async (data: PlanData, userId: string) => {
 *     // 플랜 생성 로직
 *     return { success: true, planId: "..." };
 *   }
 * );
 *
 * // 사용
 * const result = await createPlanIdempotent(
 *   { ...planData },
 *   userId,
 *   idempotencyKey
 * );
 * ```
 */
export function createIdempotentAction<TArgs extends unknown[], TResult>(
  actionName: string,
  action: (...args: TArgs) => Promise<TResult>
) {
  return async (
    ...argsWithKey: [...TArgs, string, string | undefined]
  ): Promise<IdempotencyResult<TResult>> => {
    const idempotencyKey = argsWithKey.pop() as string | undefined;
    const userId = argsWithKey.pop() as string;
    const args = argsWithKey as unknown as TArgs;

    return withIdempotency(idempotencyKey, userId, actionName, () =>
      action(...args)
    );
  };
}
