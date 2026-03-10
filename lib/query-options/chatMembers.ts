import { queryOptions } from "@tanstack/react-query";
import { getTenantMembersAction } from "@/lib/domains/chat/actions";
import { chatKeys } from "@/lib/domains/chat/queryKeys";

/**
 * 테넌트 멤버 목록 query 옵션 (멤버 탭용)
 *
 * 항상 전체("all") 조회 후 클라이언트에서 필터링합니다.
 * 필터 변경 시 네트워크 요청 없이 즉시 전환됩니다.
 */
export function chatMembersQueryOptions() {
  return queryOptions({
    queryKey: chatKeys.tenantMembers(),
    queryFn: async () => {
      const result = await getTenantMembersAction("all");
      if (!result.success) {
        throw new Error(result.error ?? "멤버 목록 조회 실패");
      }
      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
  });
}
