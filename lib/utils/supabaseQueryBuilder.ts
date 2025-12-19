/**
 * Supabase 쿼리 빌더 헬퍼
 */

/**
 * 필터 설정 타입
 */
export type FilterConfig<T> = {
  [K in keyof T]?: {
    operator?: "eq" | "ilike" | "in" | "gte" | "lte";
    value?: T[K] | T[K][];
    transform?: (value: T[K]) => unknown;
  };
};

/**
 * Supabase 쿼리에 필터 적용
 */
export function applyFilters<T extends Record<string, unknown>>(
  query: any,
  filters: Partial<T>,
  config: FilterConfig<T>
) {
  let resultQuery = query;

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    const filterConfig = config[key as keyof T];
    if (!filterConfig) return;

    const operator = filterConfig.operator || "eq";
    const transformedValue = filterConfig.transform
      ? filterConfig.transform(value as T[keyof T])
      : value;

    switch (operator) {
      case "ilike":
        resultQuery = resultQuery.ilike(key, `%${transformedValue}%`);
        break;
      case "in":
        resultQuery = resultQuery.in(key, transformedValue as unknown[]);
        break;
      case "gte":
        resultQuery = resultQuery.gte(key, transformedValue);
        break;
      case "lte":
        resultQuery = resultQuery.lte(key, transformedValue);
        break;
      default:
        resultQuery = resultQuery.eq(key, transformedValue);
    }
  });

  return resultQuery;
}

