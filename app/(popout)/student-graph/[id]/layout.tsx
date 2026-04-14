export const dynamic = "force-dynamic";

import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCachedUserRole } from "@/lib/auth/getCurrentUserRole";
import { isAdminRole } from "@/lib/auth/isAdminRole";

/**
 * Student Graph Standalone Layout
 * - admin/consultant 권한 검증
 * - TopBar/네비게이션 없이 그래프만 풀뷰포트
 */
export default async function StudentGraphLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { role } = await getCachedUserRole();
  if (!isAdminRole(role)) redirect("/");

  return <>{children}</>;
}
