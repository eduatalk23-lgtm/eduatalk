import { queryOptions } from "@tanstack/react-query";
import { searchParentsAction } from "@/lib/domains/parent/actions/search";
import { getParentDetailAction } from "@/lib/domains/parent/actions/detail";

/**
 * 학부모 검색 쿼리 옵션
 */
export function parentSearchQueryOptions(query: string) {
  return queryOptions({
    queryKey: ["parentSearch", query] as const,
    queryFn: () => searchParentsAction(query),
    staleTime: 1000 * 30, // 30초
  });
}

/**
 * 학부모 상세 조회 쿼리 옵션
 */
export function parentDetailQueryOptions(parentId: string) {
  return queryOptions({
    queryKey: ["parentDetail", parentId] as const,
    queryFn: () => getParentDetailAction(parentId),
    staleTime: 1000 * 60, // 1분
  });
}
