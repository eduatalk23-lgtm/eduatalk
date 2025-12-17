/**
 * 타입 안전한 useQuery 래퍼
 * 
 * queryOptions 패턴을 사용하여 타입 안전성을 향상시킨 useQuery 훅
 * 
 * TanStack Query v5의 queryOptions를 활용하여 타입 안전성을 향상시킵니다.
 */

import { useQuery, queryOptions, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";

/**
 * 타입 안전한 useQuery 훅
 * 
 * queryOptions를 사용하여 타입 안전성을 향상시킵니다.
 * 
 * @example
 * ```typescript
 * const planOptions = queryOptions({
 *   queryKey: ['plans', studentId, planDate],
 *   queryFn: async () => {
 *     return await getPlansForStudent({ studentId, planDate });
 *   },
 *   staleTime: 1000 * 60,
 * });
 * 
 * const { data, isLoading } = useTypedQuery(planOptions);
 * // data는 자동으로 Plan[] | undefined로 추론됨
 * ```
 */
export function useTypedQuery<
  TQueryFnData = unknown,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>
): UseQueryResult<TData, TError> {
  return useQuery(options);
}

/**
 * queryOptions를 re-export하여 편의성 향상
 */
export { queryOptions };

