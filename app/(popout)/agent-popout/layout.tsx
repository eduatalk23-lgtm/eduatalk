export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";

/**
 * Agent Popout Layout
 * - 헤더/네비게이션 없이 AI 어시스턴트 UI만 렌더링
 * - (admin) 라우트 그룹 밖이므로 RoleBasedLayout 미적용
 */
export default async function AgentPopoutLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) redirect("/");

  return <>{children}</>;
}
