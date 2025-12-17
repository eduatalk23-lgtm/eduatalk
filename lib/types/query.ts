/**
 * TanStack Query 타입 헬퍼
 * 
 * 타입 안전한 쿼리 옵션 및 쿼리 키 정의를 위한 유틸리티
 */

import type { QueryKey } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";

/**
 * 타입 안전한 쿼리 키 팩토리
 * 
 * @example
 * ```typescript
 * const planKeys = {
 *   all: ['plans'] as const,
 *   lists: () => [...planKeys.all, 'list'] as const,
 *   list: (filters: string) => [...planKeys.lists(), filters] as const,
 *   details: () => [...planKeys.all, 'detail'] as const,
 *   detail: (id: string) => [...planKeys.details(), id] as const,
 * };
 * ```
 */
export type QueryKeyFactory<T extends Record<string, (...args: any[]) => QueryKey>> = T;

/**
 * queryOptions를 re-export하여 편의성 향상
 */
export { queryOptions };

/**
 * 쿼리 키 타입 추출
 */
export type ExtractQueryKey<T> = T extends QueryKey ? T : never;

