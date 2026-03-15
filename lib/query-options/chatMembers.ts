import { queryOptions } from "@tanstack/react-query";
import { chatKeys } from "@/lib/domains/chat/queryKeys";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MemberListResponse } from "@/lib/domains/chat/actions/members-list";

/**
 * 테넌트 멤버 목록 query 옵션 (Browser RPC)
 *
 * 항상 전체("all") 조회 후 클라이언트에서 필터링합니다.
 * 필터 변경 시 네트워크 요청 없이 즉시 전환됩니다.
 */
export function chatMembersQueryOptions() {
  return queryOptions({
    queryKey: chatKeys.tenantMembers(),
    queryFn: async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.rpc("get_tenant_members_for_user", {
        p_filter: "all",
      });
      if (error) throw new Error(error.message);
      return data as MemberListResponse;
    },
    staleTime: 5 * 60 * 1000, // 5분
    refetchOnWindowFocus: false,
  });
}
