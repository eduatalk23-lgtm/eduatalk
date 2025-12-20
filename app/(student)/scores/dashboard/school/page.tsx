import { redirect } from "next/navigation";

/**
 * @deprecated 이 페이지는 더 이상 사용되지 않습니다.
 * 통합 대시보드(/scores/dashboard/unified)로 리다이렉트됩니다.
 */
export default function SchoolScoreDashboardPage() {
  redirect("/scores/dashboard/unified");
}

