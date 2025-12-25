"use client";

/**
 * Idempotency Key Hook
 *
 * 클라이언트에서 멱등성 키를 생성하고 관리하는 React 훅
 *
 * @example
 * ```tsx
 * function CreatePlanButton() {
 *   const { generateKey, getKeyForAction, clearKey } = useIdempotencyKey();
 *
 *   const handleCreate = async () => {
 *     const key = generateKey("createPlan");
 *     try {
 *       const result = await createPlanAction(data, key);
 *       if (result.success) {
 *         clearKey("createPlan");
 *       }
 *     } catch (error) {
 *       // 재시도 시 같은 키 사용
 *       const retryKey = getKeyForAction("createPlan");
 *     }
 *   };
 * }
 * ```
 */

import { useCallback, useRef } from "react";

/**
 * UUID v4 생성 (브라우저 환경)
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 타임스탬프 기반 고유 키 생성
 */
function generateTimestampKey(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

export type IdempotencyKeyOptions = {
  /** 키 생성 전략 */
  strategy?: "uuid" | "timestamp";
  /** 키 만료 시간 (ms) - 클라이언트 측 */
  ttlMs?: number;
};

export type UseIdempotencyKeyReturn = {
  /** 새 멱등성 키 생성 */
  generateKey: (actionName: string) => string;
  /** 특정 액션의 현재 키 조회 */
  getKeyForAction: (actionName: string) => string | undefined;
  /** 특정 액션의 키 삭제 */
  clearKey: (actionName: string) => void;
  /** 모든 키 삭제 */
  clearAllKeys: () => void;
  /** 키가 있는지 확인 */
  hasKey: (actionName: string) => boolean;
};

/**
 * 멱등성 키 관리 훅
 */
export function useIdempotencyKey(
  options: IdempotencyKeyOptions = {}
): UseIdempotencyKeyReturn {
  const { strategy = "uuid", ttlMs = 5 * 60 * 1000 } = options; // 기본 5분 TTL

  // 액션별 키 저장 (메모리)
  const keysRef = useRef<Map<string, { key: string; createdAt: number }>>(
    new Map()
  );

  /**
   * 만료된 키 정리
   */
  const cleanupExpiredKeys = useCallback(() => {
    const now = Date.now();
    const keys = keysRef.current;

    for (const [actionName, entry] of keys.entries()) {
      if (now - entry.createdAt > ttlMs) {
        keys.delete(actionName);
      }
    }
  }, [ttlMs]);

  /**
   * 새 멱등성 키 생성
   */
  const generateKey = useCallback(
    (actionName: string): string => {
      cleanupExpiredKeys();

      const key =
        strategy === "uuid" ? generateUUID() : generateTimestampKey();
      keysRef.current.set(actionName, { key, createdAt: Date.now() });

      return key;
    },
    [strategy, cleanupExpiredKeys]
  );

  /**
   * 특정 액션의 현재 키 조회
   */
  const getKeyForAction = useCallback(
    (actionName: string): string | undefined => {
      cleanupExpiredKeys();

      const entry = keysRef.current.get(actionName);
      if (!entry) return undefined;

      // 만료 확인
      if (Date.now() - entry.createdAt > ttlMs) {
        keysRef.current.delete(actionName);
        return undefined;
      }

      return entry.key;
    },
    [ttlMs, cleanupExpiredKeys]
  );

  /**
   * 특정 액션의 키 삭제
   */
  const clearKey = useCallback((actionName: string): void => {
    keysRef.current.delete(actionName);
  }, []);

  /**
   * 모든 키 삭제
   */
  const clearAllKeys = useCallback((): void => {
    keysRef.current.clear();
  }, []);

  /**
   * 키가 있는지 확인
   */
  const hasKey = useCallback(
    (actionName: string): boolean => {
      cleanupExpiredKeys();
      return keysRef.current.has(actionName);
    },
    [cleanupExpiredKeys]
  );

  return {
    generateKey,
    getKeyForAction,
    clearKey,
    clearAllKeys,
    hasKey,
  };
}

/**
 * 요청별 자동 멱등성 키 생성 훅
 *
 * 폼 제출 등에서 자동으로 새 키를 생성하고 관리
 */
export function useAutoIdempotencyKey(
  actionName: string,
  options: IdempotencyKeyOptions = {}
): {
  key: string;
  regenerate: () => string;
  clear: () => void;
} {
  const { generateKey, getKeyForAction, clearKey } = useIdempotencyKey(options);

  // 현재 키 또는 새 키 생성
  const key = getKeyForAction(actionName) ?? generateKey(actionName);

  const regenerate = useCallback(() => {
    clearKey(actionName);
    return generateKey(actionName);
  }, [actionName, clearKey, generateKey]);

  const clear = useCallback(() => {
    clearKey(actionName);
  }, [actionName, clearKey]);

  return { key, regenerate, clear };
}
